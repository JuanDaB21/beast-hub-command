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
- [x] FASE 9 — Rediseño módulo Productos + estampados jerárquicos + procesos + archivado (rama `claude/product-module-redesign`):
  - **Migración `016_bom_role.sql`**: `product_materials.role` (`base`|`ink`|`process`, default `base`) con backfill de filas de tinta (match `print_designs.ink_raw_material_id`). Permite editar la base de una variante de forma fiable. `product-materials.ts` acepta/devuelve `role` (POST single y bulk hacen `ON CONFLICT DO UPDATE SET quantity_required, role`).
  - **Migración `017_print_designs_redesign.sql`**: `print_designs.drive_url` (link DTF en Drive) + `print_designs.parent_design_id` (self-ref → estampado padre/hijos por color); se elimina el `UNIQUE(name)` global. `print-designs.ts` añade ambas a `COLS` y el JSON de `ink_raw_material` ahora incluye `unit_price`. Frontend: `usePrintDesignTree()` arma padres→hijos; `DesignDialog.tsx` extraído y reutilizable (campos drive/padre + `onCreated`); `PrintDesignsTable` muestra jerarquía + link DTF + "agregar color".
  - **Migración `018_production_processes.sql`**: `production_processes` (catálogo name/cost/active), `product_processes` (producto↔proceso), `work_order_item_processes` (checklist rastreable por ítem, estilo `is_dtf_added`). Router `production-processes.ts` (CRUD + `GET /by-products` + `PUT /product/:id` reemplaza set). `work-orders.ts`: `seedItemProcesses` siembra los pasos al crear ítems (batch y append), el `ITEMS_SUBQUERY` expone `processes[]`, y `PATCH /item-processes/:id` togglea completado. `complete_work_order()` SIN cambios (proceso es paso rastreable, no consume insumo).
  - **Frontend productos**: `VariantEditDialog` ahora edita base (BOM `role='base'`), recalcula tinta, asigna procesos, muestra costo/margen en vivo y expone eliminar variante (`onRequestDelete`). Nuevo `ProductProfitPanel.tsx` (tabla de costo/rentabilidad por variante desde BOM+procesos+impresión/planchado, abierto desde el menú del padre). `ProductForm` sección 3 rediseñada: buscador de estampados, picker jerárquico, "+" inline (`DesignDialog`), y sección de procesos; pasa `processIds` a `useCreateProductWithVariants`/`useAddVariantsToParent` (asignan a cada hijo tras insertar). Config: nueva pestaña **Procesos** (`ProcessesTable`).
  - **Archivado (punto 7)**: `useSetProductTreeActive` (PATCH `active` a padre+hijos, no borra → ventas conservan producto). `Inventory` añade toggle "Ver archivados"/"Ver activos", filtra por `active`, y acción Archivar/Restaurar en tabla y lista móvil. Los selectores de Órdenes (`useProductsForOrder`, `?active=true`) y Órdenes de trabajo (`AddItemRow` filtra `p.active`) ya excluían archivados.
  - Nota: base por variante (puntos 2 y 4) se resuelve con el selector de prenda base en `VariantEditDialog` (puede elegir una base de otra talla; no cambia la talla nominal del producto). Moneda unificada a COP en inventario.
- [x] FASE 8 — Catálogo de estampados + BOM multi-material (rama `claude/improve-creation-workflows-5fxS0`): migración `009_print_designs.sql` crea tabla `print_designs` (name, hex_code, ink_raw_material_id, ink_grams_per_cm, active) y FK `products.print_design_id`. `server/routes/print-designs.ts` monta CRUD completo en `/api/print-designs` (con LEFT JOIN al RM tinta). `ProductForm.tsx` reemplaza el input libre de estampados por checkboxes del catálogo activo (swatch de color + indicador de tinta). `VariantInput` extiende con `print_design_id`, `ink_raw_material_id`, `ink_quantity_required`; `useCreateProductWithVariants` inserta **2 filas BOM** por variante cuando el estampado tiene tinta asociada (base qty=1 + tinta qty=`print_height_cm × ink_grams_per_cm`), aprovechando que `complete_work_order` ya itera todo `product_materials` sin cambios. Nueva pestaña `Configuración → Estampados` con `PrintDesignsTable` (CRUD con dialog: nombre, color picker, RM tinta, g/cm, switch activo).

