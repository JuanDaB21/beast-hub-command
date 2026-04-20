import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/* ---------------- Types ---------------- */

export type WorkOrderStatus = "pending" | "in_progress" | "completed" | "cancelled";

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "completed", label: "Completado" },
  { value: "cancelled", label: "Cancelado" },
];

export interface WorkOrder {
  id: string;
  batch_number: string;
  status: WorkOrderStatus;
  notes: string | null;
  target_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderItemRow {
  id: string;
  work_order_id: string;
  product_id: string;
  quantity_to_produce: number;
  is_dtf_added: boolean;
  product: { id: string; sku: string; name: string } | null;
}

export interface WorkOrderWithItems extends WorkOrder {
  items: WorkOrderItemRow[];
}

export interface ProductMaterial {
  id: string;
  product_id: string;
  raw_material_id: string;
  quantity_required: number;
  raw_material?: {
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    unit_of_measure: string;
    supplier_id?: string | null;
  } | null;
}

const QK_WO = ["work_orders"] as const;
const QK_BOM = (productId: string) => ["product_materials", productId] as const;

/* ---------------- Work Orders ---------------- */

export function useWorkOrders() {
  return useQuery({
    queryKey: QK_WO,
    queryFn: async (): Promise<WorkOrderWithItems[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          items:work_order_items (
            id, work_order_id, product_id, quantity_to_produce, is_dtf_added,
            product:products ( id, sku, name )
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderWithItems[];
    },
  });
}

export interface NewWorkOrderItemInput {
  product_id: string;
  quantity_to_produce: number;
}

export interface NewWorkOrderInput {
  notes?: string | null;
  target_date?: string | null;
  items: NewWorkOrderItemInput[];
}

function generateBatchNumber() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LOT-${yyyymmdd}-${rand}`;
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewWorkOrderInput): Promise<WorkOrder> => {
      if (!input.items.length) throw new Error("Agrega al menos un producto al lote");

      const batch_number = generateBatchNumber();
      const { data: wo, error } = await supabase
        .from("work_orders")
        .insert({
          batch_number,
          status: "pending",
          notes: input.notes ?? null,
          target_date: input.target_date ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;

      const itemsPayload = input.items.map((it) => ({
        work_order_id: wo.id,
        product_id: it.product_id,
        quantity_to_produce: it.quantity_to_produce,
      }));
      const { error: itemsError } = await supabase.from("work_order_items").insert(itemsPayload);
      if (itemsError) {
        // rollback parcial
        await supabase.from("work_orders").delete().eq("id", wo.id);
        throw itemsError;
      }
      return wo as WorkOrder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useUpdateWorkOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WorkOrderStatus }) => {
      const patch: { status: WorkOrderStatus; started_at?: string } = { status };
      if (status === "in_progress") patch.started_at = new Date().toISOString();
      const { error } = await supabase.from("work_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useCompleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "complete_work_order",
        { _work_order_id: id },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_WO });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

/* ---------------- Recetas (BOM) ---------------- */

export function useProductMaterials(productId: string | null) {
  return useQuery({
    queryKey: productId ? QK_BOM(productId) : ["product_materials", "none"],
    enabled: !!productId,
    queryFn: async (): Promise<ProductMaterial[]> => {
      const { data, error } = await supabase
        .from("product_materials")
        .select(`
          id, product_id, raw_material_id, quantity_required,
          raw_material:raw_materials ( id, name, sku, stock, unit_of_measure, supplier_id )
        `)
        .eq("product_id", productId!);
      if (error) throw error;
      return (data ?? []) as unknown as ProductMaterial[];
    },
  });
}

export function useProductMaterialsBatch(productIds: string[]) {
  const key = [...productIds].sort().join(",");
  return useQuery({
    queryKey: ["product_materials_batch", key],
    enabled: productIds.length > 0,
    queryFn: async (): Promise<ProductMaterial[]> => {
      const { data, error } = await supabase
        .from("product_materials")
        .select(`
          id, product_id, raw_material_id, quantity_required,
          raw_material:raw_materials ( id, name, sku, stock, unit_of_measure, supplier_id )
        `)
        .in("product_id", productIds);
      if (error) throw error;
      return (data ?? []) as unknown as ProductMaterial[];
    },
  });
}

export function useUpsertProductMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { product_id: string; raw_material_id: string; quantity_required: number }) => {
      const { error } = await supabase
        .from("product_materials")
        .upsert(input, { onConflict: "product_id,raw_material_id" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: QK_BOM(vars.product_id) }),
  });
}

export function useDeleteProductMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; product_id: string }) => {
      const { error } = await supabase.from("product_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: QK_BOM(vars.product_id) }),
  });
}

export function useToggleWorkOrderItemDtf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_dtf_added }: { id: string; is_dtf_added: boolean }) => {
      const { error } = await supabase
        .from("work_order_items")
        .update({ is_dtf_added })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}
