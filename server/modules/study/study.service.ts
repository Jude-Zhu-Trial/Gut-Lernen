import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
import { and, asc, count, eq, inArray, lte, notExists, sql } from 'drizzle-orm';
import type {
  ListProgressItem,
  ReviewRating,
  ReviewRequest,
  ReviewResponse,
  StudyCard,
  StudySettingResponse,
  StudyStatsResponse,
  TodayStudyResponse,
  WeekTrendItem,
} from '@shared/api.interface';
import {
  studyDailyLog,
  studyProgress,
  studySetting,
  vocabList,
  vocabWord,
} from '@server/database/schema';
import { applySrs, buildCard, computeDueAt, dayKey, shiftDayKey } from './srs';

const DAILY_NEW_DEFAULT = 10;
const REVIEW_CARD_LIMIT = 60;
const RATING_VALUES: ReviewRating[] = ['again', 'good'];

@Injectable()
export class StudyService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getToday(userId: string): Promise<TodayStudyResponse> {
    const now = new Date();
    const today = dayKey(now);

    const [settingRow] = await this.db
      .select({ dailyNewCount: studySetting.dailyNewCount })
      .from(studySetting).where(eq(studySetting.userId, userId)).limit(1);
    const dailyNewGoal = settingRow?.dailyNewCount ?? DAILY_NEW_DEFAULT;

    const [todayLog] = await this.db
      .select({ newCount: studyDailyLog.newCount, reviewCount: studyDailyLog.reviewCount })
      .from(studyDailyLog)
      .where(and(eq(studyDailyLog.userId, userId), eq(studyDailyLog.studyDate, today)))
      .limit(1);
    const todayNewDone = todayLog?.newCount ?? 0;
    const todayReviewDone = todayLog?.reviewCount ?? 0;
    const newRemaining = Math.max(0, dailyNewGoal - todayNewDone);

    const dueRows = await this.db
      .select({ w: vocabWord, listName: vocabList.name, reps: studyProgress.reps })
      .from(studyProgress)
      .innerJoin(vocabWord, eq(studyProgress.wordId, vocabWord.id))
      .innerJoin(vocabList, eq(vocabWord.listId, vocabList.id))
      .where(and(eq(studyProgress.userId, userId), lte(studyProgress.dueAt, now)))
      .orderBy(asc(studyProgress.dueAt)).limit(REVIEW_CARD_LIMIT);

    const newCards: StudyCard[] = [];
    if (newRemaining > 0) {
      const newRows = await this.db
        .select({ w: vocabWord, listName: vocabList.name })
        .from(vocabWord)
        .innerJoin(vocabList, eq(vocabWord.listId, vocabList.id))
        .where(notExists(
          this.db.select({ one: sql`1` }).from(studyProgress)
            .where(and(eq(studyProgress.userId, userId), eq(studyProgress.wordId, vocabWord.id))),
        ))
        .orderBy(asc(vocabList.sortOrder), asc(vocabWord.sortOrder))
        .limit(newRemaining);
      newCards.push(...newRows.map((r) => buildCard(r.w, r.listName, true, 0)));
    }

