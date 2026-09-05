import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReviewRating, StudyCard, TodayStudyResponse } from '@shared/api.interface';
import { getStudySetting, getTodayStudy, updateStudySetting } from '@/api/study';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, RefreshCw, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import StudyCardView from './StudyCardView';
import { useStudyQueue } from './useStudyQueue';

const EMPTY_CARDS: StudyCard[] = [];
const DEFAULT_DAILY_NEW = 20;

const StudyPage: React.FC = () => {
  const [data, setData] = useState<TodayStudyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingInput, setSettingInput] = useState<string>(String(DEFAULT_DAILY_NEW));
  const [savingSetting, setSavingSetting] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<ReviewRating | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await getTodayStudy();
      setData(response);
    } catch (error) {
      logger.error(`加载今日学习数据失败: ${String(error)}`);
      toast.error('加载今日学习数据失败，请稍后重试');
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cards = useMemo<StudyCard[]>(() => data?.cards ?? EMPTY_CARDS, [data]);
  const { currentCard, flipped, submitting, remaining, newDone, reviewDone, isFinished, flip, rate } =
    useStudyQueue({
      cards,
      initialNewDone: data?.todayNewDone ?? 0,
      initialReviewDone: data?.todayReviewDone ?? 0,
    });

  // 三键模式键盘监听（页面级单次绑定）：
  // Enter = 确认键（正面翻面 / 背面提交选中项）；↑ = 上键选中「不认识」；↓ = 下键选中「认识」
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (!currentCard || submitting) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!flipped) {
          flip();
        } else if (selectedRating !== null) {
          void rate(selectedRating);
        }
        return;
      }
      if (!flipped) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedRating('again');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedRating('good');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, flipped, submitting, selectedRating, flip, rate]);

  // 回到正面（切卡 / 翻回）时清除选中态，保证每张卡默认无选中
  useEffect(() => {
    if (!flipped) setSelectedRating(null);
  }, [flipped]);

  const handleToggleSettings = useCallback(async (): Promise<void> => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    setSettingsOpen(true);
    try {
      const setting = await getStudySetting();
      setSettingInput(String(setting.dailyNewCount));
    } catch (error) {
      logger.error(`加载学习设置失败: ${String(error)}`);
      setSettingInput(String(data?.dailyNewGoal ?? DEFAULT_DAILY_NEW));
    }
  }, [settingsOpen, data]);

  const handleSettingChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setSettingInput(event.target.value);
  }, []);

  const handleSaveSetting = useCallback(async (): Promise<void> => {
    const value = Number(settingInput);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      toast.error('每日新词数需为 1-100 的整数');
      return;
    }
    setSavingSetting(true);
    try {
      await updateStudySetting({ dailyNewCount: value });
      toast.success('设置已保存');
      setSettingsOpen(false);
      await loadData();
    } catch (error) {
      logger.error(`保存学习设置失败: ${String(error)}`);
      toast.error('保存失败，请重试');
    } finally {
      setSavingSetting(false);
    }
  }, [settingInput, loadData]);

  const dailyNewGoal: number = data?.dailyNewGoal ?? 0;

  let body: React.ReactNode;
  if (loading && data === null) {
    body = (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <Skeleton className="h-[440px] w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    );
  } else if (loadError && data === null) {
    body = (
      <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border-slate-200 p-10 text-center shadow-sm">
        <p className="text-base font-medium text-slate-900">今日学习数据加载失败</p>
        <Button onClick={() => void loadData()} data-ai-section-type="button">
          <RefreshCw /> 重试
        </Button>
      </Card>
    );
  } else if (isFinished) {
    body = (
      <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border-slate-200 p-10 text-center shadow-sm">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="text-2xl font-bold text-slate-900">今日任务完成</h2>
        <p className="text-sm text-slate-500">
          {newDone + reviewDone > 0
            ? `今日已学 ${newDone} 个新词 · 完成 ${reviewDone} 次复习`
            : '暂无学习任务，先去词表添加单词吧'}
        </p>
        <Button
          size="lg"
          disabled={loading}
          onClick={() => void loadData()}
          data-ai-section-type="button"
        >
          <RefreshCw /> 再刷一轮复习
        </Button>
      </Card>
    );
  } else if (currentCard) {
    body = (
      <StudyCardView
        card={currentCard}
        flipped={flipped}
        submitting={submitting}
        selectedRating={selectedRating}
        onFlip={flip}
        onRate={rate}
      />
    );
  } else {
    body = null;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 今日进度摘要条 */}
      <Card
        data-ai-section-type="card-stat"
        className="rounded-2xl border-slate-200 px-4 py-3 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <span>
              新词 <span className="font-semibold text-slate-900">{newDone}</span>/{dailyNewGoal}
            </span>
            <span className="text-slate-300">·</span>
            <span>
              复习 <span className="font-semibold text-slate-900">{reviewDone}</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>
              剩余 <span className="font-semibold text-slate-900">{remaining}</span> 张卡
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleToggleSettings()}
            aria-label="学习设置"
            data-ai-section-type="button"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>
        {settingsOpen ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">每日新词数（1-100）</span>
            <Input
              type="number"
              min={1}
              max={100}
              value={settingInput}
              onChange={handleSettingChange}
              className="w-24"
              aria-label="每日新词数"
            />
            <Button
              size="sm"
              disabled={savingSetting}
              onClick={() => void handleSaveSetting()}
              data-ai-section-type="button"
            >
              {savingSetting ? '保存中…' : '保存'}
            </Button>
          </div>
        ) : null}
      </Card>

      {body}
    </div>
  );
};

export default StudyPage;
