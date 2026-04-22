# Beast Hub Command — Migración Supabase → Railway

SPA React/Vite/TS. Se migra a Railway PostgreSQL + backend Node/Express propio (un solo servicio sirve API y SPA). JWT en lugar de Supabase auth. Sin RLS; el middleware `requireAuth` protege todas las rutas salvo públicas (supplier portal).

Rama de trabajo: `claude/railway-prod-RbRe3`.

## Estado

### FASE 1 — Backend ✅ parcial
- [x] 1.1 `server/tsconfig.json` + deps (express, pg, jsonwebtoken, bcryptjs, cors, dotenv, tsx, types).
- [x] 1.2 `server/db.ts` — Pool pg con SSL condicional y helper `query<T extends QueryResultRow>`.
- [x] 1.3 `server/auth.ts` — login/me/logout + middleware `requireAuth` (Bearer JWT).
- [x] 1.4 Rutas (Chunk A) — `catalogs`, `suppliers`, `raw-materials`.
- [x] 1.4 Rutas (Chunk B) — `products`, `product-materials`.
- [x] 1.4 Rutas (Chunk C) — `orders`, `order-items`, `cod`, `logistics`.
- [x] 1.4 Rutas (Chunk D) — `work-orders` (+RPC `complete_work_order`), `supply-requests` (+RPC `complete_supply_request`, +`auto-supply`).
- [x] 1.4 Rutas (Chunk E) — `returns` (+`/resolve` transaccional con merma/flete), `finance` (guard manual-only edit/delete), `staff` (bcrypt + profile), `config` (`global_configs` map + `gross-revenue-current-month`). BI sin ruta propia; el frontend agrega sobre `/api/orders`, `/api/product-materials`, `/api/returns`.
- [x] 1.4 Rutas (Chunk F) — `supplier-portal` (público, sin `requireAuth`, valida `secure_token`).
- [x] 1.5 `server/index.ts` — CORS, JSON, health, mounts, SPA static, errorHandler.

### FASE 2 — DB ✅
- [x] 2.1 Migraciones consolidadas en `server/migrations/001..005.sql` + `server/migrate.ts` con `schema_migrations`. RLS eliminado, triggers/funciones preservados.
- [ ] 2.2 Variables de entorno definitivas en Railway (DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT, NODE_ENV, CORS_ORIGIN) — se configuran al desplegar.

### FASE 3 — Frontend ⏳ en curso
- [x] 3.1 `src/integrations/api/client.ts` — fetch wrapper con `Authorization: Bearer` desde localStorage (`setAuthToken`/`getAuthToken`).
- [x] 3.2 `AuthProvider.tsx` (signIn/signOut/user), `Auth.tsx`, `ProtectedRoute.tsx` a JWT.
- [ ] 3.3 Migrar 12 `api.ts`: inventory, orders, production (api+configApi), sourcing, supply-requests, logistics, returns, cod, staff, bi, finance, supplier-portal.
- [ ] 3.3b Eliminar `src/integrations/supabase/`, `supabase/`, uninstall `@supabase/supabase-js`.
- [ ] 3.4 Env: eliminar `VITE_SUPABASE_*`, agregar `VITE_API_URL`.
- [ ] 3.5 `vite.config.ts` → proxy `/api` → `http://localhost:3000`.

### FASE 4 — Railway ⏳ pendiente
- [ ] 4.1 `railway.toml` (NIXPACKS, buildCommand, startCommand, healthcheck `/api/health`).
- [ ] 4.2 Scripts: `build:server`, `start`, `migrate`, `dev:server`.
- [ ] 4.3 `.env.example`.

### FASE 5 — Verificación ⏳ pendiente
- [ ] Build local, login, CRUD productos, total orden (trigger), complete_work_order, supplier portal.

## Convenciones clave

- **Rutas CRUD**: usar `pickBody`/`buildInsert`/`buildUpdate` de `server/util.ts` con `COLS` whitelist. Siempre `String(req.params.id)` (Express 5 tipa `string | string[]`).
- **Relaciones anidadas**: replicar shape Supabase con `json_build_object` + LEFT JOIN (1:1) o `json_agg` subquery (1:N). Ver `orders.ts` → `ITEMS_SUBQUERY`.
- **Bulk ops**: POST acepta array → transacción con `client.query('BEGIN'/'COMMIT'/'ROLLBACK')`. PATCH bulk usa `{ids, patch}`. DELETE bulk usa `{ids}` o `?product_ids=csv`.
- **Reglas de negocio en server**:
  - `orders.patch`: si `customer_pays_shipping=true` se fuerza `shipping_cost=0`.
  - `cod/receipt`: si `source='shopify'` requiere `order_confirmed` previo.
  - `cod/*` y futuras mutaciones staff-tracked escriben `req.user.id` (no aceptar del cliente).
- **Build dual module**: raíz tiene `"type":"module"`, server compila a CJS; build script deja `dist/server/package.json` con `{"type":"commonjs"}`.

## Coordinación con Lovable (front en `main`)

- Mergear solo a `railway/backend`: `src/components/**`, `src/pages/**` (excepto `Auth.tsx`), `src/features/*/components/**`, `src/features/*/hooks/**` sin supabase.
- NUNCA mergear automáticamente: `src/features/*/api.ts`, `configApi.ts`, `AuthProvider.tsx`, `Auth.tsx`, `src/integrations/supabase/*`, `.env`.

---

# CLAUDE.md — Behavioral guidelines

## 1. Think Before Coding
- State assumptions. If uncertain, ask. Present alternatives, don't pick silently.

## 2. Simplicity First
- Mínimo código que resuelve el problema. Sin abstracciones especulativas. Sin error handling para casos imposibles.

## 3. Surgical Changes
- Tocar solo lo necesario. No refactorizar adyacente. Remover imports/vars huérfanos que tus cambios dejaron sin uso; no borrar dead code preexistente.

## 4. Goal-Driven Execution
- Criterio de éxito verificable antes de implementar. Plan breve para tareas multi-paso.
