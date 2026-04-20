// Edge function pública para el portal del proveedor.
// Acceso por token (UUID en URL). Usa SERVICE ROLE para puentear RLS de forma segura.
// Endpoints:
//   GET  ?token=<uuid>                 -> devuelve la solicitud + items + supplier
//   POST { token, items: [{id, quantity_confirmed, is_available}], notes? } -> guarda y recalcula status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token || !UUID_RE.test(token)) return json({ error: "Token inválido" }, 400);

      const { data: request, error } = await supabase
        .from("supply_requests")
        .select(
          `id, status, notes, created_at, updated_at, supplier_id,
           supplier:suppliers ( id, name, contact_phone ),
           items:supply_request_items (
             id, raw_material_id, quantity_requested, quantity_confirmed, is_available,
             raw_material:raw_materials ( id, name, sku, unit_of_measure )
           )`,
        )
        .eq("secure_token", token)
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!request) return json({ error: "Solicitud no encontrada" }, 404);

      return json({ request });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as
        | { token?: string; items?: Array<{ id: string; quantity_confirmed: number; is_available: boolean }>; notes?: string }
        | null;

      if (!body?.token || !UUID_RE.test(body.token)) return json({ error: "Token inválido" }, 400);
      if (!Array.isArray(body.items)) return json({ error: "Items inválidos" }, 400);

      const { data: request, error: reqErr } = await supabase
        .from("supply_requests")
        .select("id, status")
        .eq("secure_token", body.token)
        .maybeSingle();
      if (reqErr) return json({ error: reqErr.message }, 500);
      if (!request) return json({ error: "Solicitud no encontrada" }, 404);
      if (request.status === "delivered") {
        return json({ error: "Esta solicitud ya fue entregada" }, 409);
      }

      // Items existentes para validar IDs
      const { data: existing, error: exErr } = await supabase
        .from("supply_request_items")
        .select("id, quantity_requested")
        .eq("supply_request_id", request.id);
      if (exErr) return json({ error: exErr.message }, 500);

      const validIds = new Set((existing ?? []).map((i) => i.id));

      // Update item por item (volúmenes pequeños, pocos insumos por solicitud)
      for (const it of body.items) {
        if (!validIds.has(it.id)) continue;
        const qty = Math.max(0, Number(it.quantity_confirmed) || 0);
        const available = !!it.is_available;
        const { error: upErr } = await supabase
          .from("supply_request_items")
          .update({
            quantity_confirmed: available ? qty : 0,
            is_available: available,
          })
          .eq("id", it.id)
          .eq("supply_request_id", request.id);
        if (upErr) return json({ error: upErr.message }, 500);
      }

      // Recalcular status automático
      const { data: refreshed } = await supabase
        .from("supply_request_items")
        .select("quantity_requested, quantity_confirmed, is_available")
        .eq("supply_request_id", request.id);

      const items = refreshed ?? [];
      let nextStatus: "pending" | "partial" | "confirmed" = "pending";
      if (items.length > 0) {
        const allFull = items.every((i) => i.is_available && Number(i.quantity_confirmed) >= Number(i.quantity_requested) && Number(i.quantity_requested) > 0);
        const anyConfirmed = items.some((i) => i.is_available && Number(i.quantity_confirmed) > 0);
        if (allFull) nextStatus = "confirmed";
        else if (anyConfirmed) nextStatus = "partial";
        else nextStatus = "pending";
      }

      const patch: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };
      if (typeof body.notes === "string") patch.notes = body.notes;

      const { error: stErr } = await supabase
        .from("supply_requests")
        .update(patch)
        .eq("id", request.id);
      if (stErr) return json({ error: stErr.message }, 500);

      return json({ ok: true, status: nextStatus });
    }

    return json({ error: "Método no permitido" }, 405);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
