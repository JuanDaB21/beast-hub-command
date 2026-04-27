import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { searchDaneCities, type DaneCity } from "@/lib/daneCities";

interface Props {
  value: DaneCity | null;
  onChange: (city: DaneCity | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Buscador de ciudades/municipios de Colombia ligado a códigos DANE.
 * Búsqueda tolerante a diacríticos y por múltiples palabras (nombre + departamento).
 */
export function CityCombobox({
  value,
  onChange,
  placeholder = "Seleccionar ciudad",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo(() => searchDaneCities(query, 50), [query]);

  const handleSelect = (city: DaneCity) => {
    onChange(city.dane_code === value?.dane_code ? null : city);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {value ? `${value.name}, ${value.department}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ciudad o departamento..."
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div
          className="max-h-72 touch-pan-y overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          role="listbox"
        >
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Limpiar selección
            </button>
          )}
          {results.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Sin resultados
            </div>
          ) : (
            results.map((c) => {
              const isSelected = value?.dane_code === c.dane_code;
              return (
                <button
                  type="button"
                  key={c.dane_code}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(c)}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    isSelected && "bg-accent/50",
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">
                    <span>{c.name}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {c.department}
                    </span>
                  </span>
                  <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {c.dane_code}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
