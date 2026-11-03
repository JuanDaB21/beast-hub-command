# Meta Ads + front Shopify — oct-2026 (aplicado 15-oct)

Presupuesto fijo: 30.000 COP/día (campaña `BC | Ventas | Evergreen`, CBO). Subirlo requiere aprobación del dueño.

## 1. Diagnóstico (datos del 15-oct)

| Señal | Antes | Ahora |
|---|---|---|
| Móvil carrito→checkout (Shopify) | 69,8 % (28-sep→11-oct) | **52,4 %** (12→15-oct) |
| Móvil conversión | 1,2 % | **0,6 %** |
| CPA pixel | 11,7k (30 d) | **16,3k** (7 d) |
| Frecuencia 30 d | 4,3 (alcance ~31k) | — |

Causas, por impacto:
1. **El cajón del carrito** (tema CRO, 12-oct) mostraba «Envío $19.000 · GRATIS desde $250.000 pagando en línea». Para quien paga contra entrega (47–53 % de los pedidos) era un recordatorio de costo antes de decidir.
2. **Un tercio del gasto iba a `/collections/compresion`**, que convierte 0,47 %. Los anuncios que llevan a una PDP o a best-sellers logran 18–35 % de carrito por visita, frente a 5–11 % de la colección.
3. **Fatiga y poca diversidad:** solo había 3 conceptos activos. El hook de los videos estaba en 16 % (referencia: 25–30 %).
4. **Atribución:** Meta reclama unas 2 compras por cada pedido que Shopify le asigna por último clic. Las decisiones se toman con Shopify y UTM.

Margen (BD de producción, 60 d, 133 pedidos): venta de producto de 133k por pedido, costo de 73k y 2,04 prendas → **unos 58k de contribución por pedido** antes de pauta.

**CPA objetivo (aprobado):** 15k pixel / **30k real por último clic**. El punto de equilibrio está en unos 58k.

## 2. Decisiones por anuncio

| Anuncio | Decisión | Motivo |
|---|---|---|
| Anuncio 5 — 59k V2 | Continúa (+UTM) | 26 compras, CPA 10,8k; vigilar la fatiga (ATC/LPV 18 → 14,5 %) |
| Anuncio 7 — video | Continúa (+UTM) | CPA 9,1k, compras por visita 2,6 % |
| Banner Best seller | Continúa (+UTM) | Compras por visita 3,3 % y ticket de 144–254k |
| C5, C6 (conjunto COMPRESIÓN) | **Pausados** | Landing de colección: C6 con CPA de 17,8k y ATC/LPV de 5 % |
| R2 — Reel oversized | **Pausado** | Hold de 6 % |
| N1 Tank Motor (3.png) | Nuevo | PDP Motor, la mejor landing (2,6 %) |
| N2 Oversized gótica (5.1–5.3, carrusel) | Nuevo | PDP Necklace |
| N3 Receta prohibida (16) | Nuevo | PDP Monster Recipe |
| N4 Nuevas oversized (17, dominio corregido) | Nuevo | `nove-coleccion` |
| N5 Reel chica (UGC) | Nuevo | PDP Revenge Tee, sin sugerencia de género |
| N6 Compresión gancho (14+15, carrusel) | Nuevo | `nove-coleccion`; ICON tiene poco stock: en las tallas agotadas aparece el botón de WhatsApp |
| 19 (composición sobre superficie) | En reserva | Para la próxima rotación |

**Conjunto `Evergreen | Broad | Purchase | Oct26-v2`** (id `120252635698640684`):
- Advantage+ audience, Colombia.
- Sugerencia de edad 18–44, de cualquier género.
- Facebook: feed, perfil, Stories, Reels e in-stream. Instagram: feed, perfil, Stories, Reels, inicio de Explorar y búsqueda.
- Quedan **fuera** el estado de WhatsApp, el overlay de Reels, la búsqueda de FB y Marketplace.
- IDs de los anuncios nuevos: `scripts/meta-ads/.out/state.json`.

Todos los anuncios llevan `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`. En los anuncios nuevos quedaron apagadas las mejoras automáticas que alteran el diseño: plantillas, animación, optimización de texto y extensiones de producto.

## 3. Formatos
- Cada pieza tiene versión **4:5 para el feed** y **9:16 para Stories y Reels**, con reglas de personalización por ubicación (`asset_customization_rules`).
- Generador: `scripts/meta-ads/prep-creatives.py`; salida en `Meta Ads/Octubre 2026/listos/`.
- Los archivos `5.1`, `5.2` y `5.3` no abrían porque eran **PNG sin extensión**.
- La pieza 17 decía `WWW.BEASTCLUB.COM`: se corrigió a `BEASTCLUB.STORE`.

