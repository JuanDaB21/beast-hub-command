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

export interface Order {
  id: string;
  order_number: string;
  source: OrderSource;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  is_cod: boolean;
  cod_confirmed: boolean;
  payment_method: PaymentMethod | null;
  total: number;
  shipping_cost: number;
  customer_pays_shipping: boolean;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
}

export interface OrderItemWithProduct extends OrderItem {
  product: { id: string; sku: string; name: string } | null;
}

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
}

export interface NewOrderInput {
  customer_name: string;
  customer_phone: string;
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
      }));
      await api.post("/order-items", itemsPayload);

      return order;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ORDERS }),
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
