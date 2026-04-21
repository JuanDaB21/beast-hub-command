import { StatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppContactButton } from "@/components/shared/WhatsAppContactButton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUSES, PAYMENT_METHOD_LABEL, type OrderWithItems, type OrderStatus } from "./api";
import { STATUS_LABEL, statusTone } from "./status";

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

interface Props {
  order: OrderWithItems;
  onChangeStatus: (status: OrderStatus) => void;
  onConfirmCod: (confirmed: boolean) => void;
  onDelete: () => void;
}

export function OrderDetails({ order, onChangeStatus, onConfirmCod, onDelete }: Props) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(order.status)} label={STATUS_LABEL[order.status]} />
        {order.is_cod && (
          <StatusBadge
            tone={order.cod_confirmed ? "green" : "red"}
            label={order.cod_confirmed ? "COD confirmado" : "COD pendiente"}
          />
        )}
        {order.payment_method && (
          <StatusBadge tone="neutral" label={`Pago: ${PAYMENT_METHOD_LABEL[order.payment_method]}`} />
        )}
        <span className="ml-auto rounded-md bg-secondary px-2 py-0.5 text-xs uppercase text-secondary-foreground">
          {order.source}
        </span>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Cliente</div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium">{order.customer_name}</div>
            <div className="text-muted-foreground">{order.customer_phone}</div>
          </div>
          <WhatsAppContactButton
            phone={order.customer_phone}
            message={`Hola ${order.customer_name}, te contacto sobre tu pedido ${order.order_number}.`}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Productos</div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">
                    Sin líneas en este pedido.
                  </td>
                </tr>
              ) : (
                order.items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.product?.name ?? "Producto eliminado"}</div>
                      {it.product?.sku && (
                        <div className="font-mono text-xs text-muted-foreground">{it.product.sku}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{currency(Number(it.unit_price))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {currency(it.quantity * Number(it.unit_price))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-3 py-2 text-right text-xs uppercase text-muted-foreground">
                  Total
                </td>
                <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">
                  {currency(Number(order.total))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">Cambiar estado</div>
          <Select value={order.status} onValueChange={(v) => onChangeStatus(v as OrderStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {order.is_cod && (
          <div className="space-y-1">
            <div className="text-xs uppercase text-muted-foreground">Confirmación COD</div>
            <Button
              type="button"
              variant={order.cod_confirmed ? "outline" : "default"}
              className="w-full"
              onClick={() => onConfirmCod(!order.cod_confirmed)}
            >
              {order.cod_confirmed ? "Marcar como no confirmado" : "Confirmar COD"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Eliminar pedido
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Creado: {new Date(order.created_at).toLocaleString("es-MX")} · Actualizado:{" "}
        {new Date(order.updated_at).toLocaleString("es-MX")}
      </div>
    </div>
  );
}
