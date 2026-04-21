import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Plus, Info } from "lucide-react";
import {
  useCreateManualOrder,
  useProductsForOrder,
  PAYMENT_METHODS,
  type NewOrderItemInput,
  type OrderStatus,
  type PaymentMethod,
} from "./api";
import { useGlobalConfigs } from "@/features/production/configApi";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess?: () => void;
}

interface DraftItem extends NewOrderItemInput {
  uid: string;
}

const currency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function NewOrderForm({ onSuccess }: Props) {
  const { data: products = [], isLoading: loadingProducts } = useProductsForOrder();
  const create = useCreateManualOrder();
  const { data: configs } = useGlobalConfigs();
  const codFeePct = Number(configs?.cod_transport_fee_percent ?? 0);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isCod, setIsCod] = useState(false);
  const [customerPaysShipping, setCustomerPaysShipping] = useState(false);
  const [status] = useState<OrderStatus>("pending");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.sku}`,
      })),
    [products],
  );

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { uid: crypto.randomUUID(), product_id: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const updateItem = (uid: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  };

  const removeItem = (uid: string) => setItems((prev) => prev.filter((it) => it.uid !== uid));

  const onPickProduct = (uid: string, productId: string | null) => {
    if (!productId) {
      updateItem(uid, { product_id: "", unit_price: 0 });
      return;
    }
    const p = products.find((x) => x.id === productId);
    updateItem(uid, {
      product_id: productId,
      unit_price: p ? Number(p.price) : 0,
    });
  };

  const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const codSurcharge = isCod && codFeePct > 0 ? Math.round(subtotal * (codFeePct / 100)) : 0;
  const total = subtotal + codSurcharge;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: "Faltan datos", description: "Nombre y teléfono del cliente son obligatorios.", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Sin productos", description: "Agrega al menos un producto al pedido.", variant: "destructive" });
      return;
    }
    if (items.some((it) => !it.product_id || it.quantity <= 0)) {
      toast({ title: "Líneas inválidas", description: "Cada línea requiere producto y cantidad > 0.", variant: "destructive" });
      return;
    }
    if (!paymentMethod) {
      toast({ title: "Método de pago", description: "Selecciona un método de pago.", variant: "destructive" });
      return;
    }

    try {
      const itemsPayload: NewOrderItemInput[] = items.map(({ uid, ...rest }) => rest);
      // Inyecta línea virtual de comisión COD para que recalc_order_total la considere
      if (isCod && codSurcharge > 0) {
        itemsPayload.push({ product_id: "", quantity: 1, unit_price: codSurcharge });
      }
      await create.mutateAsync({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        is_cod: isCod,
        customer_pays_shipping: customerPaysShipping,
        status,
        payment_method: paymentMethod,
        items: itemsPayload,
      });
      toast({ title: "Pedido creado" });
      setCustomerName("");
      setCustomerPhone("");
      setIsCod(false);
      setCustomerPaysShipping(false);
      setPaymentMethod("");
      setItems([]);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error al crear pedido", description: err.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="o-name">Cliente *</Label>
          <Input id="o-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-phone">Teléfono (WhatsApp) *</Label>
          <Input
            id="o-phone"
            type="tel"
            placeholder="+52 55 1234 5678"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="o-cod" className="text-sm">Pago contra entrega (COD)</Label>
          <p className="text-xs text-muted-foreground">Marcará el pedido para confirmación posterior.</p>
        </div>
        <Switch id="o-cod" checked={isCod} onCheckedChange={setIsCod} />
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="o-cps" className="text-sm">El cliente asume el costo de envío</Label>
          <p className="text-xs text-muted-foreground">No se sumará como gasto al despachar.</p>
        </div>
        <Switch id="o-cps" checked={customerPaysShipping} onCheckedChange={setCustomerPaysShipping} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="o-pm">Método de pago *</Label>
        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
          <SelectTrigger id="o-pm">
            <SelectValue placeholder="Selecciona método de pago" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((pm) => (
              <SelectItem key={pm.value} value={pm.value}>
                {pm.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Productos</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={loadingProducts}>
            <Plus className="mr-1 h-4 w-4" /> Agregar línea
          </Button>
        </div>

        {items.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            {loadingProducts ? "Cargando productos..." : "Aún no agregas productos al pedido."}
          </div>
        )}

        <div className="space-y-2">
          {items.map((it) => {
            const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
            return (
              <div key={it.uid} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_90px_120px_auto] sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Producto</Label>
                  <StandardCombobox
                    options={productOptions}
                    value={it.product_id || null}
                    onChange={(v) => onPickProduct(it.uid, v)}
                    placeholder="Seleccionar producto"
                    allowClear={false}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) => updateItem(it.uid, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio unit.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={it.unit_price}
                    onChange={(e) => updateItem(it.uid, { unit_price: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <span className="text-xs text-muted-foreground sm:text-right">
                    {currency(lineTotal)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(it.uid)}
                    aria-label="Eliminar línea"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 rounded-md bg-muted/40 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal productos</span>
          <span className="tabular-nums">{currency(subtotal)}</span>
        </div>
        {isCod && codSurcharge > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              Comisión transportadora COD ({codFeePct}%)
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Esta comisión la cobra la transportadora al cliente en envíos contra entrega.
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="tabular-nums">{currency(codSurcharge)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-medium">{isCod ? "Total a cobrar al cliente" : "Total estimado"}</span>
          <span className="text-lg font-semibold tabular-nums">{currency(total)}</span>
        </div>
      </div>

      <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
        {create.isPending ? "Creando..." : "Crear pedido"}
      </Button>
    </form>
  );
}