- [x] FASE 10 — Recepción por ítem, KPIs de unidades, pago por prenda y auto-cancelación (rama `claude/ops-reception-kpis-payroll`):
  - **Migración `019_supply_reception.sql`**: `supply_request_items` gana `quantity_received`/`received_at`/`received_by_staff_id`; nuevo estado `receiving` en el CHECK de `supply_requests`; `complete_supply_request()` redefinida para cargar **solo el remanente** (`quantity_confirmed - quantity_received`) y volverse idempotente. Nuevo `PATCH /api/supply-requests/items/:itemId/receive` aplica el **delta** al `raw_materials.stock` (desmarcar devuelve stock) y recalcula el estado. `supplier-portal` rechaza (409) si la solicitud ya está en `receiving`; `DELETE` de solicitud rechaza si hay mercancía recibida. UI: checkbox + input de cantidad por ítem, barra de progreso y botón "Recibir todo lo pendiente".
  - **Migración `020_unit_payments.sql`**: `orders.delivered_at` + trigger `set_delivered_at()` (backfill desde `updated_at`), y tabla `unit_payment_runs` (periodo, unidades, tarifa, total, `financial_transaction_id`). Router `unit-payments.ts` en `/api/unit-payments`: `GET /units?from&to` cuenta `order_items.kind='product'` de pedidos `delivered` por `delivered_at` y avisa de periodos solapados; `POST /` **recalcula unidades en el servidor** e inserta el gasto `Nómina` con `reference_type='unit_payment'` (queda no editable desde el libro); `DELETE /:id` borra run + asiento. UI: pestaña "Pago prendas vendidas" en Finanzas.
  - **Migración `021_return_auto_cancel.sql`**: `orders.cancelled_by_return`. `POST /returns` cancela el pedido si **todas** sus líneas `kind='product'` tienen devolución y el pedido **no** está cobrado (`is_cod ? cod_confirmed : payment_status='paid'`); devuelve `cancelled_orders` para el toast. `DELETE /returns/:id` solo acepta devoluciones `pending` (409 si ya se resolvió) y revierte la cancelación. **Cancelar no devuelve stock** — lo hace la resolución `restocked`. UI: X en la tarjeta de devolución pendiente.
  - **Dashboard** (`src/features/bi/api.ts`): nuevos KPIs `unitsSold` (líneas `kind !== 'fee'` de pedidos no cancelados), `avgTicket`, `marginPerUnit` y `unitsUnlinked`. COGS ahora replica la fórmula canónica de `ProductProfitPanel` (BOM base+tinta + `print_height_cm/100 × printing_cost_per_meter` + `ironing_cost` + `Σ product_processes.cost`); antes solo sumaba el BOM e inflaba el margen. El envío se resta sin condicionar a `customer_pays_shipping`, y se descuentan los gastos `reference_type='return'` (merma y flete RMA).
  - **Finanzas**: filtro "Cargado a" (`charged_to`, con `none` para sin asignar) en `GET /api/finance` y en `FinanceFilters`. Nuevo `src/components/shared/DateRangePicker.tsx` extraído de `FinanceFilters`.

