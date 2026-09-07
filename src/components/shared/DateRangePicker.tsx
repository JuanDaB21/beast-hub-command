import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DayPickerProps {
  label: string;
  value: Date | undefined;
  onSelect: (d: Date | undefined) => void;
}

function DayPicker({ label, value, onSelect }: DayPickerProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd MMM yyyy", { locale: es }) : "—"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onSelect}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface Props {
  from: Date | undefined;
  to: Date | undefined;
  /** `to` llega siempre al final del día para que el rango sea inclusivo. */
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

/**
 * Par de calendarios Desde/Hasta. Extraído de FinanceFilters para reutilizarlo
 * en el módulo de pago por prendas vendidas.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  fromLabel = "Desde",
  toLabel = "Hasta",
  className,
}: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <DayPicker label={fromLabel} value={from} onSelect={(d) => onChange({ from: d, to })} />
      <DayPicker
        label={toLabel}
        value={to}
        onSelect={(d) =>
          onChange({ from, to: d ? new Date(d.setHours(23, 59, 59, 999)) : undefined })
        }
      />
    </div>
  );
}
