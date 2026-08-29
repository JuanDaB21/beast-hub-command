import { useState } from "react";
import { ExternalLink, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  usePrintDesignTree,
  useDeletePrintDesign,
  type PrintDesign,
} from "./api";
import { DesignDialog } from "./DesignDialog";

export function PrintDesignsTable() {
  const { roots, isLoading } = usePrintDesignTree();
  const remove = useDeletePrintDesign();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<(PrintDesign & { editing: true }) | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const openNew = (parentId: string | null = null) => {
    setEditing(null);
    setDefaultParentId(parentId);
    setDialogOpen(true);
  };

  const openEdit = (d: PrintDesign) => {
    setEditing({ ...d, editing: true });
    setDefaultParentId(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Las variantes con este estampado quedarán sin FK.`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Estampado eliminado");
    } catch (err) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Catálogo de Estampados</h2>
          <p className="text-xs text-muted-foreground">
            Agrupa el mismo diseño en varios colores con un estampado padre. Se usan al crear
            variantes y generan BOM de tinta automáticamente.
          </p>
        </div>
        <Button size="sm" onClick={() => openNew(null)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo estampado
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <Palette className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay estampados. Crea el primero para asociarlo a las variantes de producto.
          </p>
          <Button onClick={() => openNew(null)}>
            <Plus className="h-4 w-4 mr-1" /> Crear estampado
          </Button>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2 hidden sm:table-cell">Color</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Tinta RM</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">g/cm</th>
                <th className="text-left px-3 py-2">DTF</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {roots.map((root) => (
                <DesignRows
                  key={root.id}
                  root={root}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onAddChild={(parentId) => openNew(parentId)}
                  removePending={remove.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DesignDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editing}
        defaultParentId={defaultParentId}
      />
    </div>
  );
}

function DesignRows({
  root,
  onEdit,
  onDelete,
  onAddChild,
  removePending,
}: {
  root: PrintDesign & { children: PrintDesign[] };
  onEdit: (d: PrintDesign) => void;
  onDelete: (id: string, name: string) => void;
  onAddChild: (parentId: string) => void;
  removePending: boolean;
}) {
  return (
    <>
      <DesignRow
        d={root}
        isParent
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        removePending={removePending}
      />
      {root.children.map((child) => (
        <DesignRow
          key={child.id}
          d={child}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          removePending={removePending}
        />
      ))}
    </>
  );
}

function DesignRow({
  d,
  isParent = false,
  onEdit,
  onDelete,
  onAddChild,
  removePending,
}: {
  d: PrintDesign;
  isParent?: boolean;
  onEdit: (d: PrintDesign) => void;
  onDelete: (id: string, name: string) => void;
  onAddChild: (parentId: string) => void;
  removePending: boolean;
}) {
  const indented = !!d.parent_design_id;
  return (
    <tr className="hover:bg-muted/20">
      <td className={`px-3 py-2 font-medium ${indented ? "pl-8 text-muted-foreground" : ""}`}>
        {indented && <span className="text-muted-foreground mr-1">↳</span>}
        {d.name}
      </td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-5 w-5 rounded-full border border-border"
            style={{ backgroundColor: d.hex_code }}
          />
          <span className="font-mono text-xs text-muted-foreground">{d.hex_code}</span>
        </div>
      </td>
      <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
        {d.ink_raw_material?.name ?? <span className="italic text-xs">Sin tinta</span>}
      </td>
      <td className="px-3 py-2 hidden md:table-cell tabular-nums">
        {d.ink_raw_material ? d.ink_grams_per_cm : "—"}
      </td>
      <td className="px-3 py-2">
        {d.drive_url ? (
          <a
            href={d.drive_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        {d.active ? (
          <Badge variant="outline" className="bg-status-green/15 text-status-green border-status-green/30 text-xs">
            Activo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Inactivo
          </Badge>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          {isParent && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onAddChild(d.id)}
              aria-label="Agregar color"
              title="Agregar color"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onEdit(d)} aria-label="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(d.id, d.name)}
            disabled={removePending}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
