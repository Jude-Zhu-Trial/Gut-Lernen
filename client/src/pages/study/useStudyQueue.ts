import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewRating, StudyCard } from '@shared/api.interface';
import { submitReview } from '@/api/study';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';

export interface UseStudyQueueParams {
  cards: StudyCard[];
  initialNewDone: number;
  initialReviewDone: number;
}

export interface StudyQueueResult {
  currentCard: StudyCard | null;
  flipped: boolean;
  submitting: boolean;
  remaining: number;
  newDone: number;
  reviewDone: number;
  isFinished: boolean;
  flip: () => void;
  rate: (rating: ReviewRating) => Promise<void>;
}

const EMPTY_CARDS: StudyCard[] = [];

export function useStudyQueue({
  cards,
  initialNewDone,
  initialReviewDone,
}: UseStudyQueueParams): StudyQueueResult {
  const [queue, setQueue] = useState<StudyCard[]>(EMPTY_CARDS);
  const [index, setIndex] = useState<number>(0);
  const [flipped, setFlipped] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [newDone, setNewDone] = useState<number>(initialNewDone);
  const [reviewDone, setReviewDone] = useState<number>(initialReviewDone);
  const ratedWordIdsRef = useRef<Set<string>>(new Set());

  // 新一批卡片（首次加载 / 刷新 / 再刷一轮）时重置队列与统计
  useEffect(() => {
    setQueue(cards);
    setIndex(0);
    setFlipped(false);
    ratedWordIdsRef.current = new Set();
    setNewDone(initialNewDone);
    setReviewDone(initialReviewDone);
  }, [cards, initialNewDone, initialReviewDone]);

  const currentCard: StudyCard | null = queue[index] ?? null;

  const flip = useCallback((): void => {
    setFlipped((prev: boolean) => !prev);
  }, []);

  const rate = useCallback(
    async (rating: ReviewRating): Promise<void> => {
      const card = queue[index];
      if (!card || submitting) return;
      setSubmitting(true);
      try {
        await submitReview({ wordId: card.word.id, rating });
        // 同一个词今天首次评分才计入新词/复习统计，again 重排后再评不重复计
        if (!ratedWordIdsRef.current.has(card.word.id)) {
          ratedWordIdsRef.current.add(card.word.id);
          if (card.isNew) {
            setNewDone((n: number) => n + 1);
          } else {
            setReviewDone((n: number) => n + 1);
          }
        }
        setFlipped(false);
        if (rating === 'again') {
          // 「不认识」：本张卡追加到队列尾部，今天再见
          setQueue((q: StudyCard[]) => [...q, card]);
        }
        setIndex((i: number) => i + 1);
      } catch (error) {
        logger.error(`提交复习结果失败: ${String(error)}`);
        toast.error('提交失败，请重试');
      } finally {
        setSubmitting(false);
      }
    },
    [queue, index, submitting],
  );

  return {
    currentCard,
    flipped,
    submitting,
    remaining: Math.max(queue.length - index, 0),
    newDone,
    reviewDone,
    isFinished: currentCard === null,
    flip,
    rate,
  };
}
