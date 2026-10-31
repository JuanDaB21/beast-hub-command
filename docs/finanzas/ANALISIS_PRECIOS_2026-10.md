# Análisis de precios, rentabilidad y pauta — Beast Club (2026-10-21)

**Fuentes:**
- BD de producción (solo lectura): 157 pedidos válidos en 90 días.
- Shopify Admin: catálogo, descuentos y sesiones por landing en 60 días.
- Meta Ads: semanas desde el 10-ago.
- `products.json` público de la competencia.

**Generadores:** `scripts/analytics/pricing-analysis.cjs`, `meta-trend.cjs` y `competitors.cjs`. Los datos crudos quedan en `scripts/analytics/.out/`.

## 1. Veredicto

**No conviene bajar los precios.** Con un margen de contribución del 42 %, un recorte del 10 % exige **+30 % de pedidos** solo para empatar. Los datos no muestran que el precio sea lo que frena la venta:
- Beast Club ya está en la franja media: más barato que Invicto y Wargo en camisetas, y por encima solo de Kaybu, la tienda económica.
- Los productos baratos no convierten mejor que los caros.
- La mitad del catálogo ya se muestra «rebajado» con precio tachado.

Las ventas no crecen porque **el gasto en Meta subió un 49 % y los pedidos no lo siguieron** (§4). El crecimiento tiene que venir de los creativos, la conversión y el stock de los ganadores, no del precio ni de más presupuesto por ahora.

## 2. Cómo va el negocio

| Periodo | Pedidos/sem | Prendas/pedido | Venta producto/sem | Gasto Meta/sem | Contribución − pauta /sem |
|---|---:|---:|---:|---:|---:|
| 17-ago → 30-ago | 10,0 | 1,6 | 1,05 M | 102k | 353k |
| 31-ago → 20-sep | **19,0** | 2,0 | 2,44 M | **120k** | **887k** |
| 21-sep → 18-oct | **15,8** | 2,3 | 2,31 M | **179k** | **803k** |
| 19-oct → 21-oct (3 días) | 8 | 3,4 | 1,81 M | 63k | — |

**Economía de los últimos 90 días:**
- Venta de producto 21,7 M · COGS 11,8 M · comisiones 0,7 M → **contribución 9,1 M (42,2 %)**.
- Por pedido: 138k de venta, **58k de contribución** y 2,11 prendas.
- Por prenda: precio de 65,3k, costo de 35,7k y contribución de 27,5k.

**Base mensual (últimas 4 semanas):**
- 67,5 pedidos, 9,9 M de venta y 4,2 M de contribución.
- 0,77 M de pauta → **3,44 M de contribución neta de pauta**, antes de costos fijos.
- MER de 12,9: Meta es rentable en promedio.

Otros datos:
- Contra entrega: 46,5 % de los pedidos.
- Devoluciones: 6 en total, todas reingresadas. Cancelaciones: 1. El riesgo de contra entrega hoy es casi nulo.
- El flete es pase directo: 1,01 M cobrado frente a 0,91 M de `shipping_cost`.

> Verificación: la contribución de 58k por pedido supera los 50k de la auditoría CRO §4 (+16 %). La diferencia se explica porque ya no se resta el 5 % de contra entrega (lo paga el cliente, auditoría §8) y porque `ironing_cost` pasó de 1.500 a 0. Los pedidos de la BD y de Shopify cuadran por semana con ±3. La diferencia son los pedidos manuales (22 en 120 días).

## 3. ¿Bajar precios? Escenarios

Supuestos: base mensual de 67,5 pedidos, pauta fija de 0,77 M y comisiones del 3,2 %. **Equilibrio:** alza de pedidos = d / (m − d). Por ejemplo, con m = 42,4 % y d = 10 %: 0,10 / 0,324 ≈ **+31 %**; el modelo da +30 % al descontar las comisiones.

| Recorte | Contrib./pedido | Pedidos extra para empatar | Utilidad neta según elasticidad −1 / −1,5 / −2 / −2,5 / −3 |
|---|---:|---:|---|
| −5 % | 55k | +13 % | −9 % / −6 % / −3 % / 0 % / +2 % |
| −10 % | 48k | **+30 %** | −18 % / −14 % / −9 % / −4 % / 0 % |
| −15 % | 41k | +52 % | −30 % / −24 % / −18 % / −12 % / −6 % |

