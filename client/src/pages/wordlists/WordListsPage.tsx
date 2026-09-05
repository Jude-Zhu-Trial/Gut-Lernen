import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Layers } from 'lucide-react';
import type { VocabListSummary } from '@shared/api.interface';
import { getLists } from '@client/src/api/vocab';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import CreateWordListDialog from './CreateWordListDialog';
import WordListDetail from './WordListDetail';
import { getLevelBadgeClass, getLevelLabel } from './word-forms';

const WordListsPage: React.FC = () => {
  const [lists, setLists] = useState<VocabListSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState<boolean>(false);

  const loadLists = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLists();
      setLists(data.items);
    } catch (err: unknown) {
      logger.error('加载词表列表失败', err);
      setError('加载词表列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const selectedList: VocabListSummary | undefined = lists.find(
    (item: VocabListSummary) => item.id === selectedId,
  );

  const handleListDeleted = (): void => {
    setSelectedId(null);
    void loadLists();
  };

  if (loading && lists.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        加载中...
      </div>
    );
  }

  if (error && lists.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void loadLists()}>
          <RefreshCw className="h-4 w-4" />
          重试
        </Button>
      </div>
    );
  }

  if (selectedList) {
    return (
      <WordListDetail
        list={selectedList}
        onBack={() => setSelectedId(null)}
        onListChanged={loadLists}
        onListDeleted={handleListDeleted}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Layers className="h-5 w-5 text-indigo-600" />
          词表管理
        </h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新建词表
        </Button>
      </div>

      {lists.length === 0 ? (
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="flex h-56 flex-col items-center justify-center gap-3 p-6">
            <p className="text-sm text-slate-500">还没有词表，先新建一个吧</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新建词表
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div
          data-ai-section-type="card-list"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {lists.map((item: VocabListSummary) => {
            const percent: number =
              item.wordCount > 0
                ? Math.round((item.learnedCount / item.wordCount) * 100)
                : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="text-left"
              >
                <Card className="h-full rounded-2xl border-slate-200 transition-shadow hover:border-indigo-200 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {item.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={getLevelBadgeClass(item.level)}
                      >
                        {getLevelLabel(item.level)}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
                      {item.description ?? '暂无描述'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.wordCount} 个单词 · 已掌握 {item.masteredCount}
                    </p>
                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>个人学习进度</span>
                        <span>
                          {item.learnedCount} / {item.wordCount}（{percent}%）
                        </span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <CreateWordListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(list: VocabListSummary) => {
          void loadLists();
          setSelectedId(list.id);
        }}
      />
    </div>
  );
};

export default WordListsPage;
