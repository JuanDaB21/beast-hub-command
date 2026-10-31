# Plan CRO — beastclub.store (oct-2026)

Diagnóstico de conversión de la tienda Shopify y plan priorizado. Fuentes: Meta Ads Insights (12-sep → 11-oct-2026, solo tráfico pagado) y auditoría en vivo en móvil 375×812 (tema **Fabric 4.1.5**).

## 1. Embudo real (Meta, 30 días)

| Paso | Eventos | Conversión del paso | Referencia moda/COD Colombia |
|---|---:|---:|---:|
| Landing page view | 3.213 | — | — |
| Add to cart | 598 | 18,6 % de LPV | 6–10 % → **bueno** |
| Initiate checkout | 256 | 42,8 % de ATC | 55–65 % → bajo |
| Add payment info | 75 | 29,3 % de IC | — |
| Purchase | 63 | **24,6 % de IC** | 45–55 % → **fuga principal** |
| **LPV → compra** | | **1,96 %** | |

- Gasto 688.929 COP · CPC 131 COP · CTR 4,1 % · CPA ≈ 10.900 COP · ticket pixel ≈ 152.000 COP.
- Conclusión: el tráfico y el producto **sí enganchan** (ATC alto). El dinero se pierde **entre el carrito y el pago**: 3 de cada 4 personas que inician checkout lo abandonan.

## 2. Hallazgos de la auditoría (por impacto)

1. **Sorpresa de envío en checkout**: camiseta 59.900 → total 78.900 (+19.000, +32 %). El carrito dice "los gastos de envío se calculan en la página de pago". Es la causa #1 de abandono en checkout.
2. **Promesa contradictoria**: el home anuncia "ENVÍOS GRATIS" y la barra del carrito exige 300.000 COP (≈5 prendas, el doble del ticket medio). Rompe confianza justo antes de pagar.
3. **Checkout estándar largo para COD**: correo/teléfono, nombre, apellidos, dirección, ciudad, departamento, método de envío y pago; la opción "Pago contra entrega" queda abajo, detrás de Wompi. En Colombia el comprador de anuncio espera un formulario COD de un paso.
4. **PDP móvil**: el botón "Agregar al carrito" queda bajo el pliegue (y=883 px en pantalla de 812), sin barra fija. Bajo el precio no hay señales de confianza (contra entrega, tiempo de entrega, cambios); el primer bloque visible tras el CTA es el crédito SU+Pay/Bancolombia.
5. **Agregar al carrito sin feedback**: solo aparece un ✓; no abre cajón de carrito ni sugiere siguiente paso. Página de carrito titulada "Cart" (inglés).
6. **Home**: la primera pantalla móvil es negra con "BEAST CLUB / WARWOLF: CHAPTER I" — ningún producto ni oferta visible. Verificar si el video/imagen del hero no carga.
7. **Prueba social escasa**: 6 reseñas en el best-seller; fotos de producto mayoritariamente generadas con IA (riesgo de desconfianza en ropa: "¿así se ve en la vida real?").
8. **Checkout sin marca**: logo de texto "Beast Club", sin colores de la marca.
9. **Riesgo de marca**: títulos con "GYMSHARK", "YOUNGLA SUPERMAN". Además del riesgo legal, Meta puede restringir anuncios/catálogo que nombren marcas.
10. **Peso**: 127 scripts y 283 peticiones en la PDP (Trustoo, vstar, Apex upsell, botón WhatsApp). Carga aceptable en escritorio; revisar en 4G.

---

## 3. Plan completo (aprobado 2026-10-12)

### Contexto
La tienda convierte el 1,96 % del tráfico pagado (Meta, 12-sep→11-oct-2026). El producto sí engancha (18,6 % agrega al carrito), pero el 75 % de quienes inician el pago lo abandonan (IC→compra 24,6 %; lo normal en moda/COD es 45–55 %). Restricción del dueño: **mejorar ventas sin aumentar costos**. No se instalan apps de pago ni se cambia el envío (19.000 COP fijo a todo el país). Todo se hace con código del tema, configuración nativa de Shopify, catálogo (etiquetas, colecciones, orden) y Beast Hub.

Resultado esperado: IC→compra ≥45 % y visita→compra ≥3,5 % en 30 días, con el mismo presupuesto de Meta.

---

### A. Paso a paso: crear la app de Shopify (lo hace el dueño)

