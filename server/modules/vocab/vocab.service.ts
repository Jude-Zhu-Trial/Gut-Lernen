import { and, asc, count, eq, inArray, max } from 'drizzle-orm';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import {
  studyProgress,
  vocabList,
  vocabWord,
} from '@server/database/schema';
import type {
  VocabListSummary,
  VocabListsResponse,
  VocabWordItem,
  VocabWordsResponse,
} from '@shared/api.interface';
import type { CreateListDto, CreateWordDto } from './dto/vocab.dto';

@Injectable()
export class VocabService {
  private readonly logger = new Logger(VocabService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getLists(userId: string): Promise<VocabListsResponse> {
    const lists = await this.db
      .select()
      .from(vocabList)
      .orderBy(asc(vocabList.sortOrder));

    const wordCounts = await this.db
      .select({ listId: vocabWord.listId, total: count() })
      .from(vocabWord)
      .groupBy(vocabWord.listId);

    const learnedCounts = new Map<string, number>();
    const masteredCounts = new Map<string, number>();

    if (userId && lists.length > 0) {
      const listIds = lists.map((l: typeof vocabList.$inferSelect) => l.id);
      const progressRows = await this.db
        .select({
          listId: studyProgress.listId,
          status: studyProgress.status,
          total: count(),
        })
        .from(studyProgress)
        .where(
          and(
            eq(studyProgress.userId, userId),
            inArray(studyProgress.listId, listIds),
          ),
        )
        .groupBy(studyProgress.listId, studyProgress.status);

      for (const row of progressRows) {
        const totalNum = Number(row.total);
        if (row.status === 'mastered') {
          masteredCounts.set(row.listId, totalNum);
          learnedCounts.set(row.listId, (learnedCounts.get(row.listId) ?? 0) + totalNum);
        } else if (row.status === 'learning') {
          learnedCounts.set(row.listId, (learnedCounts.get(row.listId) ?? 0) + totalNum);
        }
      }
    }

    const wordCountMap = new Map<string, number>();
    for (const row of wordCounts) {
      wordCountMap.set(row.listId, Number(row.total));
    }

    const items: VocabListSummary[] = lists.map(
      (l: typeof vocabList.$inferSelect) => ({
        id: l.id,
        name: l.name,
        level: l.level,
        description: l.description,
        isPreset: l.isPreset,
        wordCount: wordCountMap.get(l.id) ?? 0,
        learnedCount: learnedCounts.get(l.id) ?? 0,
        masteredCount: masteredCounts.get(l.id) ?? 0,
      }),
    );

    return { items };
  }

  async createList(
    userId: string,
    dto: CreateListDto,
  ): Promise<VocabListSummary> {
    const inserted = await this.db
      .insert(vocabList)
      .values({
        name: dto.name,
        description: dto.description ?? null,
        isPreset: false,
        level: 'custom',
        sortOrder: 0,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    const list = inserted[0];
    if (!list) {
      throw new NotFoundException('词表创建失败');
    }

    return {
      id: list.id,
      name: list.name,
      level: list.level,
      description: list.description,
      isPreset: list.isPreset,
      wordCount: 0,
      learnedCount: 0,
      masteredCount: 0,
    };
  }

  async deleteList(userId: string, listId: string): Promise<{ ok: boolean }> {
    const list = await this.requireOwnCustomList(userId, listId);

    await this.db.transaction(async (tx) => {
      await tx.delete(vocabWord).where(eq(vocabWord.listId, list.id));
      await tx.delete(studyProgress).where(eq(studyProgress.listId, list.id));
      const deleted = await tx
        .delete(vocabList)
        .where(eq(vocabList.id, list.id))
        .returning({ id: vocabList.id });
      if (deleted.length === 0) {
        throw new NotFoundException('词表不存在');
      }
    });

    this.logger.log(`vocab list deleted: ${list.id}`);
    return { ok: true };
  }

  async getWords(listId: string): Promise<VocabWordsResponse> {
    const rows = await this.db
      .select()
      .from(vocabWord)
      .where(eq(vocabWord.listId, listId))
      .orderBy(asc(vocabWord.sortOrder));

    const items: VocabWordItem[] = rows.map((w: typeof vocabWord.$inferSelect) => ({
      id: w.id,
      listId: w.listId,
      german: w.german,
      phonetic: w.phonetic,
      chinese: w.chinese,
      example: w.example,
      exampleCn: w.exampleCn,
    }));

    return { items };
  }

  async createWord(
    userId: string,
    listId: string,
    dto: CreateWordDto,
  ): Promise<VocabWordItem> {
    const list = await this.requireOwnCustomList(userId, listId);

    const maxRow = await this.db
      .select({ maxOrder: max(vocabWord.sortOrder) })
      .from(vocabWord)
      .where(eq(vocabWord.listId, list.id));

    const nextOrder = (maxRow[0]?.maxOrder ?? 0) + 1;

    const inserted = await this.db
      .insert(vocabWord)
      .values({
        listId: list.id,
        german: dto.german,
        phonetic: dto.phonetic ?? null,
        chinese: dto.chinese,
        example: dto.example ?? null,
        exampleCn: dto.exampleCn ?? null,
        sortOrder: nextOrder,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    const word = inserted[0];
    if (!word) {
      throw new NotFoundException('单词创建失败');
    }

    return {
      id: word.id,
      listId: word.listId,
      german: word.german,
      phonetic: word.phonetic,
      chinese: word.chinese,
      example: word.example,
      exampleCn: word.exampleCn,
    };
  }

  async deleteWord(userId: string, wordId: string): Promise<{ ok: boolean }> {
    const wordRows = await this.db
      .select()
      .from(vocabWord)
      .where(eq(vocabWord.id, wordId));

    const word = wordRows[0];
    if (!word) {
      throw new NotFoundException('单词不存在');
    }

    await this.requireOwnCustomList(userId, word.listId);

    await this.db.transaction(async (tx) => {
      await tx.delete(studyProgress).where(eq(studyProgress.wordId, word.id));
      const deleted = await tx
        .delete(vocabWord)
        .where(eq(vocabWord.id, word.id))
        .returning({ id: vocabWord.id });
      if (deleted.length === 0) {
        throw new NotFoundException('单词不存在');
      }
    });

    return { ok: true };
  }

  // 校验词表存在、非预置、且属于当前用户
  private async requireOwnCustomList(
    userId: string,
    listId: string,
  ): Promise<typeof vocabList.$inferSelect> {
    const rows = await this.db
      .select()
      .from(vocabList)
      .where(eq(vocabList.id, listId));

    const list = rows[0];
    if (!list) {
      throw new NotFoundException('词表不存在');
    }
    if (list.isPreset || list.createdBy !== userId) {
      throw new ForbiddenException('无权操作该词表');
    }
    return list;
  }
}
