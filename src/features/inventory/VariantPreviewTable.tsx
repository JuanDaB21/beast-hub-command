import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export interface PreviewRow {
  key: string;
  sku: string;
  name: string;
  variantLabel: string;
  available: boolean;
  existing?: boolean;
}

interface Props {
  rows: PreviewRow[];
}

export function VariantPreviewTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Selecciona color, talla y al menos un estampado para ver las variantes.
      </div>
    );
  }
  const newCount = rows.filter((r) => r.available && !r.existing).length;
  const existingCount = rows.filter((r) => r.existing).length;
  const unavailableCount = rows.filter((r) => !r.available).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Se crearán <span className="font-semibold text-foreground">{newCount}</span> variantes nuevas
          {existingCount > 0 && (
            <span className="text-muted-foreground"> · {existingCount} ya existen</span>
          )}
          {unavailableCount > 0 && (
            <span className="text-status-red"> · {unavailableCount} sin material disponible</span>
          )}
        </span>
      </div>
      <div className="rounded-md border bg-card max-h-72 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Material</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const rowClass = !r.available
                ? "bg-status-red/5"
                : r.existing
                ? "bg-muted/40 text-muted-foreground"
                : "";
              return (
                <TableRow key={r.key} className={rowClass}>
                  <TableCell>
                    {!r.available ? (
                      <XCircle className="h-4 w-4 text-status-red" />
                    ) : r.existing ? (
                      <MinusCircle className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-status-green" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span>{r.name}</span>
                      {r.existing && (
                        <Badge variant="secondary" className="text-xs py-0">
                          Ya existe — omitida
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.available ? r.variantLabel : <StatusBadge tone="red" label="Variante material no existe" />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
