import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ShopifyConfig {
  store_domain: string;
  access_token: string;
  sync_enabled: boolean;
  last_products_sync: string | null;
  last_orders_sync: string | null;
}

export interface ShopifyConfigInput {
  store_domain: string;
  access_token?: string;
  sync_enabled?: boolean;
}

export interface SyncProductsResult {
  upserted: number;
  skipped: number;
  errors: string[];
}

export interface SyncOrdersResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const QK = ["shopify_config"] as const;

export function useShopifyConfig() {
  return useQuery({
    queryKey: QK,
    queryFn: () => api.get<ShopifyConfig>("/shopify/config"),
  });
}

export function useSaveShopifyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ShopifyConfigInput) =>
      api.post<{ ok: boolean }>("/shopify/config", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useTestShopifyConnection() {
  return useMutation({
    mutationFn: () => api.get<{ shop: string }>("/shopify/test"),
  });
}

export function useSyncShopifyProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SyncProductsResult>("/shopify/sync/products"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useSyncShopifyOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SyncOrdersResult>("/shopify/sync/orders"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useImportShopifyProductsCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csvText: string) =>
      api.post<SyncProductsResult>("/shopify/import/products", { csv: csvText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function useImportShopifyOrdersCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csvText: string) =>
      api.post<SyncOrdersResult>("/shopify/import/orders", { csv: csvText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}
