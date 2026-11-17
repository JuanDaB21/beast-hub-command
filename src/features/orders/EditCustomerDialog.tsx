import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CityCombobox } from "@/components/shared/CityCombobox";
import { DANE_CITIES, type DaneCity } from "@/lib/daneCities";
import { toast } from "@/hooks/use-toast";
import { useUpdateOrderCustomer, type OrderWithItems } from "./api";

interface Props {
  order: OrderWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const findCity = (code: string | null | undefined) =>
  code ? DANE_CITIES.find((c) => c.dane_code === code) ?? null : null;

/** Corrige nombre, teléfono, dirección y ciudad del cliente de un pedido. */
export function EditCustomerDialog({ order, open, onOpenChange }: Props) {
  const update = useUpdateOrderCustomer();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState<DaneCity | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(order.customer_name ?? "");
    setPhone(order.customer_phone ?? "");
    setAddress(order.customer_address ?? "");
    setCity(findCity(order.customer_city_dane_code));
    // Solo al abrir: un refetch del pedido no debe pisar lo que se está editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id]);

  // Pedidos de Shopify traen la ciudad como texto libre, sin código DANE: si no
  // se elige otra, se conserva tal cual.
  const legacyCity = !findCity(order.customer_city_dane_code) ? order.customer_city : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Faltan datos", description: "Nombre y teléfono son obligatorios.", variant: "destructive" });
      return;
    }
    try {
      await update.mutateAsync({
        id: order.id,
        patch: {
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_address: address.trim() || null,
          customer_city: city ? city.name : order.customer_city ?? null,
          customer_city_dane_code: city ? city.dane_code : legacyCity ? null : order.customer_city_dane_code ?? null,
        },
      });
      toast({ title: "Cliente actualizado" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error al guardar", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Pedido {order.order_number}</DialogDescription>
        </DialogHeader>
        <form id="edit-customer" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ec-name">Cliente *</Label>
            <Input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-phone">Teléfono (WhatsApp) *</Label>
            <Input id="ec-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-address">Dirección</Label>
            <Input
              id="ec-address"
              placeholder="Calle, número, barrio…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ciudad</Label>
            <CityCombobox value={city} onChange={setCity} placeholder={legacyCity ?? undefined} />
            {legacyCity && !city && (
              <p className="text-xs text-muted-foreground">
                Ciudad actual sin código DANE: «{legacyCity}». Se conserva si no eliges otra.
              </p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-customer" disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
