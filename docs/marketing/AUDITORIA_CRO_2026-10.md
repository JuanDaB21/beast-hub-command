# Auditoría CRO — beastclub.store (2026-10-12)

Fuentes: Shopify Admin API (app "Beast CRO"), ShopifyQL (60 días: 14-ago → 12-oct-2026), 127 pedidos, 72 checkouts abandonados, catálogo completo (147 productos, 28 colecciones, 3 menús) y respaldo del tema publicado (`BEAST CLUB/beastclub-theme`, git `775ab0b`). Scripts: `scripts/shopify-cro/` (`audit-catalog.cjs`, `audit-sales.cjs`).

## 1. Embudo real (Shopify, 60 días)

| Dispositivo | Sesiones | Agregan al carrito | Llegan a checkout | Compran | CR |
|---|---:|---:|---:|---:|---:|
| Móvil | 9.687 (90 %) | 613 (6,3 %) | 431 (70 % de ATC) | 111 (**25,8 % de checkout**) | 1,15 % |
| Escritorio | 1.023 | 41 (4,0 %) | 37 | 11 | 1,08 % |

Dos fugas:
1. **Sesión → carrito: 6,3 %.** Bajo (referencia de moda: 8–12 %). Explicado por el catálogo agotado y por la home.
2. **Checkout → compra: 25,8 %.** Muy bajo (referencia: 45–55 %). Explicado por el envío y la desconfianza.

(Meta reporta 18,6 % visita→carrito porque cuenta eventos, no sesiones; para decisiones se usa Shopify).

### Por página de entrada
| Landing | Sesiones | ATC | Compras | CR |
|---|---:|---:|---:|---:|
| `/` (home) | **5.688 (53 %)** | 6,5 % | 61 | 1,07 % |
| `/collections/compresion` | 1.046 | 3,1 % | 5 | **0,48 %** |
| `/products/chaos-tee-training-shirt` | 771 | 3,4 % | 3 | **0,39 %** |
| `/products/gym-shark-training-shirt` | 456 | 8,3 % | 5 | 1,10 % |
| `/products/dark-beast-training-shirt` | 390 | 4,1 % | 1 | 0,26 % |
| `/collections/best-sellers` | 233 | 9,0 % | 5 | 2,15 % |
| `/products/motor-youngla-training-tank-top` | 191 | 8,4 % | 5 | 2,62 % |

Tráfico: social 65 %, directo 30 %, búsqueda 3 %. El 66 % compra el mismo día de la primera visita.

### Pedidos (127, sin cancelados en Shopify)
- Pago: **contra entrega 51 %**, Wompi 30 %, Nequi 19 %.
- Unidades por pedido: 1 → 46 %, 2 → 32 %, 3+ → 22 %. Ticket medio 146.622 COP (mediana 138.800).
- Envío cobrado: **19.000 en los 127 pedidos**.
- Top: "GYMSHARK" Training Shirt (58 u, un tercio de las ventas), Chaos Tee 17, Chaos Tank 16, GS Tank 13, Motor YoungLA 12, Cropped Tee 11.
- Horas pico (COL): 9–14 h y 20–22 h. Días parejos.
- Ciudades: Bogotá 24, Antioquia 20, Cundinamarca 13, Nariño 12, Valle 10.

### Checkouts abandonados
- **72 sin recuperar** (jul→oct), valor 9.655.000 COP. 67 tienen dirección (y teléfono): se pueden recuperar a mano por WhatsApp, a costo cero.
- El 64 % son de 1 prenda. Ahí el envío pesa más: 59.900 + 19.000 = +32 %.

## 2. Hallazgos críticos (ordenados por impacto)

### H1. El catálogo visible está mayormente agotado
- Productos activos: **40 de 99 sin ninguna talla disponible**; 44 se venden con inventario 0 (bajo pedido), y solo 15 tienen stock real.
- Primeras filas de las colecciones clave:

| Colección | Agotados en la primera fila |
|---|---|
| Best Sellers | 10 de 14 |
| Camisetas Oversized (`frontpage`) | 14 de 16 |
| Descuentos | 10 de 14 |
| Hombre | 10 de 15 |

