ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NULL;

CREATE OR REPLACE FUNCTION public.validate_order_payment_method()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_method IS NOT NULL AND NEW.payment_method NOT IN ('fisico','nequi','daviplata','bancolombia') THEN
    RAISE EXCEPTION 'payment_method inválido: %', NEW.payment_method;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_payment_method_trg ON public.orders;
CREATE TRIGGER validate_order_payment_method_trg
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_payment_method();