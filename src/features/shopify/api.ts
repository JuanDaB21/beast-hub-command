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

// ---------------------------------------------------------------------------
// BOM / Base linking
// ---------------------------------------------------------------------------

export interface UnlinkedChild {
  parent_id: string;
  parent_name: string;
  parent_sku: string;
  base_group_key: string | null;
  child_id: string;
  child_sku: string;
  base_color: string | null;
  size: string | null;
}

export interface UnlinkedParent {
  parent_id: string;
  parent_name: string;
  parent_sku: string;
  base_group_key: string | null;
  children: UnlinkedChild[];
}

export interface LinkPreviewItem {
  product_id: string;
  sku: string;
  base_color: string | null;
  size: string | null;
  resolved_color_id: string | null;
  resolved_size_id: string | null;
  raw_material_id: string | null;
  can_link: boolean;
}

export interface LinkPreviewResult {
  base_group_key: string;
  print_design_id: string | null;
  print_height_cm: number;
  previews: LinkPreviewItem[];
}

export interface BulkLinkItem {
  product_id: string;
  raw_material_id: string;
  print_design_id?: string | null;
  print_height_cm?: number;
}

export interface BulkLinkResult {
  linked: number;
  errors: Array<{ product_id: string; ok: boolean; error?: string }>;
}

export interface SetBaseGroupResult {
  parent_id: string;
  linked: number;
  unresolved: Array<{ child_id: string; sku: string; base_color: string | null; size: string | null; reason: string }>;
}

export interface ColorAlias {
  alias_norm: string;
  color_id: string;
  color_name: string;
  hex_code: string | null;
}

export interface SizeAlias {
  alias_norm: string;
  size_id: string;
  size_label: string;
}

const UNLINKED_QK = ["shopify_unlinked"] as const;
const COLOR_ALIASES_QK = ["shopify_color_aliases"] as const;
const SIZE_ALIASES_QK = ["shopify_size_aliases"] as const;

export function useUnlinkedProducts() {
  return useQuery({
    queryKey: UNLINKED_QK,
    queryFn: () => api.get<UnlinkedParent[]>("/shopify/links/unlinked"),
  });
}

export function useLinkPreview() {
  return useMutation({
    mutationFn: (body: { parent_id: string; base_group_key: string; print_design_id?: string | null; print_height_cm?: number }) =>
      api.post<LinkPreviewResult>("/shopify/links/preview", body),
  });
}

export function useSetBaseGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { parent_id: string; base_group_key: string; print_design_id?: string | null; print_height_cm?: number }) =>
      api.put<SetBaseGroupResult>(`/shopify/links/parent/${body.parent_id}/base-group`, {
        base_group_key: body.base_group_key,
        print_design_id: body.print_design_id,
        print_height_cm: body.print_height_cm,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNLINKED_QK });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useBulkLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: BulkLinkItem[]) =>
      api.post<BulkLinkResult>("/shopify/links/bulk", items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNLINKED_QK });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      api.delete(`/shopify/links/${productId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNLINKED_QK });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useColorAliases() {
  return useQuery({
    queryKey: COLOR_ALIASES_QK,
    queryFn: () => api.get<ColorAlias[]>("/shopify/aliases/colors"),
  });
}

export function useSizeAliases() {
  return useQuery({
    queryKey: SIZE_ALIASES_QK,
    queryFn: () => api.get<SizeAlias[]>("/shopify/aliases/sizes"),
  });
}

export function useAddColorAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { alias: string; color_id: string }) =>
      api.post<{ ok: boolean }>("/shopify/aliases/colors", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLOR_ALIASES_QK }),
  });
}

export function useAddSizeAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { alias: string; size_id: string }) =>
      api.post<{ ok: boolean }>("/shopify/aliases/sizes", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: SIZE_ALIASES_QK }),
  });
}

export function useDeleteColorAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aliasNorm: string) =>
      api.delete(`/shopify/aliases/colors/${encodeURIComponent(aliasNorm)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLOR_ALIASES_QK }),
  });
}

export function useDeleteSizeAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aliasNorm: string) =>
      api.delete(`/shopify/aliases/sizes/${encodeURIComponent(aliasNorm)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: SIZE_ALIASES_QK }),
  });
}
