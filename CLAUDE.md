# Beast Hub Command — Migración Supabase → Railway (completada)

SPA React/Vite/TS sobre Railway PostgreSQL + backend Node/Express propio. Un solo servicio sirve API y SPA. JWT sustituye Supabase auth; sin RLS — `requireAuth` protege todas las rutas salvo `/api/auth/*` y `/api/supplier-portal` (público, valida `secure_token`).

Rama: `claude/fix-railway-deployment-AE5PT`.

## Estado

- [x] FASE 1 — Backend: `server/db.ts`, `server/auth.ts` (login/me/logout + `requireAuth`), 14 routers montados en `server/index.ts` (`catalogs`, `suppliers`, `raw-materials`, `products`, `product-materials`, `orders`, `order-items`, `cod`, `logistics`, `work-orders`, `supply-requests`, `returns`, `finance`, `staff`, `config`, `supplier-portal`), `util.ts` (asyncHandler, pickBody, buildInsert/Update, errorHandler).
- [x] FASE 2 — DB: 5 migraciones consolidadas en `server/migrations/001..005.sql` + `server/migrate.ts` con `schema_migrations`. RLS removido; triggers/funciones preservados (`set_updated_at`, `recalc_order_total`, `complete_work_order`, `complete_supply_request`, `handle_new_user`, `validate_return`, `validate_order_payment_method`).
- [x] FASE 3 — Frontend: `src/integrations/api/client.ts` (fetch + Bearer), `AuthProvider`/`Auth`/`ProtectedRoute` a JWT, 12 `api.ts` + `SupplierPortal.tsx` migrados. `src/integrations/supabase/` y directorio `supabase/` eliminados. `@supabase/supabase-js` desinstalado.
- [x] FASE 3.4/3.5 — `.env` sólo con `VITE_API_URL=/api`, `vite.config.ts` con proxy `/api → http://localhost:3000`.
- [x] FASE 4 — `railway.toml` (NIXPACKS, build + start único + healthcheck), scripts `build:server`, `start`, `migrate`, `dev:server` presentes, `.env.example` documentado.
- [x] FASE 5 — Bootstrap inline: `server/index.ts` corre `runMigrations()` + `seedAdmin()` antes de `app.listen`. Admin quemado por defecto (`admin@beasthub.com` / `admin123`, overridable por env). Sin `tsx` en runtime de producción.
- [x] FASE 6 — Integración Shopify (rama `claude/shopify-inventory-integration-ESOeH`): migración `006_shopify.sql` agrega `shopify_product_id`/`shopify_variant_id UNIQUE` en `products`, `shopify_order_id UNIQUE`/`shopify_order_number` en `orders`, y tabla singleton `shopify_config`. `server/lib/shopifyClient.ts` implementa cliente REST API (version 2024-01), paginación por Link header, parsers CSV nativos (sin deps), mappers Shopify→Beast Hub y upsert transaccional. `server/routes/shopify.ts` monta 6 endpoints en `/api/shopify/` (config, test, sync directa productos/órdenes, import CSV productos/órdenes). Frontend: `src/features/shopify/api.ts` hooks React Query y `src/features/config/ShopifyPanel.tsx` panel en tab "Shopify" de Config.
- [x] FASE 7 — Inventario bidireccional Shopify (rama `claude/fix-shopify-sync-ViWIg`): migración `007_shopify_inventory.sql` agrega `shopify_inventory_item_id` en `products`, `location_id`/`location_name`/`last_inventory_sync`/`inventory_sync_enabled` en `shopify_config`, y tabla `shopify_sync_errors` para log de fallos. `mapShopifyProduct` ahora sintetiza SKU determinista (`slugify(handle-opt1-opt2-opt3)`) cuando Shopify no provee uno, soportando catálogos sin SKU. `shopifyClient.ts` añade `shopifyMutate` (POST/PUT), `listShopifyLocations`, `pullInventoryFromShopify`, `pushInventoryToShopify` (idempotente vía `inventory_levels/set.json`), `pushPendingInventoryErrors`, `listInventoryErrors`. `inventorySync.ts` expone `tryPushInventory` (no-throw, gateado por `inventory_sync_enabled`) hookeado en `products.patch`, `work-orders/:id/complete`, `returns/:id/resolve` (rama restocked) y `syncOrders` (después de decrementar BH). `routes/shopify.ts` agrega `/locations`, `/inventory/pull`, `/inventory/push-all`, `/inventory/errors`. UI: card "Inventario bidireccional" en ShopifyPanel con dropdown de locations, switch de push automático, botón "Traer desde Shopify" y panel de errores con reintento.

