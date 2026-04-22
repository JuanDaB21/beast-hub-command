import { api } from "@/integrations/api/client";
import { useQuery } from "@tanstack/react-query";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/features/orders/api";

export interface RevenueByChannel {
  key: string;
  label: string;
  total: number;
  count: number;
}

interface OrderSnapshot {
  source: "manual" | "shopify";
  payment_method: PaymentMethod | null;
  total: number;
  status: string;
  created_at: string;
}

export function useRevenueByPaymentMethod(range: { from: Date | null; to: Date | null; key: string }) {
  return useQuery({
    queryKey: ["bi-revenue-by-channel", range.key, range.from?.toISOString(), range.to?.toISOString()],
    queryFn: async (): Promise<RevenueByChannel[]> => {
      const orders = await api.get<OrderSnapshot[]>("/orders", {
        not_status: "cancelled",
        limit: 5000,
        from: range.from?.toISOString(),
        to: range.to?.toISOString(),
      });

      const buckets = new Map<string, RevenueByChannel>();
      const ensure = (key: string, label: string) => {
        if (!buckets.has(key)) buckets.set(key, { key, label, total: 0, count: 0 });
        return buckets.get(key)!;
      };
      (["fisico", "nequi", "daviplata", "bancolombia"] as PaymentMethod[]).forEach((m) =>
        ensure(m, PAYMENT_METHOD_LABEL[m]),
      );
      ensure("shopify", "Shopify / Online");

      for (const row of orders) {
        const total = Number(row.total) || 0;
        if (row.source === "shopify" || !row.payment_method) {
          const b = ensure("shopify", "Shopify / Online");
          b.total += total;
          b.count += 1;
        } else {
          const pm = row.payment_method;
          const b = ensure(pm, PAYMENT_METHOD_LABEL[pm] ?? pm);
          b.total += total;
          b.count += 1;
        }
      }

      return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
    },
    staleTime: 60_000,
  });
}

export type RangeKey = "today" | "7d" | "30d" | "month" | "all";

export interface DateRange {
  from: Date | null;
  to: Date | null;
  key: RangeKey;
}

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "month", label: "Este mes" },
  { value: "all", label: "Todo" },
];

export function rangeFromKey(key: RangeKey): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: now, key };
    case "7d": {
      const f = startOfDay(now);
      f.setDate(f.getDate() - 6);
      return { from: f, to: now, key };
    }
    case "30d": {
      const f = startOfDay(now);
      f.setDate(f.getDate() - 29);
      return { from: f, to: now, key };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, key };
    case "all":
      return { from: null, to: null, key };
  }
}

interface OrderRow {
  id: string;
  order_number: string;
  source: "manual" | "shopify";
  status: string;
  total: number;
  shipping_cost: number;
  customer_pays_shipping: boolean;
  created_at: string;
  items: {
    quantity: number;
    unit_price: number;
    product: { id: string; name: string; sku: string } | null;
  }[];
}

interface ReturnRow {
  id: string;
  order_id: string | null;
  reason_category: string;
  resolution_status: string;
  created_at: string;
}

interface ProductMaterialRow {
  product_id: string;
  quantity_required: number;
  raw_material: { unit_price: number } | null;
}

export interface BiData {
  revenue: number;
  revenueShopify: number;
  revenueManual: number;
  cogs: number;
  shippingCost: number;
  margin: number;
  marginPct: number;
  ordersCount: number;
  returnsRate: number;
  scrapCount: number;
  salesByDay: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  returnReasons: { reason: string; value: number }[];
  monthlyClosure: {
    month: string;
    shopify: number;
    manual: number;
    cogs: number;
    shipping: number;
    margin: number;
  }[];
}

