import { useMemo, useState } from "react";
import { Plus, X, Copy, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StandardCombobox } from "@/components/shared/StandardCombobox";
import { useProductsForOrder } from "@/features/orders/api";
import { useGlobalConfigs } from "@/features/production/configApi";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface QuoteCalculatorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuoteItem {
  id: string;
  mode: "catalog" | "manual";
  productId: string | null;
  name: string;
  price: number;
  qty: number;
}

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const newItem = (): QuoteItem => ({
  id: crypto.randomUUID(),
  mode: "catalog",
  productId: null,
  name: "",
  price: 0,
  qty: 1,
});

export function QuoteCalculatorSheet({ open, onOpenChange }: QuoteCalculatorSheetProps) {
  const { data: products = [] } = useProductsForOrder();
  const { data: configs } = useGlobalConfigs();
  const defaultCodPct = Number(configs?.cod_transport_fee_percent ?? 5);

  const [items, setItems] = useState<QuoteItem[]>([newItem()]);
  const [shippingOn, setShippingOn] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [codOn, setCodOn] = useState(false);
  const [codPct, setCodPct] = useState(defaultCodPct);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: `${p.name} · ${currency(Number(p.price))}` })),
    [products],
  );

  const updateItem = (id: string, patch: Partial<QuoteItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const onPickProduct = (id: string, productId: string | null) => {
    const product = products.find((p) => p.id === productId);
    updateItem(id, {
      productId,
      name: product?.name ?? "",
      price: Number(product?.price ?? 0),
    });
  };

  const subtotal = items.reduce((acc, it) => acc + it.price * it.qty, 0);
  const shipping = shippingOn ? shippingCost : 0;
  const codFee = codOn ? ((subtotal + shipping) * codPct) / 100 : 0;
  const total = subtotal + shipping + codFee;

  const message = useMemo(() => {
    const validItems = items.filter((it) => it.name && it.qty > 0);
    const lines = validItems.map(
      (it) => `• ${it.qty}x ${it.name} - ${currency(it.price * it.qty)}`,
    );
    const parts = [
      "¡Hola! 🐺 Aquí está el resumen de tu pedido en Beast Club:",
      "",
      ...(lines.length ? lines : ["(sin productos)"]),
      "",
      `Subtotal: ${currency(subtotal)}`,
    ];
    if (shippingOn) parts.push(`Envío: ${currency(shipping)}`);
    if (codOn) parts.push(`Comisión COD (${codPct}%): ${currency(codFee)}`);
    parts.push(`Total a pagar: ${currency(total)}`);
    return parts.join("\n");
  }, [items, subtotal, shipping, shippingOn, codFee, codOn, codPct, total]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Copiado", description: "Mensaje listo para pegar en WhatsApp." });
    } catch {
      toast({ title: "Error", description: "No se pudo copiar al portapapeles.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setItems([newItem()]);
    setShippingOn(false);
    setShippingCost(0);
    setCodOn(false);
    setCodPct(defaultCodPct);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Calculadora de cotización</SheetTitle>
          <SheetDescription>
            Cálculos efímeros · no se guarda en la base de datos
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Productos</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, newItem()])}>
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
            {items.map((it, idx) => (
              <Card key={it.id}>
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Línea {idx + 1}</span>
                    {items.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(it.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Tabs
                    value={it.mode}
                    onValueChange={(v) =>
                      updateItem(it.id, { mode: v as "catalog" | "manual", productId: null, name: "", price: 0 })
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="catalog">Catálogo</TabsTrigger>
                      <TabsTrigger value="manual">Manual</TabsTrigger>
                    </TabsList>
                    <TabsContent value="catalog" className="mt-3">
                      <StandardCombobox
                        options={productOptions}
                        value={it.productId}
                        onChange={(v) => onPickProduct(it.id, v)}
                        placeholder="Buscar producto..."
                        searchPlaceholder="Buscar por nombre"
                      />
                    </TabsContent>
                    <TabsContent value="manual" className="mt-3 space-y-2">
                      <Input
                        placeholder="Nombre del producto"
                        value={it.name}
                        onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Precio unitario"
                        value={it.price || ""}
                        onChange={(e) => updateItem(it.id, { price: Number(e.target.value) || 0 })}
                      />
                    </TabsContent>
                  </Tabs>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => updateItem(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </div>
                    <div className="flex flex-col items-end justify-end">
                      <span className="text-xs text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">{currency(it.price * it.qty)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Shipping */}
          <Card>
            <CardContent className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="shipping-switch" className="text-sm font-medium">¿Aplica envío?</Label>
                <Switch id="shipping-switch" checked={shippingOn} onCheckedChange={setShippingOn} />
              </div>
              {shippingOn && (
                <Input
                  type="number"
                  min={0}
                  placeholder="Costo de envío"
                  value={shippingCost || ""}
                  onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
                />
              )}
            </CardContent>
          </Card>

          {/* COD */}
          <Card>
            <CardContent className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="cod-switch" className="text-sm font-medium">¿Pago Contra Entrega (COD)?</Label>
                <Switch id="cod-switch" checked={codOn} onCheckedChange={setCodOn} />
              </div>
              {codOn && (
                <div>
                  <Label className="text-xs text-muted-foreground">Comisión transportadora (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={codPct}
                    onChange={(e) => setCodPct(Number(e.target.value) || 0)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-muted/40">
            <CardContent className="space-y-2 p-4 text-sm">
              <Row label="Subtotal" value={currency(subtotal)} />
              {shippingOn && <Row label="Envío" value={currency(shipping)} />}
              {codOn && <Row label={`Comisión COD (${codPct}%)`} value={currency(codFee)} />}
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span className="text-base font-semibold">Total a pagar</span>
                <span className="text-lg font-bold text-primary">{currency(total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp message */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Mensaje para WhatsApp</Label>
            <Textarea readOnly value={message} className="min-h-[180px] font-mono text-xs" />
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex gap-2 border-t bg-background p-4">
          <Button type="button" variant="outline" onClick={handleReset} className="flex-1">
            <RotateCcw className="mr-2 h-4 w-4" /> Limpiar
          </Button>
          <Button type="button" onClick={handleCopy} className="flex-[2]">
            <Copy className="mr-2 h-4 w-4" /> Copiar para WhatsApp
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
