import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SupplyRequestStatus =
  | "pending"
  | "partial"
  | "confirmed"
  | "receiving"
  | "delivered";

export const SUPPLY_REQUEST_STATUSES: { value: SupplyRequestStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "partial", label: "Parcial" },
  { value: "confirmed", label: "Confirmado" },
  { value: "receiving", label: "En recepción" },
  { value: "delivered", label: "Entregado" },
];

export interface SupplyRequestItem {
  id: string;
  supply_request_id: string;
  raw_material_id: string;
  quantity_requested: number;
  quantity_confirmed: number;
  quantity_received: number;
  received_at: string | null;
  is_available: boolean;
  raw_material: {
    id: string;
    name: string;
    sku: string | null;
    unit_of_measure: string;
  } | null;
}

export interface SupplyRequest {
  id: string;
  supplier_id: string;
  secure_token: string;
  status: SupplyRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier: { id: string; name: string; contact_phone: string } | null;
  items: SupplyRequestItem[];
}

const QK = ["supply_requests"] as const;

export function useSupplyRequests() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<SupplyRequest[]>("/supply-requests"),
  });
}

export interface NewSupplyRequestInput {
  supplier_id: string;
  notes?: string | null;
  items: { raw_material_id: string; quantity_requested: number }[];
}

export function useCreateSupplyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewSupplyRequestInput) =>
      api.post<SupplyRequest>("/supply-requests", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/**
 * Registra cuánto llegó realmente de un ítem. El backend aplica la diferencia
 * contra lo ya recibido y recalcula el estado de la solicitud.
 */
export function useReceiveSupplyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity_received }: { itemId: string; quantity_received: number }) =>
      api.patch<{ ok: true; status: SupplyRequestStatus; quantity_received: number }>(
        `/supply-requests/items/${itemId}/receive`,
        { quantity_received },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

export function useCompleteSupplyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`/supply-requests/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

export function useDeleteSupplyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/supply-requests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

/* ---- Solicitud unificada desde todos los lotes activos ---- */

export interface UnifiedSupplierGroup {
  supplier_id: string;
  supplier_name: string | null;
  total_units: number;
  items: { raw_material_id: string; name: string; quantity_requested: number }[];
}

export interface UnifiedSupplyResult {
  request_ids: string[];
  created: number;
  updated: number;
  total_units: number;
  suppliers: UnifiedSupplierGroup[];
}

/**
 * Recalcula la necesidad total sumando todos los lotes activos (in_progress +
 * pending) y genera una solicitud unificada por proveedor (margen 20%,
 * idempotente). El backend hace todo el cálculo; no lleva payload.
 */
export function useGenerateUnifiedSupply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<UnifiedSupplyResult>("/supply-requests/from-active-lots"),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
