import { supabase } from "@/integrations/supabase/client";
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
    queryFn: async (): Promise<SupplyRequest[]> => {
      const { data, error } = await supabase
        .from("supply_requests")
        .select(
          `*,
           supplier:suppliers ( id, name, contact_phone ),
           items:supply_request_items (
             id, supply_request_id, raw_material_id, quantity_requested,
             quantity_confirmed, is_available,
             raw_material:raw_materials ( id, name, sku, unit_of_measure )
           )`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupplyRequest[];
    },
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
    mutationFn: async (input: NewSupplyRequestInput): Promise<SupplyRequest> => {
      if (!input.items.length) throw new Error("Agrega al menos una base");

      const { data: req, error } = await supabase
        .from("supply_requests")
        .insert({
          supplier_id: input.supplier_id,
          notes: input.notes ?? null,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;

      const itemsPayload = input.items.map((it) => ({
        supply_request_id: req.id,
        raw_material_id: it.raw_material_id,
        quantity_requested: it.quantity_requested,
      }));
      const { error: itErr } = await supabase.from("supply_request_items").insert(itemsPayload);
      if (itErr) {
        await supabase.from("supply_requests").delete().eq("id", req.id);
        throw itErr;
      }
      return req as unknown as SupplyRequest;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateSupplyRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SupplyRequestStatus }) => {
      const { error } = await supabase.from("supply_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useCompleteSupplyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("complete_supply_request" as any, { _request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      qc.invalidateQueries({ queryKey: ["raw_materials"] });
    },
  });
}

export function useDeleteSupplyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supply_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
