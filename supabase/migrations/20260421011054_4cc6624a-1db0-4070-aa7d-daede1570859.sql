ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_design text NULL;

CREATE INDEX IF NOT EXISTS idx_products_parent_id ON public.products(parent_id);