## 4. Tienda (tema «Beast CRO – staging», id `188662448218`; lo publica el dueño)
- **Agotados → «Pregunta disponibilidad por WhatsApp»** (wa.me/573152882906, con producto, talla y link), en la PDP y en la barra fija.
  - Se probó en ICON: S agotada muestra el botón; M y XL muestran «Agregar al carrito».
  - Solo aplica a productos con inventario rastreado.
- **Aviso de stock bajo:** ya no queda pegado a la talla anterior y dice «¡Última unidad!» en singular.
- **Mensaje de envío:**
  - Cajón: «💵 Pagas al recibir · 🚚 Envío a toda Colombia $19.000 · GRATIS por compras superiores a $250.000».
  - Barra superior, ficha y barra de progreso: sin «pagando en línea».
  - La condición de pago en línea queda en las FAQ y en los términos (decisión del dueño, 15-oct).
- **Tarifa del checkout** renombrada a «Envío GRATIS por compras superiores a $250.000». Sigue con el monto de 250k y en plan Basic no se puede ocultar a quien paga contra entrega.
  - ⚠️ Riesgo operativo: un cliente de contra entrega con 250k o más puede elegir esa tarifa y esperar el envío gratis en la puerta.
- **Móvil:** la PDP carga unas 373 peticiones y 118 scripts (casi todo módulos del tema). Apps de terceros: Trustoo (10 peticiones, ~95 KB), vstar (8) y el botón de WhatsApp (1).
  - La medición con PageSpeed quedó pendiente: la API agotó su cuota diaria.
  - Trustoo muestra «0 Reseñas» con estrellas vacías en los productos sin reseñas (señal negativa) → propuesta: ocultar el widget cuando no hay reseñas.

## 5. Medición y reglas (skill `meta-review`)
- `node scripts/meta-ads/report.cjs last_7d 2026-10-15`: tabla por anuncio y embudo móvil de Shopify antes y después de la fecha de corte.
- **Reglas (actualizadas el 30-oct; detalle en la skill):**
  - CPA real = gasto de Meta × 1,114 (impuestos) / pedidos de Meta por último clic. Meta **≤ 20k** real y **10k** pixel. Vigente hasta aplicar la nómina mixta y el −5 % en el costo de las prendas: hoy cada pedido deja 37k antes de pauta (`SALUD_FINANCIERA_2026-10.pdf`, acción 6).
  - pausar con 20k gastados y 0 compras, o con CPA a 7 d mayor que 1,5× el de la cuenta;
  - rotar con frecuencia a 7 d mayor que 3, CTR −30 % o hook menor de 20 %;
  - meter 2–3 conceptos nuevos cada 2 semanas, **en una campaña ABO de prueba aparte**, nunca en el conjunto principal;
  - proponer escalar solo con el CPA real con impuestos ≤ 20k durante 14 d, en escalones de +20 %.
- **Línea base para comparar a 7 y 14 d:** carrito→checkout móvil 52,4 %, conversión 0,6 %, CPA pixel 7 d 16,3k, 14 pedidos en 7 d (8 de Meta por último clic).
- **Revisión 21-oct (7 d, 14→20-oct):**
  - Gasto 203,7k · CPA pixel 13,6k · frecuencia 2,83.
  - Shopify: 17 pedidos, 8 de Meta por último clic → CPA real ≈ 25,5k.
  - Móvil: carrito→checkout 78,5 % y conversión 1,2 %. Se recuperó.
  - Propuesta: pausar N6 (30,8k, 0 pedidos reales) y Anuncio 7 (hook 17,5 %); observar N1 y Banner; nuevos creativos el 29-oct sobre N2/N5.
  - No subir el presupuesto: de 120k a 179k/sem los pedidos bajaron de 19,0 a 15,8 por semana.
  - Detalle: `docs/finanzas/ANALISIS_PRECIOS_2026-10.md` §4. Tendencia semanal: `node scripts/analytics/meta-trend.cjs`.
  - **Aplicado 21-oct (aprobado por el dueño):** pausados N6 — Compresión gancho (`120253895511210684`) y Anuncio 7 -video (`120253266015710684`). Presupuesto sin cambios (30k/día). Próxima revisión: 29-oct.