## Convenciones clave

- **CRUD**: `pickBody`/`buildInsert`/`buildUpdate` con `COLS` whitelist. Siempre `String(req.params.id)` (Express 5 tipa `string | string[]`).
- **Relaciones anidadas**: `json_build_object` + LEFT JOIN (1:1) o `json_agg` subquery (1:N). Ver `orders.ts::ITEMS_SUBQUERY`.
- **Bulk**: POST acepta array → transacción; PATCH bulk `{ids, patch}`; DELETE bulk `{ids}` en body (cliente: `api.delete(path, { body })`).
- **Reglas de negocio en server**:
  - `orders.patch`: `customer_pays_shipping=true` fuerza `shipping_cost=0`.
  - `cod/receipt`: si `source='shopify'` requiere `order_confirmed` previo.
  - `cod/*`: escribe `req.user.id` en `confirmed_by_staff_id`/`received_by_staff_id` (no aceptar del cliente).
  - `returns/:id/resolve`: transaccional — update return + stock + inserts en `financial_transactions` (merma / flete).
  - `finance`: PATCH/DELETE solo permite `reference_type='manual'`.
- **Build dual module**: raíz `"type":"module"` (Vite/ESM), `server/package.json` `{"type":"commonjs"}` para que tsx y el bundle compilado carguen CJS. `scripts/copy-server-assets.cjs` escribe `dist/server/package.json` y copia `server/migrations/*.sql` a `dist/server/migrations/` post-`tsc`.
- **Bootstrap server**: `server/index.ts` importa `runMigrations` y `seedAdmin` y los corre dentro de una `async function bootstrap()` antes de `app.listen`. En error crashea con `process.exit(1)` para que Railway reinicie.
- **Shopify sync**:
  - Credenciales en `shopify_config` (singleton `id=1`). Access token se retorna enmascarado en `GET /api/shopify/config`; solo se actualiza si el body no empieza con `****`.
  - Paginación: `shopifyPaginateAll` lee header `Link: ...rel="next"` y extrae `page_info`. Throttle 500ms entre páginas (plan Basic: 2 req/s). Cap de seguridad: `MAX_PAGES=40` (10k items).
  - Mapeo productos: Shopify product → `products` parent (`is_parent=true`, `sku='PARENT-{shopify_id}'`), variantes → `products` children. Options con nombre matching `/color|colour/i` y `/size|talla|taille/i` mapean a `base_color` y `size`.
  - Upsert variantes: (1) match por `shopify_variant_id`, (2) fallback por `sku` (backfilleando `shopify_variant_id`), (3) insert. `ON CONFLICT` no sirve con dos UNIQUEs.
  - Mapeo órdenes: `source='shopify'`, `order_number='SHO-{name_sin_#}'` (colisión→ sufijo `-A`,`-B`,...), `customer_phone` fallback chain `customer.phone → billing_address.phone → 'N/A'`, `fulfillment_status` mapea a `status` (fulfilled→shipped, partial→processing, else→pending), `is_cod=true` si `payment_gateway` ∈ {cash_on_delivery, cod, manual, contra_entrega, contraentrega}. `payment_method` se deja NULL (trigger `validate_order_payment_method` permite NULL).
  - Idempotencia: sync orders skipea si ya existe `shopify_order_id`. Total se recalcula por trigger desde `order_items`.
  - CSV: parser nativo RFC 4180 (strip BOM, comillas escape `""`). Acepta formato estándar de export de Shopify Admin. Requiere `express.text({type:'text/plain'})` en `server/index.ts` para payloads grandes. El export moderno de Shopify ya **no incluye** `Variant Inventory Qty` (movido al export de inventario aparte) → variantes importadas vía CSV nacen con `stock=0`. El parser detecta filas image-only (sin sku/price/options) y las descarta para no duplicar variantes.
  - SKU sintetizado: si `Variant SKU` está vacío (o ausente en API), `mapShopifyProduct` genera `slugify(handle-opt1-opt2-opt3)` y marca `sku_synthesized=true`. Idempotente entre re-imports porque depende sólo de handle+opciones. `SyncProductsResult.synthesized_skus` informa el conteo a la UI.