Desde el 1-ene-2026 Shopify ya no deja crear "apps personalizadas" heredadas en el admin. Ahora se crean en el **Dev Dashboard**, y el token se obtiene con *client credentials*: dura 24 h y el script lo renueva solo.

1. Entrar a **https://dev.shopify.com/dashboard** con la cuenta dueña de la tienda (la misma organización de beastclub.store).
2. **Apps → Create app → "Start from Dev Dashboard"** → nombre: `Beast CRO`.
3. En la pestaña **Versions → Create version**:
   - App URL: `https://shopify.dev/apps/default-app-home` (no se usa).
   - Desmarcar "Embed app in Shopify admin".
   - **Access → Scopes**: pegar la lista de abajo.
   - **Release**.
4. **Home → Install app** → elegir la tienda beastclub → **Install**.
5. **Settings** → copiar **Client ID** y **Client secret**.
6. En Shopify Admin → Configuración → Dominios: copiar el dominio `xxxx.myshopify.com`.
7. Pegar en `beast-hub-command/.env.local` (no versionado):
   ```
   SHOPIFY_CRO_SHOP=xxxx.myshopify.com
   SHOPIFY_CRO_CLIENT_ID=...
   SHOPIFY_CRO_CLIENT_SECRET=...
   ```
8. Avisar. Claude valida con `POST https://{shop}/admin/oauth/access_token` (`grant_type=client_credentials`) y una consulta `shop { name plan }`.

**Scopes (todos necesarios para el plan):**
`read_themes, write_themes, read_products, write_products, read_inventory, read_orders, read_reports, read_analytics, read_content, write_content, read_online_store_pages, read_online_store_navigation, write_online_store_navigation, read_discounts, write_discounts, read_price_rules, read_shipping, read_files, write_files, read_translations, write_translations, read_locales, read_metaobjects, write_metaobjects, read_publications, write_publications, read_script_tags, read_checkouts, read_customers`

- `read_all_orders` **no** es válido en el Dev Dashboard (da error "alcances no válidos"). Se omite: `read_orders` cubre 60 días, y el historial completo sale de la BD de Beast Hub. Si otro scope da el mismo error, se quita ese y se sigue.
- **Envío:** solo lectura. No se cambia la tarifa.

**Reglas de seguridad de Claude con este acceso:**
- Primero se respalda el tema vivo completo en git.
- Todo cambio de código va en un **tema duplicado** (`Beast CRO – dev`) y se revisa con link de vista previa.
- Publicar el tema, borrar productos o colecciones, o cambiar precios: **siempre con tu aprobación**.
- Antes de cualquier cambio masivo de catálogo (etiquetas, títulos, colecciones) se guarda un snapshot JSON y se muestra el diff para revisión.

---

### B. Fase 0 — Análisis completo (solo lectura, días 1–2)
Scripts en `scripts/shopify-cro/` (Node CJS, mismo patrón que la lectura de `.env.local` usada para Meta). Helper `shopifyCro.cjs` que intercambia credenciales → token y expone `gql(query, vars)` con throttle. Reutilizar la lógica de paginación de `server/lib/shopifyClient.ts` como referencia (allí es REST; aquí GraphQL Admin 2026-xx).

| Análisis | Fuente | Para decidir |
|---|---|---|
| Sesiones, conversión, embudo carrito→checkout→compra por dispositivo, landing y fuente | ShopifyQL (`read_reports`) | línea base y páginas con mayor fuga |
| Vistas→ATC por producto | ShopifyQL | qué PDP fallan; qué productos empujar en anuncios y colecciones |
| Checkouts abandonados (90 días): paso alcanzado, método de pago, monto | `abandonedCheckouts` | confirmar la fuga por envío/pago |
| Pedidos: mezcla COD vs Wompi/Nequi, unidades por pedido, ticket medio, hora/día | `orders` + BD Beast Hub | foco en COD; estrategia de 2 unidades |
| Tasa de rechazo/devolución COD y margen real por prenda | BD prod Beast Hub (solo lectura) | qué ofertas son rentables |
| Catálogo: títulos, etiquetas, tipos, variantes agotadas, nº de imágenes, descripciones, SEO | `products` | limpieza de etiquetas y colecciones |
| Colecciones (smart/manual, orden, reglas), menús, plantillas | `collections`, `menus`, tema | reubicar colecciones |
| Tema Fabric 4.1.5: secciones, `templates/*.json`, locales, app embeds, peso de scripts | Theme API | lista de cambios de código |
| Tracking: Purchase del pixel vs pedidos reales | Meta + Shopify + Beast Hub | validar que la medición sea confiable |

