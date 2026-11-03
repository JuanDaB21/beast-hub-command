import { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

/** Detalle de una entidad: hoja inferior arrastrable en móvil, panel lateral en desktop. */
export function DetailPanel({ open, onOpenChange, title, description, children }: DetailPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[92svh] max-h-[92svh]">
          <div className="flex h-full w-full flex-col overflow-hidden">
            <DrawerHeader className="shrink-0 text-left">
              <DrawerTitle className="font-display text-2xl leading-none">{title}</DrawerTitle>
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-12 text-left">
          <SheetTitle className="font-display text-3xl leading-none">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
