ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by_staff_id uuid NULL REFERENCES public.profiles(id);

-- Backfill: manual orders skip confirmation step
UPDATE public.orders SET order_confirmed = true WHERE source = 'manual' AND order_confirmed = false;
-- Already-collected COD orders are implicitly confirmed
UPDATE public.orders SET order_confirmed = true WHERE cod_confirmed = true AND order_confirmed = false;