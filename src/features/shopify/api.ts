import { api } from "@/integrations/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ShopifyConfig {
  store_domain: string;
  access_token: string;
  sync_enabled: boolean;
  last_products_sync: string | null;
  last_orders_sync: string | null;
  location_id: string | null;
  location_name: string | null;
  last_inventory_sync: string | null;
  inventory_sync_enabled: boolean;
}

export interface ShopifyConfigInput {
  store_domain: string;
  access_token?: string;
  sync_enabled?: boolean;
  location_id?: string | null;
  location_name?: string | null;
  inventory_sync_enabled?: boolean;
}

export interface ShopifyLocation {
  id: string;
  name: string;
  active: boolean;
}

export interface InventoryPullResult {
  updated: number;
  unmatched: number;
  errors: string[];
}

export interface PushBulkResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

export interface ShopifyInventoryError {
  id: string;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  operation: string;
  error_message: string;
  attempted_at: string;
}

export interface SyncProductsResult {
  upserted: number;
  skipped: number;
  synthesized_skus: number;
  errors: string[];
}

export interface SyncOrdersResult {
  imported: number;
  skipped: number;
  unmatched_items: number;
  unmatched_samples: string[];
  errors: string[];
}

export interface TestConnectionResult {
  shop: string;
  products_count: number | null;
  orders_count: number | null;
  locations_count: number | null;
  products_error: string | null;
  orders_error: string | null;
  locations_error: string | null;
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
    mutationFn: () => api.get<TestConnectionResult>("/shopify/test"),
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

const ERRORS_QK = ["shopify_inventory_errors"] as const;

export function useShopifyLocations(enabled: boolean) {
  return useQuery({
    queryKey: ["shopify_locations"],
    queryFn: () => api.get<ShopifyLocation[]>("/shopify/locations"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePullShopifyInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<InventoryPullResult>("/shopify/inventory/pull"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: QK });
    },
  });
}

export function usePushPendingInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PushBulkResult>("/shopify/inventory/push-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ERRORS_QK }),
  });
}

export function useShopifyInventoryErrors() {
  return useQuery({
    queryKey: ERRORS_QK,
    queryFn: () => api.get<ShopifyInventoryError[]>("/shopify/inventory/errors"),
    refetchInterval: 30_000,
  });
}
