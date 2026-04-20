-- Tabla para valores de configuración global (Impresión y Planchado)
CREATE TABLE public.global_configs (
    id TEXT PRIMARY KEY,
    value NUMERIC NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.global_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_global_configs"
ON public.global_configs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_global_configs_updated_at
BEFORE UPDATE ON public.global_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.global_configs (id, value) VALUES
  ('printing_cost_per_meter', 45000),
  ('ironing_cost', 1500)
ON CONFLICT (id) DO NOTHING;

-- Añadir campos al producto para costo dinámico y estructura
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS base_color TEXT,
  ADD COLUMN IF NOT EXISTS print_color TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS print_height_cm NUMERIC NOT NULL DEFAULT 0;

-- Default aging 30 días para nuevos productos
ALTER TABLE public.products ALTER COLUMN aging_days SET DEFAULT 30;