    return {
      dailyNewGoal,
      todayNewDone,
      todayReviewDone,
      newRemaining,
      cards: [
        ...dueRows.map((r) => buildCard(r.w, r.listName, false, r.reps)),
        ...newCards,
      ],
    };
  }

  async review(userId: string, dto: ReviewRequest): Promise<ReviewResponse> {
    const rating: ReviewRating = dto.rating;
    if (!RATING_VALUES.includes(rating)) {
      throw new BadRequestException('rating 必须是 again/good');
    }
    const now = new Date();

    const [word] = await this.db
      .select({ id: vocabWord.id, listId: vocabWord.listId })
      .from(vocabWord).where(eq(vocabWord.id, dto.wordId)).limit(1);
    if (!word) throw new NotFoundException('单词不存在');

    const [progress] = await this.db.select().from(studyProgress)
      .where(and(eq(studyProgress.userId, userId), eq(studyProgress.wordId, dto.wordId)))
      .limit(1);

    const wasNew = !progress;
    const next = applySrs(
      {
        ease: progress?.ease ?? 2.5,
        intervalDays: progress?.intervalDays ?? 0,
        reps: progress?.reps ?? 0,
        lapses: progress?.lapses ?? 0,
      },
      rating,
    );
    const dueAt = computeDueAt(now, next.intervalDays);

    if (wasNew) {
      await this.db.insert(studyProgress).values({
        userId,
        wordId: word.id,
        listId: word.listId,
        status: next.status,
        ease: next.ease,
        intervalDays: next.intervalDays,
        reps: next.reps,
        lapses: next.lapses,
        dueAt,
        lastReviewedAt: now,
      });
    } else {
      const updated = await this.db.update(studyProgress)
        .set({
          status: next.status,
          ease: next.ease,
          intervalDays: next.intervalDays,
          reps: next.reps,
          lapses: next.lapses,
          dueAt,
          lastReviewedAt: now,
        })
        .where(eq(studyProgress.id, progress.id))
        .returning({ id: studyProgress.id });
      if (updated.length === 0) throw new NotFoundException('学习进度不存在');
    }

    await this.upsertDailyLog(userId, wasNew, now);
    return { ok: true };
  }

  private async upsertDailyLog(userId: string, wasNew: boolean, now: Date): Promise<void> {
    const today = dayKey(now);
    const [log] = await this.db
      .select({
        id: studyDailyLog.id,
        newCount: studyDailyLog.newCount,
        reviewCount: studyDailyLog.reviewCount,
      })
      .from(studyDailyLog)
      .where(and(eq(studyDailyLog.userId, userId), eq(studyDailyLog.studyDate, today)))
      .limit(1);

    if (!log) {
      await this.db.insert(studyDailyLog).values({
        userId,
        studyDate: today,
        newCount: wasNew ? 1 : 0,
        reviewCount: wasNew ? 0 : 1,
      });
      return;
    }
    await this.db.update(studyDailyLog)
      .set({
        newCount: wasNew ? log.newCount + 1 : log.newCount,
        reviewCount: wasNew ? log.reviewCount : log.reviewCount + 1,
      })
      .where(eq(studyDailyLog.id, log.id));
  }

  async getStats(userId: string): Promise<StudyStatsResponse> {
    const now = new Date();
    const nowIso = now.toISOString();
    const today = dayKey(now);

    const [todayLog] = await this.db
      .select({ newCount: studyDailyLog.newCount, reviewCount: studyDailyLog.reviewCount })
      .from(studyDailyLog)
      .where(and(eq(studyDailyLog.userId, userId), eq(studyDailyLog.studyDate, today)))
      .limit(1);

    const allLogs = await this.db
      .select({
        studyDate: studyDailyLog.studyDate,
        newCount: studyDailyLog.newCount,
        reviewCount: studyDailyLog.reviewCount,
      })
      .from(studyDailyLog).where(eq(studyDailyLog.userId, userId));
    const activeDays = new Set<string>();
    for (const log of allLogs) {
      if (log.newCount + log.reviewCount > 0) activeDays.add(log.studyDate);
    }

    let streak = 0;
    let cursor = activeDays.has(today) ? today : shiftDayKey(today, -1);
    while (activeDays.has(cursor)) {
      streak += 1;
      cursor = shiftDayKey(cursor, -1);
    }

    const [progressAgg] = await this.db
      .select({
        totalLearned: count(),
        totalMastered: sql<number>`count(*) filter (where ${studyProgress.status} = 'mastered')`,
        dueNow: sql<number>`count(*) filter (where ${studyProgress.dueAt} <= ${nowIso})`,
      })
      .from(studyProgress).where(eq(studyProgress.userId, userId));

    const [wordAgg] = await this.db.select({ total: count() }).from(vocabWord);

    const weekKeys: string[] = [];
    for (let i = 6; i >= 0; i -= 1) weekKeys.push(shiftDayKey(today, -i));
    const weekLogs = await this.db
      .select({
        studyDate: studyDailyLog.studyDate,
        newCount: studyDailyLog.newCount,
        reviewCount: studyDailyLog.reviewCount,
      })
      .from(studyDailyLog)
      .where(and(eq(studyDailyLog.userId, userId), inArray(studyDailyLog.studyDate, weekKeys)));
    const logByDate = new Map<string, { newCount: number; reviewCount: number }>();
    for (const log of weekLogs) {
      logByDate.set(log.studyDate, { newCount: log.newCount, reviewCount: log.reviewCount });
    }
    const weekTrend: WeekTrendItem[] = weekKeys.map((key) => ({
      date: key,
      newCount: logByDate.get(key)?.newCount ?? 0,
      reviewCount: logByDate.get(key)?.reviewCount ?? 0,
    }));

    return {
      todayNew: todayLog?.newCount ?? 0,
      todayReview: todayLog?.reviewCount ?? 0,
      streak,
      totalLearned: Number(progressAgg?.totalLearned ?? 0),
      totalMastered: Number(progressAgg?.totalMastered ?? 0),
      dueNow: Number(progressAgg?.dueNow ?? 0),
      totalWords: Number(wordAgg?.total ?? 0),
      weekTrend,
      listProgress: await this.getListProgress(userId),
    };
  }

  private async getListProgress(userId: string): Promise<ListProgressItem[]> {
    const lists = await this.db
      .select({ id: vocabList.id, name: vocabList.name, level: vocabList.level })
      .from(vocabList).orderBy(asc(vocabList.sortOrder));

    const wordCounts = await this.db
      .select({ listId: vocabWord.listId, total: count() })
      .from(vocabWord).groupBy(vocabWord.listId);
    const totalByList = new Map<string, number>();
    for (const row of wordCounts) totalByList.set(row.listId, Number(row.total));

    const progressCounts = await this.db
      .select({
        listId: studyProgress.listId,
        learned: count(),
        mastered: sql<number>`count(*) filter (where ${studyProgress.status} = 'mastered')`,
      })
      .from(studyProgress)
      .where(eq(studyProgress.userId, userId)).groupBy(studyProgress.listId);
    const progressByList = new Map<string, { learned: number; mastered: number }>();
    for (const row of progressCounts) {
      progressByList.set(row.listId, { learned: Number(row.learned), mastered: Number(row.mastered) });
    }

    return lists.map((list) => ({
      listId: list.id,
      name: list.name,
      level: list.level,
      total: totalByList.get(list.id) ?? 0,
      learned: progressByList.get(list.id)?.learned ?? 0,
      mastered: progressByList.get(list.id)?.mastered ?? 0,
    }));
  }

  async getSettings(userId: string): Promise<StudySettingResponse> {
    const [row] = await this.db
      .select({ dailyNewCount: studySetting.dailyNewCount })
      .from(studySetting).where(eq(studySetting.userId, userId)).limit(1);
    return { dailyNewCount: row?.dailyNewCount ?? DAILY_NEW_DEFAULT };
  }

  async updateSettings(userId: string, dailyNewCount: number): Promise<StudySettingResponse> {
    if (!Number.isInteger(dailyNewCount) || dailyNewCount < 1 || dailyNewCount > 100) {
      throw new BadRequestException('dailyNewCount 必须是 1-100 的整数');
    }
    await this.db.insert(studySetting).values({ userId, dailyNewCount })
      .onConflictDoUpdate({ target: studySetting.userId, set: { dailyNewCount } });
    return { dailyNewCount };
  }
}