**Entregable:** `docs/marketing/AUDITORIA_CRO_2026-10.md`, con cifras y prioridades confirmadas o ajustadas.

---

### C. Todos los puntos a mejorar (costo $0)

#### C1. Envío (19.000 fijo) — transparencia, no regalo
1. Anunciarlo desde el principio:
   - Barra superior: "Envío a toda Colombia $19.000 · Paga al recibir".
   - Bajo el precio en la PDP: "+ envío $19.000 · llega en 1–3 días hábiles".
   - En el carrito: línea "Envío: $19.000" y total final real.
2. **Eliminar "ENVÍOS GRATIS"** del home y de las FAQ, y quitar la barra "Añade 240.100 para envío gratis", salvo que se decida el punto 3.
3. Opcional, solo con tu aprobación: un umbral de envío gratis **solo** si el margen de la 2.ª prenda > 19.000. Se calcula con la BD en la Fase 0. Si no da, no se hace.

#### C2. Checkout nativo (configuración gratuita de Shopify)
4. Editor de checkout:
   - Logo, colores negro/rojo y tipografía de marca.
   - Contacto por **teléfono** como primer campo (el COD lo necesita).
   - Nombre obligatorio (hoy dice "opcional").
   - Código postal oculto.
5. Pagos:
   - Renombrar "Pago contra entrega" a "💵 Paga en efectivo al recibir (contra entrega)".
   - Instrucciones claras de COD y de Wompi.
   - Revisar el orden de los métodos permitido en el plan.
6. Activar o redactar en español el correo de **checkout abandonado** (gratis y nativo), enviado a la 1 h.
7. Políticas (envío, cambios, privacidad) completas y en español; se enlazan en el pie del checkout.

#### C3. Página de producto (código del tema)
8. **Barra fija** en móvil con precio + "Agregar al carrito" al pasar el CTA. Hoy el botón queda bajo el pliegue (883 px en pantalla de 812).
9. **Fila de confianza** bajo el precio: Contra entrega · Envío 1–3 días · Cambio de talla · Compra segura. Bloque reutilizable en `sections/main-product`.
10. **Guía de tallas** al lado del selector (metaobjeto por tipo de prenda: oversized/slim/compresión/tank), con recomendación "si estás entre tallas…".
11. Variantes agotadas: mostrarlas tachadas con "Avísame por WhatsApp" (link `wa.me` con producto y talla), en vez de solo "No disponible".
12. Bajar el banner de crédito SU+Pay/Bancolombia debajo de la fila de confianza; queda como apoyo, no como protagonista.
13. Galería: la foto real/UGC en posición 1–2, la foto de IA después. Agregar "modelo mide X, usa talla M" en la descripción.
14. Descripción con bullets de beneficio (tela, horma, uso en gym) en vez de acordeones vacíos. "Detalles / Materiales" abiertos por defecto el primero.
15. Urgencia honesta: "Quedan N en talla M" cuando el stock < 5 (dato real de inventario, no falso).
16. Reseñas: estrellas y conteo junto al título, ya existe. Sumar el carrusel de fotos de reseñas arriba del pliegue.

#### C4. Carrito
17. Al agregar: abrir el **cajón de carrito** (Fabric lo soporta; hoy solo muestra ✓).
18. Traducir "Cart" y demás textos en inglés (locales del tema).
19. Recomendaciones del carrito: excluir agotados (hoy aparece "ALPHA Cargo AGOTADO") y priorizar complementos (camiseta → tank/short).
20. Mostrar "Total con envío" y la fila de confianza en el carrito; botón "Finalizar compra – paga al recibir".

#### C5. Home, colecciones y navegación (reubicación)
21. Hero móvil con **producto + oferta + CTA** en la primera pantalla. Hoy es negro con "WARWOLF: CHAPTER I"; verificar si el video falla.
22. Orden del home según los datos de la Fase 0: Best sellers → Oferta → Compresión → Hombre/Mujer → Nuevo drop. Mover "Gymshark" (bloque de marca) fuera del home.
23. Menú: Hombre / Mujer / Compresión / Oversized / Ofertas / Más vendidos; sin ramas vacías.
24. Orden de productos dentro de cada colección: manual por ventas y conversión reales, agotados al final (`collectionReorderProducts`).
25. Colecciones automáticas basadas en etiquetas normalizadas (ver C6), para que se mantengan solas.
26. Filtros (Search & Discovery, app gratis de Shopify): talla, tipo, color, género.

