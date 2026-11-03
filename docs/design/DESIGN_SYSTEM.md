# Sistema de diseño — Beast Hub Command

Concepto: **cabina de bodega**. Herramienta operativa densa, grafito/acero, un solo acento (naranja Beast) y las cifras como protagonistas. La audacia se concentra en los números (KPIs, totales, stock); todo lo demás queda sobrio.

Fuente de verdad de tokens: `src/index.css` (HSL) y `tailwind.config.ts`.

## Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Display | **Khand** 500/600/700 (Fontshare) | Títulos de página, cifras (`StatTile`, totales, stock), títulos de diálogo. Clase `font-display`. |
| UI | **Switzer** 400–700 (Fontshare) | Todo lo demás. Clase por defecto `font-sans`. |

- Autoalojadas en `public/fonts/*.woff2` (sin CDN en runtime); `index.html` precarga 3 pesos.
- Cifras alineadas: tablas e `input[type=number]` usan `tabular-nums`; para otros elementos, clase `tabular`.
- Sin etiquetas en MAYÚSCULAS ni monoespaciada para datos (excepto código/consultas en Configuración).

## Color

| Token | Uso |
|---|---|
| `background`, `card`, `surface-2`, `surface-3` | Jerarquía por tono, no por sombra. `surface-*` para paneles dentro de paneles. |
| `primary` | Acción neutra fuerte (grafito en claro, casi blanco en oscuro). |
| `brand` / `brand-foreground` / `brand-soft` / `brand-ink` | Naranja Beast. Botón `variant="brand"` = acción principal de la página (una por vista). Texto encima siempre oscuro (AA). |
| `accent` | Hover/selección neutra (semántica shadcn). **No** es el naranja. |
| `success` / `warning` / `danger` / `info` (+ `-soft`, `-ink`) | Estados. `-soft` para fondos, `-ink` para texto sobre `-soft`. |
| `status-green/yellow/red` | Alias heredados de los anteriores. |
| `chart-1..6` | Series de gráficos (`hsl(var(--chart-n))`). Nada de `hsl()` literales. |

Prohibido en features: colores Tailwind crudos (`amber-50`, `red-600`, …). Todo pasa por tokens; así claro/oscuro funcionan solos.

Tema: `next-themes` (`attribute="class"`, `defaultTheme="system"`). Selector en el pie del sidebar, en el drawer "Más" y en la paleta `Ctrl/⌘+K`.

## Movimiento (easings.net)

| Token Tailwind | Curva | Uso |
|---|---|---|
| `ease-out-quint` | `cubic-bezier(0.22,1,0.36,1)` | Entradas, hover, cambios de estado. |
| `ease-out-expo` | `cubic-bezier(0.16,1,0.3,1)` | Hojas inferiores, sheets. |
| `ease-in-out-cubic` | `cubic-bezier(0.65,0,0.35,1)` | Transiciones simétricas. |
| `duration-fast/base/slow` | 120 / 200 / 320 ms | |

Movimiento solo como respuesta a una acción. `prefers-reduced-motion` lo anula globalmente. Único efecto ambiental: el shader de `Auth` (`ShaderBackdrop`), pausado fuera de pantalla y estático con reduced-motion.

## Forma

Radio jerárquico: contenedores `rounded-xl` (16 px), controles `rounded-md` (8 px), chips `rounded-full`. Tarjetas sin sombra; el borde y el tono separan.

## Shell y navegación

- `AppLayout` (layout route en `App.tsx`) es persistente: sidebar en `md+`, `MobileBottomNav` en `<md` (4 accesos fijos de `MOBILE_PRIMARY` + "Más" en drawer), paleta `CommandMenu` (`Ctrl/⌘+K`).
- `AppShell` ya solo pinta el encabezado + `<main>` de la página (mismo API `title/description/actions`). El `<main>` reserva espacio para la barra inferior (`pb-bottom-nav`).
- Navegación declarada una vez en `src/lib/modules.ts` (`NAV_SECTIONS`, `MOBILE_PRIMARY`, `isModuleActive`).

## Patrones responsive (usar estos, no reinventar)

| Necesidad | Componente / técnica |
|---|---|
| Fila de KPIs | `StatStrip` + `StatTile` (o `KpiCard`, que delega). Tira deslizable con snap en móvil, grilla en desktop. |
| Cifra protagonista | `StatTile size="hero"` o bloque héroe como en `pages/Index.tsx`. |
| Acción principal | `<Button variant="brand">` con etiqueta corta visible en móvil (`Nuevo<span className="hidden sm:inline"> pedido</span>`). |
| Acciones secundarias / destructivas | `OverflowMenu` (menú ⋯; las destructivas van al final en rojo). |
| Detalle de una entidad | `DetailPanel` (hoja inferior arrastrable en móvil, panel lateral en desktop) o `EntityDetailCard`. |
| Formularios en diálogo | `Dialog` normal: bajo `sm` se convierte solo en hoja inferior (`ui/dialog.tsx`, `ui/alert-dialog.tsx`). |
| Tabla en móvil | Lista `md:hidden` + tabla `hidden md:block` (ver `OrdersHistoryTable`, `FinanceLedgerTable`), o clase CSS `stack-table` + `data-label` en celdas para tablas editables (ver `OrderDetails`). |
| Kanban | Columnas en `md+`; en móvil pestañas por estado + "Mover a" en cada tarjeta (`OrdersBoard`). Sensores `MouseSensor` + `TouchSensor` (delay 250 ms) para no bloquear el scroll. |
| Pestañas + búsqueda | Misma fila en desktop, apiladas en móvil (`TabsList` a ancho completo). |
| Muchas secciones | Selector `Select` en móvil, navegación lateral en desktop (`pages/Config.tsx`). |
| CTA de un panel largo | Barra `sticky bottom-0` en móvil (ver `SupplyRequestDetails`). |

Objetivos táctiles ≥ 40–44 px en móvil (botones `h-10`/`h-11`, checkbox 20 px bajo `sm`). Safe areas: utilidades `pt-safe`, `pb-safe`, `viewport-fit=cover`.

## Moneda y fechas

`formatCOP` y `timeAgo` en `src/lib/format.ts`. Toda cifra monetaria en COP sin decimales (`es-CO`).

## QA local sin tocar producción

La revisión visual de esta fase se hizo con un Postgres embebido (`embedded-postgres`, fuera del repo, BD creada con `ENCODING 'UTF8'`), la API real (`npx tsx server/index.ts` con `DATABASE_URL` local y un `JWT_SECRET` de prueba) y `npm run dev`, sembrando datos ficticios por SQL. Nunca contra la BD de Railway: el bootstrap corre migraciones y `seedAdmin()`.
