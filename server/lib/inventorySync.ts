import { pool } from '../db';
import { pushInventoryToShopify } from './shopifyClient';

/**
 * Best-effort push of a single product's stock to Shopify.
 *
 * Never throws — gates on `shopify_config.inventory_sync_enabled`. Failures are
 * already persisted to `shopify_sync_errors` by `pushInventoryToShopify`, so the
 * caller's business transaction is never rolled back by a Shopify outage.
 *
 * Call this AFTER your DB transaction commits.
 */
export async function tryPushInventory(productId: string): Promise<void> {
  try {
    const { rows } = await pool.query<{ inventory_sync_enabled: boolean }>(
      'SELECT inventory_sync_enabled FROM shopify_config WHERE id = 1'
    );
    if (!rows[0]?.inventory_sync_enabled) return;
    await pushInventoryToShopify(productId);
  } catch (err) {
    // Last-resort safety net — a network timeout, the config row missing, etc.
    // We never want to break the caller's response over a sync miss.
    console.error('[inventorySync] tryPushInventory failed:', err);
  }
}
