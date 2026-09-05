import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VocabListSummary } from '@shared/api.interface';
import { createList } from '@client/src/api/vocab';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { createListSchema, type CreateListFormData } from './word-forms';

interface CreateWordListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (list: VocabListSummary) => void;
}

const CreateWordListDialog: React.FC<CreateWordListDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const form = useForm<CreateListFormData>({
    resolver: zodResolver(createListSchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (open) form.reset({ name: '', description: '' });
  }, [open, form]);

  const handleSubmit = form.handleSubmit(async (data: CreateListFormData) => {
    const name: string = data.name.trim();
    const description: string = data.description.trim();
    try {
      const list: VocabListSummary = await createList(
        description ? { name, description } : { name },
      );
      toast.success(`词表「${list.name}」创建成功`);
      onOpenChange(false);
      onCreated(list);
    } catch (err: unknown) {
      logger.error('创建词表失败', err);
      toast.error('创建词表失败，请稍后重试');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle>新建词表</DialogTitle>
          <DialogDescription>创建一个自定义词表，添加你自己的单词。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    名称 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="例如：我的旅行词汇" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述（选填）</FormLabel>
                  <FormControl>
                    <Input placeholder="词表描述，可不填" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                创建
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWordListDialog;