- [x] FASE 11 — Guía obligatoria, fusión COD→Logística, conciliación por vía de cobro y flete unificado (rama `claude/logistics-guide-cod-merge`):
  - **Bug de la guía**: el desplegable "Cambiar estado" de `OrderDetails` mandaba `{status}` a secas y dejaba pedidos `shipped` con `tracking_number` NULL (el guard solo existía en el drag & drop). Ahora `PATCH /orders/:id` responde **409** si se marca `shipped` sin guía (`delivered` queda fuera: se puede entregar en mano), el desplegable abre el `ShipDialog` vía `requiresTracking()` (predicado compartido con `OrdersBoard`), y la tarjeta de Logística muestra un aviso rojo **"Sin guía"** en vez de no dibujar nada. `useUpdateOrderStatus` e `invalidateOrdersAndStock` ahora invalidan también `["logistics-orders"]` (el tablero servía caché vieja). `Order` declara `shipped_at`/`delay_reason`/`order_confirmed*`/`cod_received_at`, así que `ShipmentOrder` es un alias de `OrderWithItems` y desaparece el doble cast de `Orders.tsx`.
  - **Fusión COD → Logística**: se elimina `src/pages/Cod.tsx` y `src/features/cod/`. Logística pasa a dos pestañas (`Despacho` / `Recaudo COD`, `CodCollectionPanel.tsx`), `GET /logistics/orders` incluye los COD `delivered` (abiertos, o cobrados dentro de `COD_COLLECTED_WINDOW_DAYS=60`) y su `ITEMS_SUBQUERY` ahora expone `kind`/`external_name`/`external_sku`. De `cod.ts` sobrevive solo `POST /cod/orders/:id/confirm` (hito 1, anti-pedido-falso); `GET /cod/orders` y `POST /receipt` se eliminan.
  - **Entregado ⇒ recaudado**: `cod_confirmed` ahora significa *"la transportadora ya cobró"*, no *"el dinero entró a la empresa"*. Lo deriva `PATCH /orders/:id` al pasar a `delivered` (setea `cod_received_at` + `received_by_staff_id`; revertir el estado los limpia). `cod_confirmed`/`cod_received_at`/`received_by_staff_id` salen de `COLS` → `UPDATE_COLS` interno, cerrando el bypass sin auditoría de `OrderDetails`. Consecuencia declarada: por `returns.ts:103` un COD entregado ya **no** se auto-cancela al devolverse (la salida de dinero se registra a mano). `carrier` sale de `COLS` (columna muerta).
  - **Conciliación por vía de cobro**: `POST /orders/:id/verify-payment` exige `payment_method` (4 valores del trigger; `cod` no cabe en `orders`) y lo escribe; el detalle del pedido lo pide con un `Select` y permite corregirlo después. `GET /finance/reconciliation` añade `by_payment_method`, agrupando por `CASE WHEN is_cod THEN 'cod' ELSE payment_method END` — con devengo de **plata cobrada** (COD por `cod_received_at`, prepago por `COALESCE(payment_verified_at, created_at)`), no de ventas facturadas. El `diff` de la barra COD es lo que la transportadora aún no ha girado. Tercera tarjeta en `ReconciliationChart`; `GET /finance` acepta filtros `payment_method` y `source`, y el libro muestra la columna "Canal".
  - **Flete unificado**: `orders.shipping_cost` es la única fuente. `PATCH /orders/:id` espeja el costo en el libro como gasto `reference_type='shipping'`, categoría `Logística — Envío a cliente`, idempotente por el índice único parcial de `023_shipping_expense.sql` (`ON CONFLICT (reference_id) WHERE reference_type='shipping'`); costo 0 borra el asiento. Al no ser `manual`, no es editable desde el libro. **`bi/api.ts` sigue filtrando solo `reference_type==='return'` a propósito** — ampliarlo a `'shipping'` descontaría el flete dos veces. Nuevos KPIs `shippingCharged`/`shippingNet`/`ordersMissingShippingCost` y tarjeta "Envíos del mes" en Finanzas. `SHIPPING_FEE_NAMES = ["Envío estándar", "Envío"]` + `isShippingFeeLine()` en `orders/api.ts` reemplazan el literal triplicado (espejo en `finance.ts`).
  - **Migraciones**: `023_shipping_expense.sql` (índice parcial, sin backfill a propósito para no duplicar los asientos manuales ya registrados), `024_backfill_payment_method.sql` (infiere la vía desde `shopify_payment_gateway`: nequi/daviplata/pasarelas→bancolombia), `025_cod_semantics.sql` (`COMMENT ON COLUMN` de las 8 columnas COD + alinea los COD ya entregados a `cod_confirmed`).

## Convenciones clave

