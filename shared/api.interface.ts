/* 前后端共享的类型写在这里 */

// ===== 词表管理 =====

export interface VocabListSummary {
  id: string;
  name: string;
  level: string; // 'a1' | 'a2' | 'b1' | 'custom'
  description: string | null;
  isPreset: boolean;
  wordCount: number;
  learnedCount: number;
  masteredCount: number;
}

export interface VocabWordItem {
  id: string;
  listId: string;
  german: string;
  phonetic: string | null;
  chinese: string;
  example: string | null;
  exampleCn: string | null;
}

export interface CreateListRequest {
  name: string;
  description?: string;
}

export interface CreateWordRequest {
  german: string;
  chinese: string;
  phonetic?: string;
  example?: string;
  exampleCn?: string;
}

export interface VocabListsResponse {
  items: VocabListSummary[];
}

export interface VocabWordsResponse {
  items: VocabWordItem[];
}

// ===== 学习（卡片流 + SRS） =====

export interface StudyCard {
  word: VocabWordItem;
  listName: string;
  isNew: boolean;
  reps: number;
}

export interface TodayStudyResponse {
  dailyNewGoal: number;
  todayNewDone: number;
  todayReviewDone: number;
  newRemaining: number;
  cards: StudyCard[];
}

export type ReviewRating = 'again' | 'good';

export interface ReviewRequest {
  wordId: string;
  rating: ReviewRating;
}

export interface ReviewResponse {
  ok: boolean;
}

export interface WeekTrendItem {
  date: string; // YYYY-MM-DD
  newCount: number;
  reviewCount: number;
}

export interface ListProgressItem {
  listId: string;
  name: string;
  level: string;
  total: number;
  learned: number;
  mastered: number;
}

export interface StudyStatsResponse {
  todayNew: number;
  todayReview: number;
  streak: number;
  totalLearned: number;
  totalMastered: number;
  dueNow: number;
  totalWords: number;
  weekTrend: WeekTrendItem[];
  listProgress: ListProgressItem[];
}

export interface StudySettingResponse {
  dailyNewCount: number;
}

export interface UpdateSettingRequest {
  dailyNewCount: number;
}