- **Revisión 26-oct (7 d, 19→25-oct)** — informe completo en `docs/marketing/INFORME_2026-10-26.md`:
  - Gasto 214,6k · CPA pixel 9,3k · frecuencia 2,66. Shopify: 27 pedidos, 15 de Meta por último clic → **CPA real 14,3k**. Es la mejor semana registrada (ticket 176,5k, 2,70 prendas por pedido).
  - CPA real a 14 d ≈ 17,4k: cumple la regla para proponer escalar. El dueño decide en la revisión del 29–30-oct (propuesta: 36k/día).
  - Anuncio 5 lleva a la home `/` y aporta 11 de los 15 pedidos reales. La regla «nada a la home» aplica a los anuncios nuevos.
  - **UGC de noviembre creado en PAUSA** (los 4 por decisión del dueño, audio propio):

    | Clave | Video | Landing | Anuncio |
    |---|---|---|---|
    | U1 | `1023.mp4` (semana de tanks) | `/collections/tanks` | `120254067173250684` |
    | U2 | `1023 (2).mp4` (la más vendida, $59.900) | `/collections/best-sellers`: la camiseta es la #1 ahí; en `nove-coleccion` está en la posición 53 | `120254067193370684` |
    | U3 | `1023 (1).mp4` (outfits en la caminadora) | `/collections/hombre` (4,5 % de conversión móvil, muestra chica) | `120254067205650684` |
    | U4 | `1017.mov` (unboxing con lata) | `/collections/monster-gym-training-shirt-unleash-the-beast` | `120254067215900684` |

  - Riesgos declarados: U4 muestra la lata y el logo de una bebida de un tercero (riesgo alto de rechazo); U2 muestra un logo de un tercero grande; U3 tiene un gancho débil (plano abierto, sin texto).
  - **Aplicado 26-oct (aprobado por el dueño tras revisar los previews):**
    - `--status ACTIVE U1,U2,U3,U4`: quedaron en revisión de Meta (`IN_PROCESS`);
    - `--status PAUSED N1` (Tank Motor, 0 carritos; U1 lo reemplaza).
    - Presupuesto sin cambios (30k/día).
    - Próxima revisión: 29–30-oct, con `report.cjs last_3d 2026-10-26`. Se mide el hook ≥ 20 % y el CPA pixel ≤ 15k, y se decide si subir a 36k/día.
  - **Orden de las landings** (`scripts/shopify-cro/collection-order.cjs`): % de las ventas de 60 d que queda en los primeros 12 productos, hoy → propuesto:

    | Colección | Hoy | Propuesto |
    |---|---|---|
    | `hombre` | 13 % | 51 % |
    | `nove-coleccion` | 14 % | 49 % |
    | `best-sellers` | 50 % | 54 % |
    | `tanks` | 84 % | 80 % (con pins del video) |

    - En `hombre` la más vendida estaba en el #51; en `nove-coleccion`, en el #54.
    - Línea base por landing (móvil, 60 d, ATC / compra): `nove-coleccion` 5,9 / 1,96 · `best-sellers` 10,1 / 2,10 · `hombre` 9,1 / 4,55 · `tanks/Hombre` 13,0 / 2,17.
    - **Aplicado 26-oct** (`--apply`, aprobado por el dueño):
      - el storefront muestra los pins en orden en las 5 colecciones y los agotados al final;
      - Monster club pasó de `MOST_RELEVANT` a `MANUAL`;
      - el orden previo quedó en `scripts/shopify-cro/.out/collection-order-2026-10-26.json`;
      - comparar la conversión por landing el 2-nov (7 d) y el 9-nov (14 d).
  - `apply.cjs` ahora admite un video por anuncio (`ad.video` → `state.videos`) y `--status`/`--previews <claves>`, que tocan solo esas claves. **No usar `--activate`**: reactivaría N6 y A7.
- **Revisión 30-oct (7 d, 23→29-oct; `report.cjs last_7d 2026-10-26`):**
  - Gasto 211,5k · CPA pixel 8,8k · frecuencia 2,57. Shopify: 27 pedidos, 14 de Meta por último clic → **CPA real de 16,8k con impuestos** (19,4k a 14 d). Semana en curso (lun→jue): 17 pedidos, CPA real de 12,0k. Móvil: conversión del 1,6 % y carrito→checkout del 72 %.
  - **Concentración en A5:** no perjudica. Los días con A5 en 62–86 % del gasto dieron 3–10 compras. El 29-oct Meta pasó el 91 % a U2 (29,6k) y, con el mismo gasto, salieron 2 compras.
  - **Videos UGC:** Meta los probó (U4 gastó 8,4k el día 1) y los cortó por CTR y carritos flojos. U1, U3 y U4 tenían ganchos de solo 20–24 %. U2 (gancho de 35 %, CTR de 2,5–2,9 %) recibió 43k, pero solo compró el 0,7 % de las visitas, frente al 4,9 % del Banner con la misma landing. Con 10 anuncios en un conjunto CBO de 30k, A5 deja unos 1–2k por anuncio y día a los nuevos: la prueba no fue justa, pero U2 sí recibió gasto y no convirtió.
  - Ningún anuncio, tampoco A5, tiene las miniaturas de catálogo (`product_extensions` en OPT_OUT). Catálogos de Shopify conectados: `655653327262814` (776 productos) y `1414245349933739` (1.288). La API no devuelve `learning_stage_info`: verificar el aprendizaje en el Administrador (columna «Entrega»).
  - **Aplicado 30-oct (aprobado por el dueño):** `--status PAUSED U1,U2,U3,U4`. Quedan activos A5, Banner, N2, N5, N3 y N4. Presupuesto sin cambios (30k/día).
  - Próxima revisión: 2–3-nov, con `report.cjs last_7d 2026-10-30`. Éxito: CPA pixel ≤ 10k y CPA real con impuestos ≤ 20k. Ese día también se compara la conversión por landing y se corre `collection-order.cjs` en dry-run con los productos de BF.