- **Inventario bidireccional (BH dominante)**:
  - Una sola `location_id` por tienda (singleton en `shopify_config`). Se elige en la UI desde `GET /shopify/locations`.
  - Bootstrap: `POST /shopify/inventory/pull` lee `inventory_levels.json?location_ids=X` paginado y hace `UPDATE products SET stock=X WHERE shopify_inventory_item_id=Y`. De ahí en adelante, BH es la fuente.
  - Push BH→Shopify: `tryPushInventory(productId)` en `server/lib/inventorySync.ts` lee `shopify_config.inventory_sync_enabled`; si `true`, llama `pushInventoryToShopify` que hace `POST /inventory_levels/set.json` con `{location_id, inventory_item_id, available}`. Idempotente (set.json es no-op si valor ya coincide). Errores se persisten en `shopify_sync_errors` sin tirar la transacción del caller; el éxito marca `resolved_at` en cualquier error previo del producto. **Llamar SIEMPRE después del COMMIT** del DB.
  - Hooks de push: `products.patch` (si body incluye `stock`), `work-orders/:id/complete` (todos los `work_order_items.product_id` distintos), `returns/:id/resolve` rama `restocked`, y `syncOrders` después de decrementar BH por las cantidades del line_items.
  - Decremento en sync de órdenes: cuando una orden Shopify entra, BH también resta `quantity` del producto matcheado. Necesario porque Shopify ya decrementó allá automáticamente; sin esto BH se desincronizaría y el siguiente push BH→Shopify sobreescribiría con un valor mayor.
  - Reintento: panel UI muestra `shopify_sync_errors WHERE resolved_at IS NULL` y permite "Reintentar todos" → `pushPendingInventoryErrors` itera con throttle 500ms.

## Variables de entorno Railway

| Var | Obligatoria | Default / Nota |
|---|---|---|
| `DATABASE_URL` | sí | Inyectada por plugin PostgreSQL |
| `JWT_SECRET` | sí | String random ≥32 chars (`openssl rand -hex 32`) |
| `NODE_ENV` | no | Railway lo pone en `production`; `npm start` lo fuerza |
| `PORT` | no | Inyectado por Railway |
| `JWT_EXPIRES_IN` | no | `7d` |
| `CORS_ORIGIN` | no | Vacío = permite todo (OK en primer deploy) |
| `ADMIN_EMAIL` | no | `admin@beasthub.com` |
| `ADMIN_PASSWORD` | no | `admin123` (cambiar tras primer login) |
| `ADMIN_NAME` | no | `Admin` |

## Pasos para desplegar

1. Crear proyecto Railway + plugin PostgreSQL → `DATABASE_URL` auto-inyectada.
2. Setear `JWT_SECRET` en variables del servicio.
3. Conectar repo, branch `claude/fix-railway-deployment-AE5PT`.
4. Deploy: Nixpacks corre `npm ci` → `npm run build && npm run build:server` → `npm start`.
5. El server al arrancar aplica migraciones pendientes (idempotente) y siembra el admin (idempotente, ON CONFLICT DO NOTHING).
6. Login en UI con `admin@beasthub.com` / `admin123` — cambiar password inmediatamente.

---

# CLAUDE.md — Behavioral guidelines

- **Think before coding**: declarar supuestos; preguntar si hay ambigüedad.
- **Simplicity first**: mínimo código, sin abstracciones especulativas ni error handling imposible.
- **Surgical changes**: tocar solo lo pedido; limpiar huérfanos propios, no dead code ajeno.
- **Goal-driven**: criterio de éxito verificable antes de implementar.
