ALTER TABLE public.work_order_items 
ADD COLUMN IF NOT EXISTS is_dtf_added BOOLEAN NOT NULL DEFAULT false;