La elasticidad de la ropa en e-commerce suele estar entre −1 y −2,5. Solo con −3 o más el recorte deja de perder plata. Los datos propios no apuntan a una demanda tan sensible:

- **Conversión por banda de precio** (sesiones que aterrizan en una ficha, 60 d):

  | Banda | Sesiones | → compra |
  |---|---:|---:|
  | < 60k | 667 | 1,3 % |
  | 60–70k | 1.705 | 0,6 % |
  | 70–80k | 449 | **2,4 %** |
  | 80k+ | 138 | 0,7 % |

  La banda 70–80k convierte mejor que la de menos de 60k. Lo que manda es el producto y la ficha: CHAOS TANK, a 74,9k, convierte un 2,8 %, y CHAOS TEE, a 69,9k, un 0,4 % con 757 sesiones.
- **Experimentos naturales:** pocos y chicos. CHAOS TANK vendió 14 u a 74,9k y 7 a 69,9k; GMTHARK CBUM, 10 a 64,9k y 3 a 59,9k. Las ventas no se concentran en el precio bajo.
- **Descuentos:** solo el 8,4 % de los pedidos usó descuento (11 automáticos en 60 d).
- **Precio tachado:** el 55 % de las camisetas y el 47 % de los tanks con stock ya muestran `compare_at`. Bajar más erosiona una percepción de rebaja que ya existe.

**Alternativas evaluadas con la misma contabilidad:**
- **Bundles 2×/3×:** el 54 % de los pedidos ya trae 2 o más prendas. El descuento se regala en esos pedidos y no se recupera con el upsell. Ejemplo: 9,9k menos en la 2.ª prenda exige convertir a 2 prendas al ~66 % de los pedidos de 1 prenda. Sirve solo si sube la tasa de compra (pedidos nuevos), y eso se mide con una prueba, no se supone.
- **Envío gratis desde 200k:** ya calculado en la auditoría CRO §4. Hoy rige ≥250k pagando en línea; mantenerlo.
- **Subir +5k por prenda (+7,7 %):** la contribución por prenda pasa de 27,5k a 32,3k, y tolera perder hasta un 15 % del volumen. Con elasticidad −1 a −1,5 la contribución sube entre un 4 % y un 9 %. Es la única palanca de precio con resultado esperado positivo, pero solo como **prueba** en productos que no son el gancho de la pauta (ver §6).

### Precio frente a la competencia (con stock)

Medianas de los productos con stock (n = productos):

| Tipo | Beast Club | Invicto (invictowear.com) | Wargo (wargosports.com) | Kaybu (kaybu.co) |
|---|---|---|---|---|
| Camiseta | **64,9k** (n 38) | 90k (n 161) | 75k (n 8) | 50k (n 10) |
| Tank | **69,9k** (n 15) | 65k (n 76) | 70k (n 9) | 42k (n 49) |
| Short | **69,9k** (n 7) | 60k (n 39) | 85k (n 4) | 50k (n 22) |
| Compresión | **79,9k** (n 3) | 85k (n 6) | 80k (n 3) | 65k (n 7) |
| Jogger | 79,9k (n 1) | 95k (n 167) | 190k (n 4) | 69k (n 26) |

**Lectura:**
- Beast Club está en la **franja media**.
  - Camisetas (la categoría que más vende): 17 % por debajo de Wargo y 28 % por debajo de Invicto.
  - Tanks y compresión: en línea con Invicto y Wargo.
- Kaybu, una tienda de Cúcuta, es la franja económica: un 25–40 % más barata en todo.
- Igualar a Kaybu costaría la mitad de la contribución por prenda. Con un margen del 42 % esa carrera no se gana, y la conversión no muestra que el precio sea el freno (ver arriba).
- Invicto ofrece 10 % en la primera compra.
- Dewell no se ubicó; se agrega con `node scripts/analytics/competitors.cjs beastclub.store invictowear.com wargosports.com kaybu.co <dominio>`.
- Límite: la clasificación por tipo se hace por palabras clave del título. Wargo tiene 135 productos sin clasificar (accesorios, ropa de mujer).

### Economía por producto (top 12 por contribución, 90 d)