- Colecciones totalmente agotadas o vacías **enlazadas en el menú**: Hoodies (7/7), Camisetas Slim (8/10), Joggers (3/3), Tanks Mujer (2/2), Crop tops (0 activos), Leggins (0), Shorts Mujer (0).
- La talla 2XL está en 0 en casi todos los productos.
- La inconsistencia de política (unos se venden bajo pedido y otros no) parece accidental.

### H2. Tres promesas de envío distintas, y ninguna se cumple
| Dónde | Qué dice |
|---|---|
| Home (FAQ) | "ENVÍOS GRATIS" |
| FAQ del producto | gratis desde 250.000 |
| Barra del carrito (app Apex) | gratis desde 300.000 |
| Checkout | siempre cobra 19.000 |

**10 pedidos ≥ 250.000 pagaron envío igual.** Además, la FAQ de contra entrega dice que "la transportadora cobra una tarifa adicional", y la de seguridad menciona **PayU** (se usa Wompi).

### H3. La home (53 % del tráfico) no vende en la primera pantalla
- El hero es negro, con "BEAST CLUB / WARWOLF: CHAPTER I" y sin producto. Warwolf: 26 activos, 18 agotados.
- No hay barra de anuncios con la propuesta (contra entrega / envío / cambios).

### H4. El carrito no se abre al agregar
`cart_type: drawer`, pero falta `auto_open_cart_drawer` en `config/settings_data.json`, así que el cliente solo ve un ✓. El título de la página de carrito es "Cart" (en inglés).

### H5. Ficha de producto
- El CTA queda bajo el pliegue en móvil y no hay barra fija.
- No hay fila de confianza bajo el precio; lo primero que aparece después del CTA es el crédito SU+Pay.
- Faltan los textos alternativos de las imágenes en los 99 productos, y SEO title/description en 98–99.
- Los 99 títulos van entre comillas. 13 títulos nombran marcas de terceros (Gymshark, YoungLA, Batman, Superman), y además 38 productos tienen vendor "Gymshark" y 22 "YoungLA".
- `productType` vacío en 43 productos.

### H6. Etiquetas y colecciones
- Solo existen 5 etiquetas: `Hombre`, `Mujer`, `beastclub`, `gymshark`, `Youngla`. No hay tipo, línea ni estado.
- Hay 3 colecciones vacías (Training Cargo, Leggins & Shorts, Conjuntos).
- "Nueva colección" agrupa 132 productos (37 agotados): no es nueva.
- El menú del pie de página solo tiene "Búsqueda": ni políticas, ni contacto, ni cambios.

### H7. Destinos de anuncios
- `/collections/compresion` recibió 1.046 sesiones con un CR de 0,48 %: tiene solo 4 productos, uno agotado y 13 unidades en total.
- La Chaos Tee (771 sesiones, CR 0,39 %) tiene la variante gris/crema y la 2XL en 0.

## 3. Acciones (costo $0), ordenadas por impacto/esfuerzo

| # | Acción | Fuga | Esfuerzo |
|---|---|---|---|
| 1 | Resolver los agotados (decisión §4.1): vender bajo pedido lo que se pueda estampar, o mandar los agotados al final / ocultarlos de las colecciones y la home | ATC | bajo (API) |
| 2 | Una sola verdad de envío: "Envío $19.000 a toda Colombia · paga al recibir" en la barra de anuncios, la ficha, el carrito y las FAQ. Quitar la barra Apex de 300k y los "ENVÍOS GRATIS" | checkout | bajo (tema) |
| 3 | Abrir el carrito al agregar (`auto_open_cart_drawer`) y traducir "Cart" | ATC→checkout | trivial |
| 4 | Hero de la home con el best-seller (GYMSHARK Training Shirt) + precio + CTA; productos con stock en la primera pantalla | ATC | bajo |
| 5 | Recuperar a mano los 72 checkouts abandonados por WhatsApp; activar el correo nativo de abandono | checkout | bajo |
| 6 | Fila de confianza bajo el precio + barra fija de compra en móvil + guía de tallas junto al selector | ATC / checkout | medio |
| 7 | Limpiar el menú: quitar las colecciones vacías o agotadas; pie de página con políticas, cambios y contacto | confianza | bajo |
| 8 | Checkout: logo y colores, teléfono primero, nombre obligatorio, texto de COD sin "tarifa adicional" (si no aplica) | checkout | bajo (admin) |
| 9 | Taxonomía de etiquetas + colecciones automáticas que excluyan agotados (`VARIANT_INVENTORY > 0` ya se usa en 2 colecciones) | ATC | medio |
| 10 | SEO y alt text en 99 productos, `productType`, títulos sin comillas (y sin marcas, según §4.3) | tráfico orgánico / confianza | medio (API) |
| 11 | Anuncios: dirigir al PDP del GYMSHARK Training Shirt / Motor tank (CR 1,1–2,6 %), no a compresión ni a la home | volumen | bajo (Meta) |

