-- 自然语言微调（refine）：GenerationTask 增加 mode 列（create | refine）。
ALTER TABLE "GenerationTask" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'create';
