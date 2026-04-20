import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSupplier } from "./api";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSuccess?: () => void;
}

export function SupplierForm({ onSuccess }: Props) {
  const [form, setForm] = useState({
    name: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    notes: "",
  });
  const create = useCreateSupplier();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact_phone.trim()) {
      toast({ title: "Faltan datos", description: "Nombre y teléfono son obligatorios.", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        contact_phone: form.contact_phone.trim(),
        contact_email: form.contact_email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast({ title: "Proveedor creado" });
      setForm({ name: "", contact_phone: "", contact_email: "", address: "", notes: "" });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error al crear", description: err.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sup-name">Nombre *</Label>
          <Input id="sup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sup-phone">Teléfono (WhatsApp) *</Label>
          <Input
            id="sup-phone"
            type="tel"
            placeholder="+52 55 1234 5678"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sup-email">Email</Label>
          <Input id="sup-email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sup-address">Dirección</Label>
          <Input id="sup-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sup-notes">Notas</Label>
        <Textarea id="sup-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
        {create.isPending ? "Guardando..." : "Crear proveedor"}
      </Button>
    </form>
  );
}