## 4. ¿Desde qué monto es rentable el envío gratis?

Datos: BD de Beast Hub, 138 pedidos de 90 días, sin cancelados.
- Costo unitario con la fórmula canónica de `ProductProfitPanel`: BOM base + tinta + impresión a 45.000/m + procesos.
- Comisiones: Shopify 2 %; Wompi 3 % + 900 o contra entrega 5 %.
- El flete real que paga la empresa ≈ 18.817 por pedido. El envío de 19.000 es **pase directo**: hoy no deja ni quita margen.

| Prendas por pedido | Pedidos | Subtotal medio | Contribución (antes de pauta) | Margen |
|---|---:|---:|---:|---:|
| 1 | 59 (43 %) | 66.680 | 23.910 | 36 % |
| 2 | 48 (35 %) | 131.510 | 49.754 | 38 % |
| 3 | 15 (11 %) | 196.840 | 75.210 | 38 % |
| 4+ | 16 (12 %) | 299.275 | 123.129 | 41 % |

Contribución media por pedido: **49.979 COP**. Cada prenda adicional aporta ≈ 25.000.

Regalar el envío cuesta 19.000 en **cada** pedido que ya supera el umbral, aunque ese cliente hubiera comprado igual. Para cubrir ese subsidio hacen falta pedidos nuevos:

| Umbral | Pedidos que ya califican | Subsidio (90 días) | Pedidos extra para cubrirlo | Alza de conversión necesaria |
|---|---:|---:|---:|---:|
| 120.000 (2 prendas) | 47 % | 1.235.000 | 24,7 | +17,9 % ❌ |
| 150.000 | 24 % | 627.000 | 12,5 | +9,1 % ❌ |
| 180.000 | 21 % | 551.000 | 11,0 | +8,0 % |
| **200.000 (≈3 prendas)** | **15 %** | **399.000** | **8,0** | **+5,8 %** ✅ |
| 250.000 | 8 % | 209.000 | 4,2 | +3,0 % ✅ |
| 300.000 | 7 % | 171.000 | 3,4 | +2,5 % ✅ |

**Conclusión**
- Por debajo de 180.000 no es rentable: casi la mitad de los pedidos ya trae 2 prendas y se estaría regalando el envío.
- **200.000 COP (≈3 prendas)** es el punto óptimo. Funciona como palanca real para subir de 2 a 3 prendas, y solo exige ≈3 pedidos más al mes (+5,8 %) para pagarse.
- 250.000 es la opción más conservadora, pero muy pocos llegan (16 pedidos en la franja 185k–250k).

**Recomendación:** fase 1 con "Envío $19.000 a toda Colombia" (mensaje único y honesto). Fase 2, cuando el embudo ya esté corregido: **prueba de 30 días con envío gratis desde 200.000**. Criterio para mantenerla: pedidos +6 % o participación de pedidos de 3+ prendas > 30 %. Si no se cumple, se revierte.

La tarifa la cambia el dueño en Admin → Envíos (la app solo tiene `read_shipping`).

## 5. Decisiones del dueño
1. **Agotados**: ¿se pueden producir bajo pedido (estampado sobre prenda base)? ¿Y la 2XL?
2. **Envío gratis**: quitar toda promesa (19.000 siempre), o cumplir "gratis desde 250.000" (≈8 % de los pedidos; ≈190.000 COP cada 60 días).
3. **Marcas en títulos y vendor**: renombrar con nombres propios o mantener.

