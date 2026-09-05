import { z } from 'zod';

// ===== 新建词表 =====

export const createListSchema = z.object({
  name: z.string().min(1, '词表名称不能为空').max(50, '名称不能超过 50 字'),
  description: z.string().max(200, '描述不能超过 200 字'),
});

export type CreateListFormData = z.infer<typeof createListSchema>;

// ===== 添加单词 =====

export const createWordSchema = z.object({
  german: z.string().min(1, '德语单词不能为空').max(80, '单词过长'),
  chinese: z.string().min(1, '中文释义不能为空').max(120, '释义过长'),
  phonetic: z.string().max(80, '音标过长'),
  example: z.string().max(400, '例句过长'),
  exampleCn: z.string().max(400, '例句翻译过长'),
});

export type CreateWordFormData = z.infer<typeof createWordSchema>;

// ===== 级别徽标样式 =====

const LEVEL_BADGE_CLASS: Record<string, string> = {
  a1: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  a2: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  b1: 'bg-indigo-600 text-white border-indigo-600',
  custom: 'bg-slate-100 text-slate-600 border-slate-300',
};

const LEVEL_LABEL: Record<string, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  custom: '自定义',
};

export function getLevelBadgeClass(level: string): string {
  return LEVEL_BADGE_CLASS[level] ?? LEVEL_BADGE_CLASS.custom;
}

export function getLevelLabel(level: string): string {
  return LEVEL_LABEL[level] ?? level.toUpperCase();
}
