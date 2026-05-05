import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  is_completed: boolean;
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

/* ---- Work Orders ---- */

export function useWorkOrders() {
  return useQuery({
    queryKey: QK_WO,
    queryFn: () => api.get<WorkOrderWithItems[]>("/work-orders"),
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

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewWorkOrderInput) => api.post<WorkOrder>("/work-orders", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useUpdateWorkOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkOrderStatus }) =>
      api.patch<WorkOrder>(`/work-orders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/work-orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useCompleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`/work-orders/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_WO });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

/* ---- Recetas (BOM) ---- */

export function useProductMaterials(productId: string | null) {
  return useQuery({
    queryKey: productId ? QK_BOM(productId) : ["product_materials", "none"],
    enabled: !!productId,
    queryFn: () =>
      api.get<ProductMaterial[]>("/product-materials", { product_id: productId! }),
  });
}

export function useProductMaterialsBatch(productIds: string[]) {
  const key = [...productIds].sort().join(",");
  return useQuery({
    queryKey: ["product_materials_batch", key],
    enabled: productIds.length > 0,
    queryFn: () =>
      api.get<ProductMaterial[]>("/product-materials", { product_ids: productIds.join(",") }),
  });
}

export function useUpsertProductMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { product_id: string; raw_material_id: string; quantity_required: number }) =>
      api.post<ProductMaterial>("/product-materials", input),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: QK_BOM(vars.product_id) }),
  });
}

export function useDeleteProductMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; product_id: string }) =>
      api.delete<{ ok: true }>(`/product-materials/${id}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: QK_BOM(vars.product_id) }),
  });
}

export function useToggleWorkOrderItemDtf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_dtf_added }: { id: string; is_dtf_added: boolean }) =>
      api.patch(`/work-orders/items/${id}`, { is_dtf_added }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useToggleWorkOrderItemCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_completed }: { id: string; is_completed: boolean }) =>
      api.patch(`/work-orders/items/${id}`, { is_completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useAddWorkOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      work_order_id,
      product_id,
      quantity_to_produce,
    }: {
      work_order_id: string;
      product_id: string;
      quantity_to_produce: number;
    }) =>
      api.post<WorkOrderItemRow>(`/work-orders/${work_order_id}/items`, {
        product_id,
        quantity_to_produce,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useRemoveWorkOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/work-orders/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}

export function useUpdateWorkOrderItemQty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity_to_produce }: { id: string; quantity_to_produce: number }) =>
      api.patch<WorkOrderItemRow>(`/work-orders/items/${id}`, { quantity_to_produce }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_WO }),
  });
}