## 6. Ejecutado (2026-10-12)

**En vivo, aprobado por el dueño**
- Agotados al final en 17 colecciones (`collections-sold-out-last.cjs --apply`). Primeras filas: Best Sellers 10/14 → 0 agotados; Camisetas Oversized 14/16 → 0.
- Las colecciones pasan a orden MANUAL; su orden natural queda en `collections-base-sort.json`. **Re-ejecutar semanalmente** o cuando cambie el stock.
- Snapshot previo: `.out/collections-snapshot-*.json`.

**Tema "Beast CRO – dev"** (id `188477571162`, sin publicar; repo `beastclub-theme`, rama `cro-dev`)
- Barra de anuncios: "💵 Paga al recibir · Envío $19.000" / "🔁 Cambios de talla · 💬 Atención por WhatsApp".
- Hero móvil: el video también en la posición 1 (antes era pantalla negra); CTA → "VER LOS MÁS VENDIDOS" a `best-sellers`.
- Ficha de producto: línea de envío bajo el precio, fila de confianza bajo el botón, **barra fija de compra** activada.
- Carrito: se abre al agregar; título "Tu carrito"; nota "Envío: $19.000 a toda Colombia · Paga al recibir disponible"; barra Apex de 300k desactivada.
- FAQ (home y ficha): sin promesas de envío gratis; contra entrega sin "tarifa adicional"; PayU → Wompi/Nequi.
- Home: Descuentos (solo con stock) sube al 3.er bloque; "En tendencia" muestra Oversized/Tanks/Compresión/Shorts (antes Slim/Hoodies/Joggers agotados).
- Recomendaciones: sin productos agotados.
- Fix: `snippets/measure-header-heights.liquid` lanzaba un SyntaxError con dos heroes en la home.

**Pendiente del dueño**
1. Publicar el tema dev (Admin → Tienda online → Temas → "Beast CRO – dev" → Publicar).
2. Política de envío: quitar "envío gratis > $250.000" (ver texto sugerido en el informe).
3. Editor de checkout: logo, colores, teléfono primero, nombre obligatorio.
4. Aprobar la limpieza del menú (colecciones vacías o agotadas).

## 7. Ejecutado — lote 3 (2026-10-12)

**Regla de envío definida por el dueño:**
- Envío GRATIS desde $250.000 **solo pagando en línea** (Wompi/Nequi).
- Contra entrega siempre paga $19.000: la transportadora exige que remitente o destinatario pague todo.
- Interrapidísimo **no publica** su tarifa. En los datos (56 pedidos contra entrega, ago–oct) cada "Pago Inter" coincide con el valor exacto de los productos: Inter gira el 100 % del producto y se queda con los $19.000 que paga el cliente (flete + comisión). No se ve un 5 % descontado aparte. El `cod_transport_fee_percent = 5` de `global_configs` podría estar sobreestimando el costo en el dashboard; conviene confirmarlo con el ejecutivo de Inter.

**En vivo:**
- Menú principal:
  - Nuevo enlace "MÁS VENDIDOS".
  - Sin Joggers/Hoodies/Crop tops/Leggins/Shorts Mujer/Tanks Mujer (vacías o agotadas).
  - SALE → OFERTAS.
  - Respaldo: `.out/menus-snapshot.json`; script `menus-update.cjs`.
- Menú `footer`: Búsqueda, Contacto, Envíos, Cambios y devoluciones, Privacidad, Términos.
- Catálogo (99 activos), con `catalog-update.cjs`; estado previo en `.out/catalog-plan-backup-*.json`:
  - Títulos sin comillas.
  - `productType` en los 43 vacíos.
  - Etiquetas `genero:`, `tipo:`, `linea:`, `estado:oferta`, `estado:best-seller` (top 10), conservando las existentes.
  - SEO title/description.
  - Alt text en 449 imágenes.

