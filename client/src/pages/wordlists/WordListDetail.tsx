import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import type {
  CreateWordRequest,
  VocabListSummary,
  VocabWordItem,
} from '@shared/api.interface';
import { createWord, deleteList, deleteWord, getWords } from '@client/src/api/vocab';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import {
  createWordSchema,
  getLevelBadgeClass,
  getLevelLabel,
  type CreateWordFormData,
} from './word-forms';

interface WordListDetailProps {
  list: VocabListSummary;
  onBack: () => void;
  onListChanged: () => Promise<void> | void;
  onListDeleted: () => void;
}

const WordListDetail: React.FC<WordListDetailProps> = ({
  list,
  onBack,
  onListChanged,
  onListDeleted,
}) => {
  const [words, setWords] = useState<VocabWordItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [deleteOpen, setDeleteOpen] = useState<boolean>(false);

  const loadWords = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWords(list.id);
      setWords(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载单词列表失败');
    } finally {
      setLoading(false);
    }
  }, [list.id]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadWords();
    await onListChanged();
  }, [loadWords, onListChanged]);

  const handleDeleteWord = async (wordId: string): Promise<void> => {
    try {
      await deleteWord(wordId);
      toast.success('已删除单词');
      await refresh();
    } catch (err: unknown) {
      logger.error('删除单词失败', err);
      toast.error('删除单词失败，请稍后重试');
    }
  };

  const handleDeleteList = async (): Promise<void> => {
    try {
      await deleteList(list.id);
      toast.success(`词表「${list.name}」已删除`);
      setDeleteOpen(false);
      onListDeleted();
    } catch (err: unknown) {
      logger.error('删除词表失败', err);
      toast.error('删除词表失败，请稍后重试');
    }
  };

  const addForm = useForm<CreateWordFormData>({
    resolver: zodResolver(createWordSchema),
    defaultValues: { german: '', chinese: '', phonetic: '', example: '', exampleCn: '' },
  });

  const handleAddWord = addForm.handleSubmit(async (data: CreateWordFormData) => {
    const request: CreateWordRequest = {
      german: data.german.trim(),
      chinese: data.chinese.trim(),
    };
    if (data.phonetic.trim()) request.phonetic = data.phonetic.trim();
    if (data.example.trim()) request.example = data.example.trim();
    if (data.exampleCn.trim()) request.exampleCn = data.exampleCn.trim();
    try {
      await createWord(list.id, request);
      toast.success('单词已添加');
      setAddOpen(false);
      addForm.reset({ german: '', chinese: '', phonetic: '', example: '', exampleCn: '' });
      await refresh();
    } catch (err: unknown) {
      logger.error('添加单词失败', err);
      toast.error('添加单词失败，请稍后重试');
    }
  });

  const columns: TableColumnsType<VocabWordItem> = [
    {
      title: '德语单词',
      dataIndex: 'german',
      width: 160,
      render: (_: unknown, record: VocabWordItem) => (
        <span className="font-semibold text-slate-900">{record.german}</span>
      ),
    },
    {
      title: '音标',
      dataIndex: 'phonetic',
      width: 140,
      render: (_: unknown, record: VocabWordItem) =>
        record.phonetic
          ? <span className="text-slate-500">{record.phonetic}</span>
          : <span className="text-slate-300">—</span>,
    },
    { title: '中文释义', dataIndex: 'chinese', width: 180 },
    {
      title: '例句',
      dataIndex: 'example',
      render: (_: unknown, record: VocabWordItem) =>
        record.example
          ? <span title={record.example} className="block max-w-md truncate text-slate-600">{record.example}</span>
          : <span className="text-slate-300">—</span>,
    },
  ];

  if (!list.isPreset) {
    columns.push({
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 90,
      render: (_: unknown, record: VocabWordItem) => (
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteWord(record.id)}>
          删除
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <h2 className="text-lg font-semibold text-slate-900">{list.name}</h2>
        <Badge variant="outline" className={getLevelBadgeClass(list.level)}>
          {getLevelLabel(list.level)}
        </Badge>
        <span className="text-sm text-slate-500">{list.wordCount} 个单词</span>
        <div className="ml-auto flex gap-2">
          {!list.isPreset && (
            <>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                添加单词
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
                删除词表
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 单词表格 */}
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4">
          {error ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadWords()}>
                重试
              </Button>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={words}
              loading={loading}
              rowKey="id"
              scroll={{ x: 720, y: 500 }}
              pagination={false}
              locale={{ emptyText: '暂无单词' }}
            />
          )}
        </CardContent>
      </Card>

      {/* 添加单词对话框 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>添加单词</DialogTitle>
            <DialogDescription>向「{list.name}」添加一个新单词。</DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={handleAddWord} className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <FormField control={addForm.control} name="german" render={({ field }) => (
                  <FormItem className="min-w-0 flex-1 basis-40">
                    <FormLabel>德语单词 <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="z. B. Hallo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="chinese" render={({ field }) => (
                  <FormItem className="min-w-0 flex-1 basis-40">
                    <FormLabel>中文释义 <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="例：你好" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={addForm.control} name="phonetic" render={({ field }) => (
                <FormItem>
                  <FormLabel>音标（选填）</FormLabel>
                  <FormControl><Input placeholder="例：haˈloː" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addForm.control} name="example" render={({ field }) => (
                <FormItem>
                  <FormLabel>德语例句（选填）</FormLabel>
                  <FormControl><Input placeholder="例：Hallo, wie geht es dir?" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addForm.control} name="exampleCn" render={({ field }) => (
                <FormItem>
                  <FormLabel>例句翻译（选填）</FormLabel>
                  <FormControl><Input placeholder="例：你好，你好吗？" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={addForm.formState.isSubmitting}>添加</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 删除词表确认对话框 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>删除词表</DialogTitle>
            <DialogDescription>
              确定要删除词表「{list.name}」吗？其中的 {list.wordCount} 个单词将一并删除，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={() => void handleDeleteList()}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WordListDetail;