| Producto | u | Precio | Costo u | Margen | Pedidos extra p/ empatar −10 % | Landing → compra |
|---|---:|---:|---:|---:|---:|---:|
| GYMSHARK Training Shirt | 63 | 59,9k | 29,4k | 47,5 % | +27 % | 479 → 1,0 % |
| CHAOS TANK | 21 | 74,9k | 46,6k | 33,0 % | +44 % | 106 → 2,8 % |
| CHAOS TEE | 18 | 69,9k | 41,1k | 38,1 % | +36 % | 757 → **0,4 %** |
| GS TANK | 16 | 59,9k | 32,5k | 41,7 % | +32 % | 29 → 6,9 % |
| GMTHARK CBUM | 13 | 64,9k | 33,5k | 45,7 % | +28 % | 22 → 0 % |
| Motor YoungLA Tank | 14 | 74,9k | 45,3k | 35,8 % | +39 % | 181 → 1,7 % |
| GYMSHARK NECKLACE | 10 | 64,9k | 29,4k | 50,5 % | +25 % | 57 → 5,3 % |
| CROPPED TEE | 12 | 64,9k | 36,0k | 41,8 % | +32 % | 25 → 0 % |
| BASIC GS TANK | 10 | 49,9k | 25,4k | 45,6 % | +28 % | 13 → 0 % |
| SHADOW TOFFER | 9 | 62,9k | 36,3k | 39,6 % | +34 % | 39 → 0 % |
| GYMSHARK ICON Compress | 6 | 79,9k | 46,5k | 41,3 % | +32 % | 42 → 2,4 % |
| HEAVY DUTY | 10 | 64,9k | 45,6k | **25,5 %** | +65 % | 16 → 0 % |

Los márgenes más bajos (HEAVY DUTY 25 %, REVENGE TEE 29 %, CHAOS TANK 33 %) son los peores candidatos para descuento.

## 4. Meta Ads: resultados y diagnóstico

**Últimos 7 días (14→20-oct):**
- Gasto de 203,7k, 15 compras de pixel, **CPA pixel de 13,6k** (línea base del 15-oct: 16,3k) y frecuencia de 2,83.
- Shopify: 17 pedidos, **8 de Meta por último clic → CPA real ≈ 25,5k** (objetivo ≤ 30k ✅).

**Embudo móvil antes → después del 15-oct:**
- Conversión: 1,0 % → **1,2 %** (línea base 0,6 %).
- Carrito→checkout: 69,2 % → **78,5 %** (línea base 52,4 %).

El arreglo del cajón funcionó.

**El problema de fondo (ventas planas):** de 120k/sem (31-ago→20-sep) a 179k/sem (21-sep→18-oct), el gasto subió +59k/sem y los pedidos **bajaron** de 19,0 a 15,8 por semana. El tramo adicional de pauta no trajo ventas: Meta es rentable en promedio, pero el **último peso no**. Hay factores mezclados:
- El tropiezo del tema el 12-oct.
- Los agotados (40 de 99 activos sin tallas en la auditoría).
- Pocos creativos ganadores. Anuncio 5 se lleva el 48 % del gasto con un CPA real cercano a 32k.

| Anuncio | Gasto 7 d | Compras px | CPA px | Pedidos Shopify (último clic) | Señal | Propuesta |
|---|---:|---:|---:|---:|---|---|
| Anuncio 5 — 59k V2 | 96,9k | 7 | 13,8k | 3 | Concentra el gasto; CPA real ~32k | Mantener; no escalar |
| N6 — Compresión gancho | 30,8k | 2 | 15,4k | **0** | ≥ 30k sin pedidos reales | **Pausar** |
| N4 — Nuevas oversized | 12,5k | 2 | 6,3k | 1 | Bueno | Mantener |
| Banner Best seller | 10,8k | 0 | — | 0 | Por debajo del umbral de 30k | Observar |
| N2 — Oversized gótica | 9,2k | 2 | **4,6k** | 2 | El mejor | Mantener y base de nuevos creativos |
| N3 — Receta prohibida | 8,2k | 1 | 8,2k | 0 | Aceptable | Mantener |
| Anuncio 7 — video | 7,2k | 0 | — | 0 | Hook 17,5 % < 20 % | **Pausar / rotar** |
| N5 — Reel chica UGC | 6,0k | 1 | 6,0k | 1 | Hook **41 %** | Mantener y base de nuevos creativos |
| N1 — Tank Motor | 5,7k | 0 | — | 0 | 0 ATC con 11 LPV | Observar hasta 15k; pausar si sigue en 0 |

