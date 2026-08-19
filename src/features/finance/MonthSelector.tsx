import { addMonths, format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Primer día del mes seleccionado. */
  month: Date;
  onChange: (month: Date) => void;
}

export function MonthSelector({ month, onChange }: Props) {
  const isCurrentMonth =
    startOfMonth(month).getTime() >= startOfMonth(new Date()).getTime();

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[180px] text-center text-lg font-semibold capitalize">
        {format(month, "MMMM yyyy", { locale: es })}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={isCurrentMonth}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
