import type { ReactNode } from "react";
import { toast as sonner } from "sonner";

// Adaptador del API shadcn `toast({ title, description, variant })` sobre Sonner,
// para tener un solo Toaster en la app sin reescribir los ~85 llamados existentes.
type ToastInput = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

function toast({ title, description, variant, duration }: ToastInput) {
  const opts = { description, duration };
  const id = variant === "destructive" ? sonner.error(title, opts) : sonner(title, opts);
  return { id, dismiss: () => sonner.dismiss(id) };
}

function useToast() {
  return { toast, dismiss: (id?: string | number) => sonner.dismiss(id) };
}

export { useToast, toast };
