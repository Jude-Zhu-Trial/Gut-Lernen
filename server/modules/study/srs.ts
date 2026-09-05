// SRS 算法 + 日期工具 + 卡片组装（纯函数，业务时区 Asia/Shanghai）
import type { ReviewRating, StudyCard } from '@shared/api.interface';
import { vocabWord } from '@server/database/schema';

/** Asia/Shanghai 时区的「今天」key，格式 YYYY-MM-DD */
export function dayKey(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** 在 day key 上平移 n 天（n 可为负），返回新的 day key */
export function shiftDayKey(key: string, days: number): string {
  const base = new Date(`${key}T00:00:00Z`);
  return new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);
}

export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export interface SrsResult extends SrsState {
  status: 'learning' | 'mastered';
}

/** 按 rating 推进 SRS 状态 */
export function applySrs(state: SrsState, rating: ReviewRating): SrsResult {
  let { ease, intervalDays, reps, lapses } = state;
  if (rating === 'again') {
    ease = Math.max(1.3, ease - 0.2);
    reps = 0;
    lapses += 1;
    intervalDays = 0;
  } else {
    reps += 1;
    intervalDays = intervalDays === 0 ? 1 : Math.round(intervalDays * ease);
  }
  return { ease, intervalDays, reps, lapses, status: intervalDays >= 21 ? 'mastered' : 'learning' };
}

/** intervalDays=0 时到期时间为当前时刻 */
export function computeDueAt(now: Date, intervalDays: number): Date {
  return new Date(now.getTime() + intervalDays * 86400000);
}

type VocabWordRow = typeof vocabWord.$inferSelect;

/** 由 vocabWord 行组装 StudyCard */
export function buildCard(
  word: VocabWordRow,
  listName: string,
  isNew: boolean,
  reps: number,
): StudyCard {
  return {
    word: {
      id: word.id,
      listId: word.listId,
      german: word.german,
      phonetic: word.phonetic,
      chinese: word.chinese,
      example: word.example,
      exampleCn: word.exampleCn,
    },
    listName,
    isNew,
    reps,
  };
}
