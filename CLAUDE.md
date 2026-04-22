# Beast Hub Command — Migración Supabase → Railway (completada)

SPA React/Vite/TS sobre Railway PostgreSQL + backend Node/Express propio. Un solo servicio sirve API y SPA. JWT sustituye Supabase auth; sin RLS — `requireAuth` protege todas las rutas salvo `/api/auth/*` y `/api/supplier-portal` (público, valida `secure_token`).

Rama: `claude/railway-prod-RbRe3`.

## Estado

- [x] FASE 1 — Backend: `server/db.ts`, `server/auth.ts` (login/me/logout + `requireAuth`), 14 routers montados en `server/index.ts` (`catalogs`, `suppliers`, `raw-materials`, `products`, `product-materials`, `orders`, `order-items`, `cod`, `logistics`, `work-orders`, `supply-requests`, `returns`, `finance`, `staff`, `config`, `supplier-portal`), `util.ts` (asyncHandler, pickBody, buildInsert/Update, errorHandler).
- [x] FASE 2 — DB: 5 migraciones consolidadas en `server/migrations/001..005.sql` + `server/migrate.ts` con `schema_migrations`. RLS removido; triggers/funciones preservados (`set_updated_at`, `recalc_order_total`, `complete_work_order`, `complete_supply_request`, `handle_new_user`, `validate_return`, `validate_order_payment_method`).
- [x] FASE 3 — Frontend: `src/integrations/api/client.ts` (fetch + Bearer), `AuthProvider`/`Auth`/`ProtectedRoute` a JWT, 12 `api.ts` + `SupplierPortal.tsx` migrados. `src/integrations/supabase/` y directorio `supabase/` eliminados. `@supabase/supabase-js` desinstalado.
- [x] FASE 3.4/3.5 — `.env` sólo con `VITE_API_URL=/api`, `vite.config.ts` con proxy `/api → http://localhost:3000`.
- [x] FASE 4 — `railway.toml` (NIXPACKS, build + start + healthcheck), scripts `build:server`, `start`, `migrate`, `dev:server` ya presentes, `.env.example` documentado.
- [x] FASE 5 — `npm run build` + `npm run build:server` pasan. Verificación funcional en Railway pendiente al desplegar.

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
- **Build dual module**: raíz `"type":"module"`, server compila a CJS; post-build drop `dist/server/package.json` con `{"type":"commonjs"}`.

## Variables de entorno Railway

| Var | Valor |
|---|---|
| `DATABASE_URL` | Inyectada por plugin PostgreSQL |
| `JWT_SECRET` | String aleatorio largo |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | Inyectado por Railway |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | Dominio Railway (ej. `https://beast-hub.up.railway.app`) |

## Pasos para desplegar

1. Crear proyecto Railway + plugin PostgreSQL.
2. Conectar repo, branch `claude/railway-prod-RbRe3`.
3. Configurar vars de entorno (arriba).
4. Ejecutar migración manual tras primer deploy: `railway run npm run migrate` (o añadir step al deploy).
5. Crear primer usuario admin en DB (bcrypt del password) o añadir endpoint de seed.

---

# CLAUDE.md — Behavioral guidelines

- **Think before coding**: declarar supuestos; preguntar si hay ambigüedad.
- **Simplicity first**: mínimo código, sin abstracciones especulativas ni error handling imposible.
- **Surgical changes**: tocar solo lo pedido; limpiar huérfanos propios, no dead code ajeno.
- **Goal-driven**: criterio de éxito verificable antes de implementar.
