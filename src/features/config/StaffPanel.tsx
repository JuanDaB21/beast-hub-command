import { useEffect, useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Pencil, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateStaff,
  useStaff,
  useUpdateStaff,
  type StaffProfile,
} from "@/features/staff/api";

const staffSchema = z.object({
  full_name: z.string().trim().min(2, "Nombre demasiado corto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

export function StaffPanel() {
  const { data: staff, isLoading } = useStaff();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<StaffProfile | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Trabajadores con acceso</h2>
          <p className="text-xs text-muted-foreground">Gestiona el staff que opera el sistema.</p>
        </div>
        <Button size="sm" onClick={() => setOpenNew(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Nuevo trabajador
        </Button>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : (staff ?? []).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Aún no hay trabajadores.</p>
            <Button className="mt-4" onClick={() => setOpenNew(true)}>
              <Plus className="mr-2 h-4 w-4" /> Crear trabajador
            </Button>
          </Card>
        ) : (
          (staff ?? []).map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{s.full_name ?? "(Sin nombre)"}</h3>
                    {s.active ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{s.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Creado el {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <NewStaffDialog open={openNew} onOpenChange={setOpenNew} />
      <EditStaffDialog staff={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function NewStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateStaff();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setShowPwd(false);
  };

  const submit = () => {
    const parsed = staffSchema.safeParse({ full_name: fullName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Datos inválidos");
      return;
    }
    create.mutate(
      { full_name: parsed.data.full_name, email: parsed.data.email, password: parsed.data.password },
      {
      onSuccess: () => {
        toast.success("Trabajador creado. Debe verificar su email.");
        reset();
        onOpenChange(false);
      },
      onError: (e: any) => toast.error(e?.message ?? "Error al crear trabajador"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo trabajador</DialogTitle>
          <DialogDescription>Se enviará un correo de verificación.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={72}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({ staff, onClose }: { staff: StaffProfile | null; onClose: () => void }) {
  const update = useUpdateStaff();
  const [fullName, setFullName] = useState(staff?.full_name ?? "");
  const [active, setActive] = useState(staff?.active ?? true);

  useEffect(() => {
    setFullName(staff?.full_name ?? "");
    setActive(staff?.active ?? true);
  }, [staff]);

  if (!staff) return null;

  const submit = () => {
    update.mutate(
      { id: staff.id, full_name: fullName.trim(), active },
      {
        onSuccess: () => {
          toast.success("Trabajador actualizado");
          onClose();
        },
        onError: (e: any) => toast.error(e?.message ?? "Error"),
      },
    );
  };

  return (
    <Dialog open={!!staff} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar trabajador</DialogTitle>
          <DialogDescription>{staff.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Activo</p>
              <p className="text-xs text-muted-foreground">Deshabilita el acceso del trabajador.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
