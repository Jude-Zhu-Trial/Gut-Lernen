import { useEffect, useState } from 'react';
import { Flame, AlarmClock, BookPlus, RotateCcw, RefreshCw } from 'lucide-react';
import type { ListProgressItem, StudyStatsResponse } from '@shared/api.interface';
import { getStudyStats } from '@client/src/api/study';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import StatsTrendChart from './StatsTrendChart';
import {
  getLevelBadgeClass,
  getLevelLabel,
} from '../wordlists/word-forms';

interface StatCardInfo {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<StudyStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data: StudyStatsResponse = await getStudyStats();
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void loadStats()}>
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        暂无统计数据
      </div>
    );
  }

  const cards: StatCardInfo[] = [
    { label: '今日新词', value: stats.todayNew, icon: BookPlus, iconClass: 'bg-indigo-50 text-indigo-600' },
    { label: '今日复习', value: stats.todayReview, icon: RotateCcw, iconClass: 'bg-indigo-50 text-indigo-600' },
    { label: '连续打卡（天）', value: stats.streak, icon: Flame, iconClass: 'bg-amber-50 text-amber-500' },
    { label: '待复习', value: stats.dueNow, icon: AlarmClock, iconClass: 'bg-amber-50 text-amber-500' },
  ];

  const totalPercent: number =
    stats.totalWords > 0
      ? Math.round((stats.totalLearned / stats.totalWords) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* 顶部统计卡 */}
      <div
        data-ai-section-type="card-stat"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {cards.map((card: StatCardInfo) => (
          <Card key={card.label} className="rounded-2xl border-slate-200">
            <CardContent className="flex items-center gap-3 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{card.value}</div>
                <div className="text-xs text-slate-500">{card.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 7 天学习趋势 */}
      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">近 7 天学习趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.weekTrend.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-slate-400">
              暂无趋势数据，快去学习吧
            </div>
          ) : (
            <StatsTrendChart trend={stats.weekTrend} />
          )}
        </CardContent>
      </Card>

      {/* 整体进度 */}
      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">整体进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">总学习进度</span>
              <span className="text-slate-500">
                {stats.totalLearned} / {stats.totalWords}（{totalPercent}%）
              </span>
            </div>
            <Progress value={totalPercent} className="h-2.5" />
            <p className="text-xs text-slate-400">
              已掌握 <span className="font-medium text-slate-600">{stats.totalMastered}</span> 个单词
            </p>
          </div>

          {stats.listProgress.length === 0 ? (
            <p className="text-sm text-slate-400">暂无词表学习数据</p>
          ) : (
            <div className="space-y-4">
              {stats.listProgress.map((item: ListProgressItem) => {
                const percent: number =
                  item.total > 0 ? Math.round((item.learned / item.total) * 100) : 0;
                return (
                  <div key={item.listId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-700">
                          {item.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={getLevelBadgeClass(item.level)}
                        >
                          {getLevelLabel(item.level)}
                        </Badge>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {item.learned} / {item.total} · 已掌握 {item.mastered}
                      </span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsPage;