- **CRUD**: `pickBody`/`buildInsert`/`buildUpdate` con `COLS` whitelist. Siempre `String(req.params.id)` (Express 5 tipa `string | string[]`).
- **Relaciones anidadas**: `json_build_object` + LEFT JOIN (1:1) o `json_agg` subquery (1:N). Ver `orders.ts::ITEMS_SUBQUERY`.
- **Bulk**: POST acepta array → transacción; PATCH bulk `{ids, patch}`; DELETE bulk `{ids}` en body (cliente: `api.delete(path, { body })`).
- **Reglas de negocio en server**:
  - `orders.shipping_cost` es **siempre el costo real que la empresa paga a la transportadora**, sin importar quién asumió el envío de cara al cliente. El cobro al cliente viaja como línea `order_items.kind='fee'` dentro de `orders.total`. `orders.patch` ya **no** fuerza `shipping_cost=0` cuando `customer_pays_shipping=true` (esa coerción hacía que el flete real nunca se restara del margen); `ShipDialog` pide el costo siempre.
  - `cod/receipt`: si `source='shopify'` requiere `order_confirmed` previo.
  - `cod/*`: escribe `req.user.id` en `confirmed_by_staff_id`/`received_by_staff_id` (no aceptar del cliente).
  - `returns/:id/resolve`: transaccional — update return + stock + inserts en `financial_transactions` (merma / flete).
  - `finance`: PATCH/DELETE solo permite `reference_type='manual'`.
  - `order-items` POST/PATCH(qty|price)/DELETE: solo permitidos si el pedido está en `pending`/`processing` (si no, `409`). Invariante de stock: cada línea `kind='product'` con `product_id` reserva su `quantity` en `products.stock` — POST descuenta (aplica a creación **y** a añadir línea), PATCH ajusta por la diferencia de cantidad, DELETE devuelve. `orders.DELETE /:id` devuelve stock solo si el pedido seguía en `pending`/`processing`. Siempre `tryPushInventory` tras el COMMIT. La rama de asignación de línea `unknown` (`PATCH {product_id}`) mantiene su comportamiento previo en cualquier estado.
  - Frontend Órdenes: tablero Kanban solo con estados activos (`BOARD_STATUSES` = pending/processing/shipped); entregados/cancelados (`HISTORY_STATUSES`) van a `OrdersHistoryTable` paginada. Edición de líneas en `OrderDetails` gateada por `isOrderEditable(status)`. Marcar entregado/cancelado desde el `Select` de estado del detalle.
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
- **Catálogo de estampados**:
  - Modelo "diseño con color embebido": cada fila de `print_designs` es una combinación única diseño+color (ej. "Logo Beast Negro" y "Logo Beast Blanco" como entradas separadas). Sin tabla intermedia diseño×color.
  - `ink_raw_material_id` apunta a un `raw_materials` de tinta (idealmente `unit_of_measure='g'`). Si es NULL, el estampado no genera fila de BOM para tinta.
  - `ink_grams_per_cm` (default 0.5): factor de consumo. La qty de tinta en BOM = `print_height_cm × ink_grams_per_cm`. Si `print_height_cm = 0` no se inserta fila de tinta aunque haya RM.
  - `products.print_design TEXT` y `products.print_color TEXT` se mantienen como denormalización legible. `products.print_design_id UUID` es la FK hacia el catálogo (fuente de verdad).
  - `complete_work_order` descuenta la tinta automáticamente al iterar todas las filas de `product_materials` — sin cambios en la stored function.
  - Al editar una variante individualmente vía `RecipeManager`, los operadores pueden ajustar qty de tinta por variante de forma libre (el BOM no se regenera al editar el catálogo, sólo al crear).
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

---

# Ahorro de tokens y contexto

Guía completa: [`docs/GUIA_AHORRO_TOKENS.md`](docs/GUIA_AHORRO_TOKENS.md). Reglas operativas para este repo (proyecto de CÓDIGO):

- **Plugin base: `context-mode`** (único con hooks `PreToolUse/PostToolUse` — no instalar otro
  que también los registre, se pisan). Declarado en `.claude/settings.json`; si no está en la
  máquina: `/plugin marketplace add mksglu/context-mode` → `/plugin install context-mode@context-mode`.
- **Salidas grandes de comandos** (tests, `git log`, builds, `npm ls`, respuestas de API):
  procesarlas con `ctx_batch_execute` / `ctx_execute`, no con `Bash` + lectura cruda.
  Bash queda para salidas cortas fijas y para mutar estado (git, mkdir, mv).
- **Analizar un archivo** (resumir, extraer, contar): `ctx_execute_file`. `Read` sólo cuando el
  siguiente paso es `Edit` (necesita los bytes exactos).
- **Antes de leer un archivo completo**: `Grep`/`Glob` o leer sólo el rango necesario.
- **Migraciones y `CLAUDE.md`**: este archivo es el contexto fijo del proyecto (decisiones,
  cifras, rutas). Actualizarlo al cerrar una fase en vez de re-derivarlo cada sesión.
- **Escrituras a disco**: siempre `Write`/`Edit`; los sandboxes de `ctx_*` descartan su FS.
- Terceros adicionales (rtk, code-review-graph, token-optimizer-mcp): **solo con aprobación
  explícita** — ver tabla de la guía.
