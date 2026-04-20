import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppContactButtonProps {
  phone: string;
  message?: string;
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}

/** Sanitiza el teléfono y abre wa.me/. Reusable en cualquier vista de cliente o proveedor. */
export function WhatsAppContactButton({
  phone,
  message,
  label = "WhatsApp",
  size = "sm",
  variant = "outline",
  className,
}: WhatsAppContactButtonProps) {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;

  const url = `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

  return (
    <Button
      asChild
      size={size}
      variant={variant}
      className={cn("gap-2", className)}
    >
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp con ${phone}`}>
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && <span>{label}</span>}
      </a>
    </Button>
  );
}