export function useBiData(range: DateRange) {
  return useQuery({
    queryKey: ["bi", range.key, range.from?.toISOString(), range.to?.toISOString()],
    queryFn: async (): Promise<BiData> => {
      const orders = await api.get<OrderRow[]>("/orders", {
        order: "asc",
        limit: 5000,
        from: range.from?.toISOString(),
        to: range.to?.toISOString(),
      });

      const productIds = Array.from(
        new Set(
          orders.flatMap((o) => o.items.map((it) => it.product?.id).filter((x): x is string => !!x)),
        ),
      );

      const costMap = new Map<string, number>();
      if (productIds.length > 0) {
        const pmRows = await api.get<ProductMaterialRow[]>("/product-materials", {
          product_ids: productIds.join(","),
        });
        for (const row of pmRows) {
          const unit = Number(row.raw_material?.unit_price ?? 0);
          const qty = Number(row.quantity_required ?? 0);
          costMap.set(row.product_id, (costMap.get(row.product_id) ?? 0) + unit * qty);
        }
      }

      const returns = await api.get<ReturnRow[]>("/returns");
      const filteredReturns = returns.filter((r) => {
        if (!range.from && !range.to) return true;
        const t = new Date(r.created_at).getTime();
        if (range.from && t < range.from.getTime()) return false;
        if (range.to && t > range.to.getTime()) return false;
        return true;
      });

      const validOrders = orders.filter((o) => o.status !== "cancelled");

      let revenue = 0;
      let revenueShopify = 0;
      let revenueManual = 0;
      let cogs = 0;
      let shippingCost = 0;

      const dayBucket = new Map<string, { revenue: number; orders: number }>();
      const productBucket = new Map<string, { name: string; quantity: number; revenue: number }>();

      for (const o of validOrders) {
        const total = Number(o.total);
        revenue += total;
        const orderShipping = o.customer_pays_shipping ? 0 : Number(o.shipping_cost) || 0;
        shippingCost += orderShipping;
        if (o.source === "shopify") revenueShopify += total;
        else revenueManual += total;

        const day = o.created_at.slice(0, 10);
        const cur = dayBucket.get(day) ?? { revenue: 0, orders: 0 };
        cur.revenue += total;
        cur.orders += 1;
        dayBucket.set(day, cur);

        for (const it of o.items) {
          if (!it.product) continue;
          const unitCost = costMap.get(it.product.id) ?? 0;
          cogs += unitCost * Number(it.quantity);

          const cur2 = productBucket.get(it.product.id) ?? {
            name: it.product.name,
            quantity: 0,
            revenue: 0,
          };
          cur2.quantity += Number(it.quantity);
          cur2.revenue += Number(it.quantity) * Number(it.unit_price);
          productBucket.set(it.product.id, cur2);
        }
      }

      const margin = revenue - cogs - shippingCost;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

      const distinctReturnedOrders = new Set(filteredReturns.map((r) => r.order_id).filter(Boolean));
      const returnsRate = validOrders.length > 0 ? distinctReturnedOrders.size / validOrders.length : 0;
      const scrapCount = filteredReturns.filter((r) => r.resolution_status === "scrapped").length;

      const salesByDay = Array.from(dayBucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, revenue: Math.round(v.revenue), orders: v.orders }));

      const topProducts = Array.from(productBucket.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map((p) => ({
          name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
          quantity: p.quantity,
          revenue: Math.round(p.revenue),
        }));

      const reasonBucket = new Map<string, number>();
      for (const r of filteredReturns) {
        reasonBucket.set(r.reason_category, (reasonBucket.get(r.reason_category) ?? 0) + 1);
      }
      const returnReasons = Array.from(reasonBucket.entries()).map(([reason, value]) => ({
        reason,
        value,
      }));

      const monthBucket = new Map<
        string,
        { shopify: number; manual: number; cogs: number; shipping: number }
      >();
      for (const o of validOrders) {
        const m = o.created_at.slice(0, 7);
        const cur = monthBucket.get(m) ?? { shopify: 0, manual: 0, cogs: 0, shipping: 0 };
        const total = Number(o.total);
        if (o.source === "shopify") cur.shopify += total;
        else cur.manual += total;
        cur.shipping += o.customer_pays_shipping ? 0 : Number(o.shipping_cost) || 0;
        for (const it of o.items) {
          if (!it.product) continue;
          cur.cogs += (costMap.get(it.product.id) ?? 0) * Number(it.quantity);
        }
        monthBucket.set(m, cur);
      }
      const monthlyClosure = Array.from(monthBucket.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 6)
        .map(([month, v]) => ({
          month,
          shopify: Math.round(v.shopify),
          manual: Math.round(v.manual),
          cogs: Math.round(v.cogs),
          shipping: Math.round(v.shipping),
          margin: Math.round(v.shopify + v.manual - v.cogs - v.shipping),
        }));

      return {
        revenue,
        revenueShopify,
        revenueManual,
        cogs,
        shippingCost,
        margin,
        marginPct,
        ordersCount: validOrders.length,
        returnsRate,
        scrapCount,
        salesByDay,
        topProducts,
        returnReasons,
        monthlyClosure,
      };
    },
    staleTime: 60_000,
  });
}