#### C6. Catálogo: etiquetas, títulos y SEO
27. Taxonomía de etiquetas: `genero:hombre|mujer|unisex`, `tipo:oversized|slim|compresion|tank|hoodie|jogger|short`, `linea:<colección>`, `estado:best-seller|nuevo|oferta`, `color:<…>`. Script con modo dry-run + diff + snapshot antes de aplicar.
28. Tipo de producto y categoría de Shopify completos (mejoran filtros y Google Shopping).
29. Títulos y SEO:
    - Quitar las comillas `"GYMSHARK"`.
    - Formato `<Nombre> – Camiseta Oversized de Gym`.
    - **Decisión del dueño**: retirar las marcas de terceros de los títulos (riesgo con Meta y Google).
30. Alt text de las imágenes y meta descripciones en español.

#### C7. Prueba social y recompra (Beast Hub, gratis)
31. Solicitud de reseña post-entrega: Beast Hub ya conoce los pedidos `delivered`. Generar la lista diaria con link de reseña y mensaje de WhatsApp listo para enviar (sin app de pago). Meta: 20+ reseñas con foto en los 5 best-sellers.
32. Página "Clientes Beast" / sección UGC con fotos de clientes, con permiso.

#### C8. Velocidad
33. Auditar los 127 scripts y 283 peticiones: desactivar app embeds sin uso, cargar en diferido Trustoo/WhatsApp, y lazy-load de imágenes bajo el pliegue. Medir LCP móvil antes y después (PageSpeed API, gratis).

#### C9. Anuncios ↔ landing (coherencia)
34. Cada anuncio apunta a la PDP específica con la variante del creativo. Nada de home ni colecciones genéricas: hoy "Banner Best seller" va a la colección.
35. El mensaje del anuncio = el de la página (precio, "paga al recibir", envío 19.000).

#### C10. Medición
36. Validar el Purchase del pixel contra los pedidos reales (deduplicación pixel/CAPI).
37. Tablero semanal (script): sesiones, CR, IC→compra y ticket, comparando 14 días antes vs. después de cada bloque, con el presupuesto de Meta constante.

---

### D. Orden de ejecución
| Semana | Bloque | Tipo |
|---|---|---|
| 1 | A (app) + B (análisis) + respaldo del tema en git | lectura |
| 1 | C1.1–2, C2 (checkout nativo, abandonado, políticas) | config, sin código |
| 2 | C3 + C4 en tema duplicado → preview → **aprobación** → publicar | código del tema |
| 3 | C5 + C6 (colecciones, menú, etiquetas, títulos) con dry-run + aprobación | API catálogo |
| 3–4 | C7, C8, C9 | Beast Hub + tema + Meta |
| continuo | C10 | medición |

### E. Archivos
- `scripts/shopify-cro/shopifyCro.cjs`: token + `gql()`.
- `scripts/shopify-cro/` (en el repo): `audit-*.cjs` (análisis), `tags-plan.cjs` (dry-run/aplicar), `collections-reorder.cjs`, `theme-pull.cjs` / `theme-push.cjs` (solo al tema dev).
- Copia del tema en un repo aparte `BEAST CLUB/beastclub-theme/` (git), separada de Beast Hub.
- Docs: `docs/marketing/PLAN_CRO_OCT_2026.md` (se actualiza con este plan) y `docs/marketing/AUDITORIA_CRO_2026-10.md`.
- Memoria: `shopify-store-cro.md` (app, scopes, reglas).

### F. Verificación
- Token: consulta `shop { name }` OK y renovación automática a las 24 h.
- Tema dev: revisión en móvil 375 px con el navegador:
  - CTA visible y barra fija.
  - Cajón del carrito.
  - Envío visible antes del checkout.
  - Sin textos en inglés.
  - Sin errores en consola.
  - LCP igual o mejor.
- Recorrido completo hasta el checkout (sin pagar) verificando campos, COD y branding.
- Catálogo: el diff aplicado coincide con el dry-run, y las colecciones automáticas tienen el nº de productos esperado.
- Negocio: a los 14 días, comparar IC→compra y CR contra la línea base (24,6 % / 1,96 %).