C5 y C6 están pausados desde el 15-oct; su gasto de 7 d es previo al corte.

**Escenarios de presupuesto** (solo modelados; contribución de 62k por pedido):

| Presupuesto | CPA marginal real 30k | 45k | 60k |
|---|---:|---:|---:|
| 45k/día (+450k/mes) | +15 pedidos → **+485k/mes** | +10 → +173k | +7,5 → +18k |
| 60k/día (+900k/mes) | +30 → **+970k/mes** | +20 → +347k | +15 → +35k |

La evidencia reciente (más gasto y menos pedidos) indica un CPA marginal **por encima de 60k**. **No subir el presupuesto ahora.** La condición para subir es que, con creativos nuevos, el CPA real por último clic se mantenga ≤ 30k durante 14 días (regla de `meta-review`). Entonces se prueba 45k/día durante 2 semanas.

## 5. Plan de crecimiento (priorizado)

| # | Palanca | Acción | Efecto esperado | Métrica / revisión |
|---|---|---|---|---|
| 1 | Pauta | Pausar N6 y Anuncio 7. Lanzar 2–3 creativos nuevos en la línea de N2 (carrusel gótico) y N5 (UGC/reel) el 29-oct | Bajar el CPA real a ≤ 25k | CPA último clic semanal (`meta-trend.cjs`) |
| 2 | Conversión de fichas con tráfico | CHAOS TEE (757 sesiones, 0,4 %): revisar tallas agotadas, fotos y precio tachado; no mandarle pauta | ~380 sesiones/mes: del 0,4 % al 1 % son +2–3 pedidos/mes; más si se aplica a otras fichas con tráfico | Landing → compra (`pricing-analysis.cjs`) |
| 3 | Stock de ganadores | Asegurar todas las tallas de GYMSHARK Training Shirt (19 % de las prendas), CHAOS TANK, GS TANK y NECKLACE | Evita perder la venta que ya está pagada en pauta | Agotados por talla cada semana |
| 4 | Ticket | Mantener el envío gratis ≥ 250k en línea; empujar el «completa tu look» (tank + camiseta) en el carrito | Prendas/pedido de 2,1 → 2,3 = +5,5k por pedido (+9 % de contribución) | Prendas/pedido |
| 5 | Precio (prueba) | +5k en 4–6 camisetas que no son el gancho de la pauta y tienen margen < 40 % (p. ej. HEAVY DUTY, REVENGE TEE, CHAOS TEE), durante 30 días | +4–9 % de contribución en esos productos | Unidades/semana frente a las 4 semanas previas; revertir si caen > 15 % |
| 6 | Presupuesto | Subir a 45k/día solo si se cumple la condición de la §4 | +173k a +485k/mes | CPA real 14 d |

**Diseño de la prueba de precio (palanca 5):**
- Basic no permite A/B, así que la prueba es por periodo con un grupo de control: el resto del catálogo, sin cambios.
- Se cambian solo los productos elegidos; se guarda un snapshot y el diff (patrón `catalog-update.cjs`).
- Duración: 30 días.
- Éxito: contribución del grupo ≥ la base con unidades ≥ −15 %. Si no se cumple, se vuelve al precio anterior.
- Requiere aprobación del dueño. **Ningún precio se ha cambiado.**

## 6. Límites del análisis
- Hay 157 pedidos en 90 días: la elasticidad no se puede estimar con precisión. Se usan rangos de referencia y señales cualitativas.
- El costo unitario usa la fórmula de `ProductProfitPanel`: BOM + impresión a 45.000/m + procesos, con planchado en 0 según `global_configs`. No se comparó contra la UI.
- La atribución por último clic de Shopify subestima a Meta y el pixel la sobreestima (≈2:1, según el plan de Meta).
- Competencia: Invicto, Wargo y Kaybu (la «Kabut» que dio el dueño es kaybu.co). Falta Dewell.
