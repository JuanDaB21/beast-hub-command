# Beast Hub Command — Tareas de Migración a Railway

## Contexto del Proyecto

Beast Hub Command es una SPA React/Vite/TypeScript para gestión de la empresa de camisetas "Beast Club". Actualmente usa **Supabase** como backend completo (autenticación, base de datos PostgreSQL, Edge Functions). El objetivo es migrar el despliegue a **Railway** usando su plugin de PostgreSQL nativo, reemplazando la dependencia de Supabase con un backend Node.js/Express propio.

### Arquitectura Target en Railway

```
Railway Project
├── Service 1: "backend" (Node.js/Express + archivos estáticos del frontend)
│   ├── Puerto: 3000
│   ├── API REST: /api/*
│   ├── Archivos estáticos: dist/ (frontend buildeado)
│   └── Build: npm run build && npm run build:server
└── Plugin: PostgreSQL
    └── DATABASE_URL (inyectada automáticamente por Railway)
```

Un solo servicio Railway sirve tanto el backend como el frontend en modo SPA.

---

## FASE 1 — Backend Node.js/Express

### Tarea 1.1: Inicializar servidor TypeScript
- [ ] Crear `server/tsconfig.json` con target ES2022, module commonjs
- [ ] Instalar dependencias runtime: `express pg jsonwebtoken bcryptjs cors dotenv`
- [ ] Instalar devDependencies: `@types/express @types/pg @types/jsonwebtoken @types/bcryptjs tsx`

### Tarea 1.2: Conexión a PostgreSQL
- [ ] Crear `server/db.ts` con Pool de `pg` usando `DATABASE_URL`
- [ ] Configurar max connections y SSL para Railway

### Tarea 1.3: Autenticación JWT
- [ ] Crear tabla `users` en DB (email, password_hash, name, role)
- [ ] Crear `server/auth.ts` con rutas:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- [ ] Implementar middleware `requireAuth` que valida JWT en header `Authorization`

### Tarea 1.4: Rutas API por módulo
Crear archivos en `server/routes/`:
- [ ] `products.ts` (inventory) — CRUD completo
- [ ] `orders.ts` + `order-items.ts` — CRUD + generación de `order_number`
- [ ] `suppliers.ts` (sourcing) — CRUD
- [ ] `raw-materials.ts` — CRUD con filtros
- [ ] `work-orders.ts` (production) — CRUD + endpoint para `complete_work_order()`
- [ ] `supply-requests.ts` — CRUD + `complete_supply_request()`
- [ ] `logistics.ts` — queries de órdenes por estado de envío
- [ ] `returns.ts` — CRUD
- [ ] `cod.ts` — confirmación COD
- [ ] `staff.ts` — gestión de staff/profiles
- [ ] `bi.ts` — queries de analytics/business intelligence
- [ ] `supplier-portal.ts` — endpoint público por token (reemplaza Edge Function de Supabase)
- [ ] `config.ts` — `global_configs` CRUD
- [ ] `catalogs.ts` — categories, subcategories, colors, sizes

### Tarea 1.5: Entry point del servidor
- [ ] Crear `server/index.ts`: Express app, CORS, JSON body parser, rutas, servir estáticos de `dist/`
- [ ] Agregar ruta `GET /api/health` para healthcheck de Railway

---

## FASE 2 — Base de Datos en Railway

### Tarea 2.1: Preparar migraciones para Railway PostgreSQL
- [ ] Crear `server/migrations/` consolidando los 15 archivos de `supabase/migrations/`
- [ ] Eliminar referencias a `auth.users` de Supabase → usar tabla `users` propia
- [ ] Eliminar políticas RLS (el backend controla el acceso)
- [ ] Conservar todos los triggers y funciones almacenadas (`complete_work_order`, `complete_supply_request`, `set_updated_at`, `recalc_order_total`, `handle_new_user`, `validate_return`)
- [ ] Crear `server/migrate.ts` que ejecuta los archivos SQL en orden

### Tarea 2.2: Variables de entorno
Configurar en Railway las siguientes variables:
- [ ] `DATABASE_URL` — inyectada automáticamente por Railway
- [ ] `JWT_SECRET` — secret para firmar tokens
- [ ] `JWT_EXPIRES_IN` — expiración del token (ej: `"7d"`)
- [ ] `PORT` — puerto del servidor (Railway lo provee)
- [ ] `NODE_ENV` — `"production"`
- [ ] `CORS_ORIGIN` — URL del frontend en Railway

---

## FASE 3 — Migración del Frontend

### Tarea 3.1: Nuevo cliente API
- [ ] Crear `src/integrations/api/client.ts` con fetch wrapper:
  - `baseUrl` desde `VITE_API_URL` o relativo `/api`
  - Agrega `Authorization` header desde localStorage (JWT)
  - Maneja errores uniformemente

