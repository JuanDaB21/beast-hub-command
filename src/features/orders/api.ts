import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type OrderSource = "manual" | "shopify";
export type PaymentMethod = "fisico" | "nequi" | "daviplata" | "bancolombia";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "fisico", label: "Físico" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "bancolombia", label: "Bancolombia" },
];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  fisico: "Físico",
  nequi: "Nequi",
  daviplata: "Daviplata",
  bancolombia: "Bancolombia",
};

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "processing", label: "En proceso" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];

/** Estados del pipeline activo (tablero Kanban). */
export const BOARD_STATUSES = ORDER_STATUSES.filter((s) =>
  ["pending", "processing", "shipped"].includes(s.value),
);
/** Estados terminales (tabla de historial paginada). */
export const HISTORY_STATUSES = ORDER_STATUSES.filter((s) =>
  ["delivered", "cancelled"].includes(s.value),
);

/** Un pedido solo admite edición de líneas mientras está en curso. */
export const isOrderEditable = (status: OrderStatus) =>
  status === "pending" || status === "processing";

export interface Order {
  id: string;
  order_number: string;
  source: OrderSource;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_city: string | null;
  customer_city_dane_code: string | null;
  status: OrderStatus;
  is_cod: boolean;
  cod_confirmed: boolean;
  payment_status: "paid" | "pending_verification";
  payment_verified_at: string | null;
  shopify_financial_status: string | null;
  payment_method: PaymentMethod | null;
  shopify_payment_gateway: string | null;
  total: number;
  shipping_cost: number;
  customer_pays_shipping: boolean;
  tracking_number: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderItemKind = "product" | "unknown" | "fee";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  kind: OrderItemKind;
  external_name: string | null;
  external_sku: string | null;
}

export interface OrderItemWithProduct extends OrderItem {
  product: { id: string; sku: string; name: string } | null;
}

/**
 * Qué cuenta como prenda. Espejo de server/lib/orderUnits.ts: solo kind='product'.
 * Las líneas 'fee' (envío, comisión COD) son cargos y las 'unknown' son productos
 * de Shopify sin crear en el catálogo, que no se pagan hasta asignarlos.
 */
export const isGarmentLine = (it: Pick<OrderItem, "kind">) => it.kind === "product";

/** Prendas de un pedido, con la misma regla que usa el pago por prenda. */
export const countGarments = (items: Pick<OrderItem, "kind" | "quantity">[]) =>
  items.reduce((n, it) => (isGarmentLine(it) ? n + Number(it.quantity) : n), 0);

export interface OrderWithItems extends Order {
  items: OrderItemWithProduct[];
}

const QK_ORDERS = ["orders"] as const;

export function useOrders() {
  return useQuery({
    queryKey: QK_ORDERS,
    queryFn: () => api.get<OrderWithItems[]>("/orders"),
  });
}

export interface NewOrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  kind?: OrderItemKind;
  external_name?: string;
}

export interface NewOrderInput {
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_city_dane_code?: string | null;
  is_cod: boolean;
  customer_pays_shipping: boolean;
  status: OrderStatus;
  payment_method: PaymentMethod;
  items: NewOrderItemInput[];
}

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MAN-${ymd}-${rand}`;
}

export function useCreateManualOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewOrderInput) => {
      if (input.items.length === 0) throw new Error("Agrega al menos un producto.");

      const order = await api.post<Order>("/orders", {
        order_number: generateOrderNumber(),
        source: "manual",
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_address: input.customer_address ?? null,
        customer_city: input.customer_city ?? null,
        customer_city_dane_code: input.customer_city_dane_code ?? null,
        status: input.status,
        is_cod: input.is_cod,
        cod_confirmed: false,
        payment_method: input.payment_method,
        customer_pays_shipping: input.customer_pays_shipping,
      });

      const itemsPayload = input.items.map((it) => ({
        order_id: order.id,
        product_id: it.product_id || null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        kind: it.kind ?? "product",
        external_name: it.external_name ?? null,
      }));
      await api.post("/order-items", itemsPayload);

      return order;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
  });
}

/** Assign a product to an "unknown" line item (manual matching). */
export function useAssignOrderItemProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, productId }: { itemId: string; productId: string }) =>
      api.patch<OrderItem>(`/order-items/${itemId}`, { product_id: productId }),
    onSuccess: () => invalidateOrdersAndStock(qc),
  });
}

/** Invalida pedidos y el selector de productos (para reflejar el stock ajustado). */
function invalidateOrdersAndStock(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: QK_ORDERS });
  qc.invalidateQueries({ queryKey: ["products-for-order"] });
}

/** Agrega una línea de producto a un pedido existente (pending/processing). */
export function useAddOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      order_id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
    }) => api.post<OrderItem>("/order-items", { ...input, kind: "product" }),
    onSuccess: () => invalidateOrdersAndStock(qc),
  });
}

/**
 * Agrega una línea de cargo (kind='fee') a un pedido existente: p. ej. "Envío
 * estándar". Suma al total (trigger recalc_order_total) sin tocar inventario.
 */
export function useAddOrderFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { order_id: string; unit_price: number; external_name: string }) =>
      api.post<OrderItem>("/order-items", {
        order_id: input.order_id,
        product_id: null,
        quantity: 1,
        unit_price: input.unit_price,
        kind: "fee",
        external_name: input.external_name,
      }),
    onSuccess: () => invalidateOrdersAndStock(qc),
  });
}

/** Edita cantidad y/o precio de una línea existente. */
export function useUpdateOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      patch,
    }: {
      itemId: string;
      patch: { quantity?: number; unit_price?: number };
    }) => api.patch<OrderItem>(`/order-items/${itemId}`, patch),
    onSuccess: () => invalidateOrdersAndStock(qc),
  });
}

/** Elimina una línea de un pedido existente. */
export function useRemoveOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.delete<{ ok: true }>(`/order-items/${itemId}`),
    onSuccess: () => invalidateOrdersAndStock(qc),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch<Order>(`/orders/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
  });
}

export function useConfirmCod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmed }: { id: string; confirmed: boolean }) =>
      api.patch<Order>(`/orders/${id}`, { cod_confirmed: confirmed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
  });
}

/** Marca una transferencia (Nequi u otra) como verificada → pasa a prepago. */
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Order>(`/orders/${id}/verify-payment`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
  });
}

export function useDeleteAllOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ deleted: number }>("/orders/all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
  });
}

/* ---- Products list (lectura para el selector del formulario) ---- */
export function useProductsForOrder() {
  return useQuery({
    queryKey: ["products-for-order"],
    queryFn: () =>
      api.get<Array<{ id: string; sku: string; name: string; price: number; stock: number; active: boolean }>>(
        "/products",
        { active: "true", select: "id,sku,name,price,stock,active" },
      ),
  });
}