## 5.1 Incidente 15-oct: 3 anuncios sin entregar
| Anuncio | Problema | Corrección (`apply.cjs --replace N2,N5,A5`) |
|---|---|---|
| N2 — Oversized gótica `120253895493560684` | Rechazado por "Spam": el copy y la tarjeta 5.1 decían «Nuevo lanzamiento» sobre una prenda con logo de un tercero; el link iba a la ficha del producto, que lleva la marca | Copy sin «Nuevo lanzamiento», se retira la tarjeta 5.1, link a `/collections/nove-coleccion`. Creativo `2638137073255879` |
| N5 — Reel chica `120253895510060684` | Rechazado por "Spam": «te la vas a robar» + marca de un tercero | Copy sin «robar», link a la colección. Creativo `2062940857733895`. El texto quemado en el video («robarle…») sigue ahí |
| Anuncio 5 — 59k V2 `120253265578950684` | Error 2490134: el post `…122200595300769977` quedó oculto | Se clonó el creativo original `1090220080009075` → post nuevo. Creativo `1818459215823535` |

Si N2 o N5 vuelven a salir rechazados, el dueño apela (Administrador de anuncios → Solicitar revisión). Si la apelación falla, se reemplazan por creativos de marca propia (`19_45.jpg`, `Reel 1/2.mov`) y no se insiste más.

## 6. Pendientes del dueño
1. Publicar el tema «Beast CRO – staging» (Tienda online → Temas).
2. Confirmar que la política de envío y los términos digan que el envío gratis aplica solo a pagos en línea.
3. Decidir sobre las apps: ocultar las reseñas en 0 (Trustoo) y aclarar para qué se usa vstar.
4. Material para la próxima rotación: una versión nueva del ángulo «$59.900» y más UGC con personas reales. Al 30-oct, A5 no muestra fatiga (CTR estable, frecuencia de 2,0); lo que preocupa es depender de un solo anuncio.

## 7. Brief Black Friday (semana del 2-nov)
- **Estructura:** campaña ABO aparte «BC | Test | BF», con 2–3 piezas a unos 4k/día cada una durante 5 días (8–12k/día). El conjunto de A5 sigue en 30k. `apply.cjs` hoy solo crea anuncios en `plan.adset.id`: hay que extenderlo para crear la campaña y el conjunto. Se gradúa al conjunto principal la pieza con CPA pixel ≤ 10k y al menos 2 compras.
- **Piezas:**
  1. Meme «Papá: te mandé 140k para el recibo de la luz» → carrito (`Noviembre 2026/Beast Club Posts.png` + `(1).png`). Rehacer el carrito con prendas de línea propia (hoy muestra «BASIC Gymshark Short» y «ACTIVE MONSTER») y cerrar con la mecánica de BF.
  2. Copia de A5 con la misma imagen y el texto «Oversized desde $54.900 · Tanks desde $44.900 · Pagas al recibir 💵», hacia una colección con esos productos fijados (RUN BEAST Tank 44.900, BLOCK 49.900, TRAINING BEAST 54.900). No se edita A5.
  3. Opcional: figura gigante (`3 (1).png`, `4.png`; no se ven marcas en la prenda), con el catálogo activo solo para un conjunto de productos de línea propia.
- **Fuera de pauta:**
  - con Gymshark visible: `1.png`, `2.png`;
  - con latas y logo de Monster o con Nike: `2 (1).png`, `4 (1).png`, `Beast Club Posts - 1.png`.

  Riesgo alto de rechazo; quedan para orgánico.
- **Oferta:** nada de descuento porcentual general (un 15 % quita ~24k de los 25,7k que deja cada pedido). Regalo o «lleva 3», apoyados en el envío gratis desde 250k.
- **Presupuesto:** total de 38–42k/día solo durante la prueba, si la revisión del 2–3-nov da un CPA real con impuestos ≤ 20k. Si a 7 d lo supera, se vuelve a 30k.
