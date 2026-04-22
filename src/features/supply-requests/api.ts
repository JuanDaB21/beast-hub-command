import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SupplyRequestStatus = "pending" | "partial" | "confirmed" | "delivered";

export const SUPPLY_REQUEST_STATUSES: { value: SupplyRequestStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "partial", label: "Parcial" },
  { value: "confirmed", label: "Confirmado" },
  { value: "delivered", label: "Entregado" },
];

export interface SupplyRequestItem {
  id: string;
  supply_request_id: string;
  raw_material_id: string;
  quantity_requested: number;
  quantity_confirmed: number;
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

export function useUpdateSupplyRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupplyRequestStatus }) =>
      api.patch<SupplyRequest>(`/supply-requests/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
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

/* ---- Auto-supply for production shortages ---- */

export interface ShortageInput {
  raw_material_id: string;
  raw_material_name: string;
  supplier_id: string;
  missing: number;
}

export interface AutoSupplyResult {
  request_ids: string[];
  created: number;
  updated: number;
  total_units: number;
}

/** El backend agrupa por proveedor y upserta items con margen del 20%. */
export function useAutoSupplyShortages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shortages: ShortageInput[]) => {
      if (!shortages.length) throw new Error("No hay faltantes que solicitar");
      return api.post<AutoSupplyResult>(
        "/supply-requests/auto-supply",
        shortages.map((s) => ({
          raw_material_id: s.raw_material_id,
          supplier_id: s.supplier_id,
          missing: s.missing,
        })),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