### Tarea 3.2: Reemplazar AuthProvider
- [ ] Modificar `src/features/auth/AuthProvider.tsx`:
  - Eliminar imports de `@supabase/supabase-js`
  - Login via `POST /api/auth/login`
  - Persistir JWT en `localStorage`
  - `getSession` via `GET /api/auth/me` al cargar

### Tarea 3.3: Migrar api.ts de cada módulo (×11)
Para cada `src/features/*/api.ts`:
- [ ] Eliminar `import { supabase }`
- [ ] Reemplazar `supabase.from().select()` con `apiClient.get()`
- [ ] Reemplazar `supabase.from().insert()` con `apiClient.post()`
- [ ] Reemplazar `supabase.from().update()` con `apiClient.put()`
- [ ] Reemplazar `supabase.from().delete()` con `apiClient.delete()`
- [ ] Preservar la firma de `useQuery`/`useMutation` (no cambia el contrato con los componentes UI)

Módulos a migrar: `inventory`, `orders`, `production`, `sourcing`, `supply-requests`, `logistics`, `returns`, `cod`, `staff`, `bi`, `supplier-portal`

### Tarea 3.4: Actualizar variables de entorno del frontend
- [ ] Eliminar: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- [ ] Agregar: `VITE_API_URL` (vacío en producción para usar rutas relativas)

### Tarea 3.5: Proxy de desarrollo en Vite
- [ ] Modificar `vite.config.ts`: agregar `server.proxy` → `/api` → `http://localhost:3000`

---

## FASE 4 — Configuración de Railway

### Tarea 4.1: railway.toml
- [ ] Crear `railway.toml` en la raíz con:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "npm install && npm run build && npm run build:server"

[deploy]
startCommand = "node dist/server/index.js"
healthcheckPath = "/api/health"
restartPolicyType = "ON_FAILURE"
```

### Tarea 4.2: Scripts en package.json
- [ ] `"build:server"`: `tsc -p server/tsconfig.json`
- [ ] `"start"`: `node dist/server/index.js`
- [ ] `"migrate"`: `tsx server/migrate.ts`
- [ ] `"dev:server"`: `tsx watch server/index.ts`

### Tarea 4.3: .env.example
- [ ] Crear `.env.example` documentando todas las variables requeridas para Railway

---

## FASE 5 — Verificación

### Checklist de pruebas
- [ ] `npm run dev` + `npm run dev:server` corren localmente sin errores
- [ ] Login funciona con JWT
- [ ] CRUD de productos (inventario) funciona
- [ ] Creación de orden y cálculo de total (trigger `recalc_order_total`) funciona
- [ ] `complete_work_order()` descuenta materiales y suma stock
- [ ] Portal de proveedores funciona con token público
- [ ] Build de producción: `npm run build && npm run build:server`
- [ ] Migraciones corren: `npm run migrate`
- [ ] Despliegue en Railway exitoso

---

## Orden de Implementación Recomendado

1. **FASE 2.1** — Migraciones DB (base de todo)
2. **FASE 1.2** — `db.ts` (conexión a PostgreSQL)
3. **FASE 1.3** — `auth.ts` (autenticación primero)
4. **FASE 1.4** — Rutas (backend completo)
5. **FASE 1.5** — Entry point (servidor listo)
6. **FASE 3.1** — Cliente API (abstracción frontend)
7. **FASE 3.2** — `AuthProvider` (auth frontend)
8. **FASE 3.3** — `api.ts` ×11 (migración módulo por módulo)
9. **FASE 3.4 + 3.5** — Env vars + proxy (config dev)
10. **FASE 4** — `railway.toml` + scripts (config despliegue)
11. **FASE 5** — Verificación (pruebas finales)

---

## Dependencias a Instalar

```bash
# Backend (runtime)
npm install express pg jsonwebtoken bcryptjs cors dotenv

# Backend (types)
npm install -D @types/express @types/pg @types/jsonwebtoken @types/bcryptjs tsx

# Eliminar (una vez que no queden referencias)
npm uninstall @supabase/supabase-js
```

---

## Notas Importantes

1. **Triggers y funciones PostgreSQL** son SQL estándar — funcionan igual en Railway PostgreSQL sin cambios.
2. **Supplier portal** (actualmente Deno Edge Function) se convierte en una ruta Express pública con validación de `secure_token`.
3. **RLS**: No se necesita en el backend propio — el middleware `requireAuth` protege todas las rutas salvo las públicas.
4. **`lovable-tagger`** en `vite.config.ts` es para la plataforma Lovable — se puede mantener o eliminar sin afectar el build.
5. **Tipos de Supabase** (`src/integrations/supabase/types.ts`) pueden mantenerse como referencia para los tipos TypeScript del dominio, o reemplazarse con interfaces propias.

---

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
