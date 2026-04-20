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

/* ---------- Auto-supply for production shortages ---------- */

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

/**
 * Given a list of shortages (per raw_material), groups them by supplier and
 * creates ONE pending supply_request per supplier with all shortage items.
 * If a pending/partial request for the same supplier already exists, it
 * appends/updates its items instead of creating a duplicate, to avoid
 * saturating the supplier.
 *
 * Quantity requested = ceil(missing * 1.2) for a 20% safety margin.
 */
export function useAutoSupplyShortages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shortages: ShortageInput[]): Promise<AutoSupplyResult> => {
      if (!shortages.length) throw new Error("No hay faltantes que solicitar");

      const bySupplier = new Map<string, ShortageInput[]>();
      for (const s of shortages) {
        if (!s.supplier_id) continue;
        const list = bySupplier.get(s.supplier_id) ?? [];
        list.push(s);
        bySupplier.set(s.supplier_id, list);
      }

      const result: AutoSupplyResult = {
        request_ids: [],
        created: 0,
        updated: 0,
        total_units: 0,
      };

      for (const [supplier_id, items] of bySupplier) {
        const { data: existing, error: existErr } = await supabase
          .from("supply_requests")
          .select("id, status")
          .eq("supplier_id", supplier_id)
          .in("status", ["pending", "partial"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existErr) throw existErr;

        let requestId: string;
        if (existing?.id) {
          requestId = existing.id;
          result.updated += 1;
        } else {
          const { data: created, error: createErr } = await supabase
            .from("supply_requests")
            .insert({
              supplier_id,
              status: "pending",
              notes: "Generada automáticamente desde producción",
            })
            .select("id")
            .single();
          if (createErr) throw createErr;
          requestId = created.id;
          result.created += 1;
        }
        result.request_ids.push(requestId);

        const { data: existingItems, error: itemsErr } = await supabase
          .from("supply_request_items")
          .select("id, raw_material_id, quantity_requested")
          .eq("supply_request_id", requestId);
        if (itemsErr) throw itemsErr;
        const existingByRm = new Map<string, { id: string; quantity_requested: number }>(
          (existingItems ?? []).map((it) => [
            it.raw_material_id,
            { id: it.id, quantity_requested: Number(it.quantity_requested) },
          ]),
        );

        for (const item of items) {
          const suggestedQty = Math.ceil(item.missing * 1.2);
          result.total_units += suggestedQty;
          const prev = existingByRm.get(item.raw_material_id);
          if (prev) {
            if (suggestedQty > prev.quantity_requested) {
              const { error: updErr } = await supabase
                .from("supply_request_items")
                .update({ quantity_requested: suggestedQty })
                .eq("id", prev.id);
              if (updErr) throw updErr;
            }
          } else {
            const { error: insErr } = await supabase
              .from("supply_request_items")
              .insert({
                supply_request_id: requestId,
                raw_material_id: item.raw_material_id,
                quantity_requested: suggestedQty,
              });
            if (insErr) throw insErr;
          }
        }
      }

      return result;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
