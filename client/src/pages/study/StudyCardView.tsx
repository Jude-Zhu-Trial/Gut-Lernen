import React, { useCallback, useEffect } from 'react';
import type { ReviewRating, StudyCard } from '@shared/api.interface';
import { ArrowDown, ArrowUp, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface StudyCardViewProps {
  card: StudyCard;
  flipped: boolean;
  submitting: boolean;
  selectedRating: ReviewRating | null;
  onFlip: () => void;
  onRate: (rating: ReviewRating) => void;
}

interface RatingButtonConfig {
  rating: ReviewRating;
  label: string;
  hint: string;
  keyHint: string;
  activeClassName: string;
}

const RATING_BUTTONS: RatingButtonConfig[] = [
  {
    rating: 'again',
    label: '不认识',
    hint: '今天内再次出现',
    keyHint: '↑ 上键',
    activeClassName: 'bg-red-600 border-red-700 text-white ring-4 ring-red-200',
  },
  {
    rating: 'good',
    label: '认识',
    hint: '拉长复习间隔',
    keyHint: '↓ 下键',
    activeClassName: 'bg-emerald-600 border-emerald-700 text-white ring-4 ring-emerald-200',
  },
];

// 浏览器 TTS：失败静默（页面无交互前可能被浏览器阻止）
function speakGerman(text: string): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    logger.warn(`德语朗读失败: ${String(error)}`);
  }
}

const StudyCardView: React.FC<StudyCardViewProps> = ({
  card,
  flipped,
  submitting,
  selectedRating,
  onFlip,
  onRate,
}) => {
  // 新卡片出现时自动朗读一遍（静默失败）
  useEffect(() => {
    const timer = window.setTimeout((): void => {
      speakGerman(card.word.german);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [card]);

  const handleSpeak = useCallback(
    (event: React.MouseEvent): void => {
      event.stopPropagation();
      speakGerman(card.word.german);
    },
    [card],
  );

  const flipStyle: React.CSSProperties = {
    transformStyle: 'preserve-3d',
    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
    transition: 'transform 0.4s ease',
  };
  const backFaceStyle: React.CSSProperties = {
    backfaceVisibility: 'hidden',
    transform: 'rotateY(180deg)',
  };
  const frontFaceStyle: React.CSSProperties = { backfaceVisibility: 'hidden' };

  return (
    <div className="mx-auto w-full max-w-md" data-ai-section-type="card">
      <div className="w-full [perspective:1200px]">
        <div className="relative h-[440px] w-full" style={flipStyle}>
          {/* 正面：德语单词 */}
          <Card
            className="absolute inset-0 flex cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-slate-200 p-6 text-center shadow-sm"
            style={frontFaceStyle}
            onClick={onFlip}
          >
            <Badge
              className={`absolute left-4 top-4 border-transparent text-white ${
                card.isNew ? 'bg-indigo-600' : 'bg-amber-500'
              }`}
            >
              {card.isNew ? '新词' : '复习'}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 text-slate-400 hover:text-indigo-600"
              onClick={handleSpeak}
              aria-label="朗读单词"
              data-ai-section-type="button"
            >
              <Volume2 className="h-5 w-5" />
            </Button>
            <div className="px-4 text-5xl font-bold text-slate-900 break-words">
              {card.word.german}
            </div>
            {card.word.phonetic ? (
              <div className="mt-3 text-lg text-slate-500">
                [{card.word.phonetic}]
              </div>
            ) : null}
            <div className="absolute bottom-4 text-xs text-slate-400">
              按确认键翻面 · 点击卡片也可
            </div>
          </Card>

          {/* 背面：释义与例句 */}
          <Card
            className="absolute inset-0 flex cursor-pointer select-none flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl border-slate-200 p-6 text-center shadow-sm"
            style={backFaceStyle}
            onClick={onFlip}
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-2xl font-bold text-slate-900 break-words">
                {card.word.german}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                onClick={handleSpeak}
                aria-label="朗读单词"
                data-ai-section-type="button"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
            {card.word.phonetic ? (
              <div className="text-sm text-slate-500">[{card.word.phonetic}]</div>
            ) : null}
            <div className="text-2xl font-semibold text-indigo-600 break-words">
              {card.word.chinese}
            </div>
            {card.word.example ? (
              <p className="text-sm italic text-slate-700 break-words">
                {card.word.example}
              </p>
            ) : null}
            {card.word.exampleCn ? (
              <p className="text-sm text-slate-500 break-words">
                {card.word.exampleCn}
              </p>
            ) : null}
            <div className="text-xs text-slate-400">来自词表：{card.listName}</div>
          </Card>
        </div>
      </div>

      {/* 翻面后才出现的评分按钮：上键=不认识 / 下键=认识 / 确认键提交 */}
      {flipped ? (
        <div className="mt-5">
          <div className="flex w-full gap-3">
            {RATING_BUTTONS.map((item: RatingButtonConfig) => {
              const isSelected: boolean = selectedRating === item.rating;
              return (
                <Button
                  key={item.rating}
                  variant={isSelected ? 'default' : 'outline'}
                  size="lg"
                  disabled={submitting}
                  className={`h-auto flex-1 flex-col gap-1 py-5 ${
                    isSelected ? item.activeClassName : 'border-slate-300 text-slate-700'
                  }`}
                  onClick={() => onRate(item.rating)}
                  data-ai-section-type="button"
                >
                  <span className="flex items-center gap-2 text-base font-semibold">
                    {item.rating === 'again' ? (
                      <ArrowUp className="h-5 w-5" />
                    ) : (
                      <ArrowDown className="h-5 w-5" />
                    )}
                    {item.label}
                  </span>
                  <span className="text-xs font-normal opacity-80">{item.hint}</span>
                  <span className="text-[10px] font-normal opacity-60">{item.keyHint}</span>
                </Button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">按确认键提交</p>
        </div>
      ) : null}
    </div>
  );
};

export default StudyCardView;
