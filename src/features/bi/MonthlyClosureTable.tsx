import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

interface Row {
  month: string;
  shopify: number;
  manual: number;
  cogs: number;
  margin: number;
}

export function MonthlyClosureTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Aún no hay datos suficientes para el cierre mensual.
      </Card>
    );
  }

  const fmtMonth = (m: string) => {
    const [y, mm] = m.split("-");
    const d = new Date(Number(y), Number(mm) - 1, 1);
    return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4">
        <h3 className="text-sm font-semibold">Cierre Mensual Analítico</h3>
        <p className="text-xs text-muted-foreground">
          Últimos 6 meses · ingresos por canal vs. costo de bases
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mes</TableHead>
              <TableHead className="text-right">Shopify</TableHead>
              <TableHead className="text-right">WhatsApp</TableHead>
              <TableHead className="text-right">Total ingresos</TableHead>
              <TableHead className="text-right">Costo bases</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const total = r.shopify + r.manual;
              const pct = total > 0 ? (r.margin / total) * 100 : 0;
              const positive = r.margin >= 0;
              return (
                <TableRow key={r.month}>
                  <TableCell className="font-medium capitalize">{fmtMonth(r.month)}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency(r.shopify)}</TableCell>
                  <TableCell className="text-right tabular-nums">{currency(r.manual)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {currency(total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    -{currency(r.cogs)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${
                      positive ? "text-status-green" : "text-status-red"
                    }`}
                  >
                    {currency(r.margin)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      positive ? "text-status-green" : "text-status-red"
                    }`}
                  >
                    {pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