**Tema dev:**
- Textos con la nueva regla en la barra de anuncios, la ficha, las FAQ y la nota del carrito.
- Barra de progreso "Te faltan $X para envío GRATIS pagando en línea" en el carrito (`snippets/cro-free-shipping-bar.liquid`).
- El pie muestra el menú "Ayuda" + iconos de pago.
- Redes sociales reales (IG @beastclub.col, FB); antes apuntaban a instagram.com y facebook.com genéricos.

**Pendiente (requiere sesión en el admin):**
1. Tarifa de envío "Envío GRATIS – solo pago en línea" ≥ $250.000.
2. Instrucciones del pago contra entrega.
3. Política de envío.
4. Checkout (logo, colores, teléfono, nombre obligatorio).
5. Correo de checkout abandonado.
6. Publicar el tema (después del punto 1).

## 8. Ejecutado — lote 4, admin y criterio de conversión (2026-10-12)

**Criterio aplicado:** cada mensaje se conserva solo si sube la conversión.
- "Paga al recibir" va primero: el 51 % de los pedidos es contra entrega.
- Las condiciones (solo pago en línea, comisión 5 %) van solo donde evitan una sorpresa: la descripción del método contra entrega en el checkout, las FAQ y la política.
- La barra de envío gratis aparece desde $120.000 en el carrito; por debajo desmotiva.

**Admin (en vivo):**
- Envío: nueva tarifa "Envío GRATIS – solo pago en línea (Wompi o Nequi)", tipo *Importe del pedido*, mínimo $250.000, 1–3 días hábiles. "Nacional $19.000" se mantiene.
  - Shopify Basic **no** permite ocultarla si eligen contra entrega: requiere Plus o una app de pago.
  - Mitigación: el texto del método contra entrega lo advierte, y en la confirmación del pedido contra entrega la guía se crea con el envío a cargo del destinatario.
- Pago contra entrega:
  - Detalles e instrucciones reescritos: envío $19.000 + comisión de recaudo 5 % al recibir, y el tip "paga en línea y te ahorras la comisión".
  - **La comisión 5 % la paga el cliente en la puerta**, aparte del total del checkout. Por eso los "Pago Inter" coinciden con el valor del producto.
- Nequi: detalles "aprobación en minutos, sin comisión de recaudo, envío GRATIS desde $250.000".
- Checkout: logo de la tienda, encabezado negro, acento blanco, botones negros.
- Política de envío: sección de costos reescrita con la regla nueva (el resto intacto).
- Recuperación de checkout abandonado:
  - **Llevaba 0 correos enviados en 30 días**: la actividad de correo estaba en *Borrador*, y solo iba a suscritos.
  - En el editor quedó "Todos los clientes" y el asunto "Tu pedido te está esperando 💪 Termina tu compra". Lo tiene que **activar el dueño**: la activación fue bloqueada por permisos.
  - Las otras automatizaciones (carrito abandonado, exploración de producto) tienen la misma alerta.

**Tema dev (lote 4):**
- Anuncios: "💵 Paga al recibir en toda Colombia" / "🚚 Envío GRATIS desde $250.000 pagando en línea".
- Ficha: "💵 Paga al recibir · 🚚 Envío a toda Colombia en 1 a 3 días hábiles"; fila de confianza de 3 líneas.
- **Aviso de stock bajo real**: "🔥 ¡Últimas N unidades en esta talla!" solo cuando la variante tiene 1–4 unidades con inventario controlado. Se actualiza al cambiar de talla. Verificado en Dark Beast talla L.
- FAQ contra entrega (home y ficha) con el envío + la comisión 5 % y el incentivo de pagar en línea.

**Pendiente del dueño:**
1. **Publicar "Beast CRO – dev"** (Tienda online → Temas → Publicar). Bloqueado por permisos como despliegue a producción. Urgente: la tarifa gratis ≥250k ya está en vivo, pero el tema publicado aún muestra la barra Apex de 300k. Para revertir: publicar de nuevo "Copia actualizada de Fabric 4.1".
2. **Activar** el correo "Recuperar un pedido abandonado" (Messaging → Automatizaciones), y revisar los borradores de las otras automatizaciones.
