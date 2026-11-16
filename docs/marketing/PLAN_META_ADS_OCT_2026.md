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

- **Revisión 8-nov (7 d, 1→7-nov; `report.cjs last_7d 2026-11-01`):**
  - Gasto 209,8k · CPA pixel 11,7k · frecuencia 2,61. Shopify: 19 pedidos (27 la semana anterior), 10 de Meta por último clic → **CPA real 23,4k** (19,5k a 14 d). Móvil: conversión 1,4 % (igual que antes del 1-nov) y carrito→checkout 57 %.
  - La caída es de pedidos, no de la tasa de la tienda. Dos días explican unos 6 de los 8 perdidos: 1-nov (0 pedidos; carrito desde la home 1,2 %) y 7-nov (Meta pasó el 37 % del gasto a N2, 0 compras). Los miércoles concentran el 24 % de los pedidos desde el 7-sep; causa desconocida. QA móvil completo (producto → cajón → checkout con contra entrega): sin fallas. Tema sin cambios desde el 21-oct.
  - A 24 d (15-oct→7-nov), CPA real: N2 9,3k · Banner 12,9k · N4 14,8k · A5 18,2k · N5 18,9k. A5 dispara la regla de rotar por CTR (1,70 frente a 2,46), pero mantiene 13–14 compras pixel por semana: se busca relevo, no se apaga.
  - **Decisión (aprobada por el dueño):** la campaña principal no se toca (30k/día). Los anuncios nuevos no entran ahí: cuando Meta se fue a lo nuevo, los pedidos cayeron (29-oct y 7-nov). Días con A5 en 50–75 % del gasto: 4,3 pedidos/día; con menos de 50 %: 2,4. No se recorta el presupuesto.
  - **Prueba ABO `BC | Test | Nov26`** (`120254289977390684`), +8k/día (38k en total), hasta la llegada de los anuncios de Black Week, cerca del 20-nov (`black-week-2026/config.json` aún dice 13-nov):

    | Clave | Pieza | Conjunto / anuncio | Landing | Tanda |
    |---|---|---|---|---|
    | T1 | Meme «Papá» (video 7,5 s, `creative/t1.html`) | `120254289977490684` / `120254289978130684` | `/collections/monster-gym-training-shirt-unleash-the-beast` | Todas juntas |
    | T2 | Perchero «DESDE 44.900» (`a5-price-variant.py`) | `120254289978220684` / `120254289978600684` | `/collections/desde-44900` (colección nueva, 12 productos) | Todas juntas |
    | T3 / T3b | Figura gigante (`creative/t3.html`) | `120254290548160684` / `120254290549330684` y `120254290550740684` | `/collections/hombre` | Todas juntas |
    | T4 | Video «DESDE $59.900» (`creative/t4.html`) | `120254290550840684` / `120254290554980684` | `/collections/best-sellers` | Todas juntas |

  - **Actualización 8-nov (aprobada por el dueño):** las 4 piezas se activan juntas a 4k/día cada una (+16k/día, tope de 46k/día en total) y los dos cortes de tanda quedan reemplazados por esta regla. Día 3 (12k gastados): sigue con ≥ 1 compra o ≥ 8 carritos. Día 5 (20k): gana con CPA pixel ≤ 10k y ≥ 2 compras; con 0 compras se pausa. Hasta el 19-nov el dinero de las pausadas pasa a las ganadoras, con tope de 8k/día por pieza. Las ganadoras alimentan la campaña de fin de mes. Si A5 cae por la prueba, se reduce la prueba.
  - **Catálogo bajo el anuncio prendido por decisión del dueño** (`product_extensions` en `OPT_IN`), con `All Products` (`1390143091991205`) y, en T1, `Monster club`. No aplica a carruseles (N2). Comando: `apply.cjs --catalog <claves>`; los creativos previos quedan en `.out/state.json` (`prev_creatives`). N5 y Banner conservaron el post; N3 y N4 quedaron con post nuevo porque Meta no aceptó reusarlo. A5: **pendiente**, se aplica de noche con `apply.cjs --catalog A5` (después de las 22:30, fuera del horario de compra).
  - **Corrección:** la lectura de «CTR −31 % = fatiga» de A5 no es sólida. El A5 original tenía el catálogo prendido y el reemplazo del 15-oct lo apagó; desde entonces su CTR pasó de 2,45 a 1,80, mientras su CPA pixel mejoró de 11,6k a 9,5k. Ese mismo día también cambió el público, así que el efecto no se puede aislar. Históricamente, 14 anuncios con catálogo: CPA pixel 11,95k frente a 12,6k sin él.
  - Creativos: `scripts/meta-ads/creative/render.py` (plantillas HTML + Playwright + ffmpeg). T4 muestra varias prendas de distintos precios: por eso va «desde», no «la más vendida».
  - Riesgos aceptados por el dueño: T1 muestra «BASIC Gymshark Short» en la imagen y T2 lleva logos de terceros y un «desde» menor al precio de las prendas que se ven. Si Meta rechaza, se corrige el arte.
  - Sin cambios en las colecciones existentes (reorden semanal rechazado). Próximas revisiones: 12, 15, 17 y 19-nov.

- **Revisión 13-nov (7 d, 6→12-nov; `report.cjs last_7d 2026-11-08`):**
  - **Cuenta:** gasto 276k · 15 compras pixel · CPA pixel 18,4k · frecuencia 3,04 (3,49 a 14 d).
  - **Shopify:** 17 pedidos, 11 de Meta por último clic → **CPA real de 27,9k con impuestos** (la meta es 20k). La semana del 9-nov va en 14 pedidos, frente a 20 y 24 de las dos anteriores.
  - **El quiebre fue el 8-nov.** En el conjunto principal el CPA pixel pasó de ~11,7k (1→7-nov, ~18 compras) a ~21,7k (8→12-nov, ~6 compras). A5 no tuvo compras el 8, 9 ni 10-nov. Ese día coincidieron dos cambios:
    - la edición del catálogo en N3, N4, N5 y Banner (N3 y N4 quedaron con post nuevo, o sea anuncios nuevos dentro del conjunto);
    - el arranque de la prueba ABO sobre el mismo público.

    **Hipótesis: editar creativos del conjunto principal también reinicia el aprendizaje.** El 11 y el 12-nov se recuperó en parte (9 compras pixel).
  - **Prueba ABO, día 5:**
    - **gana T3b** (figura gigante, espalda): 2 compras, CPA pixel 8,3k, 1 pedido real;
    - T1: 0 compras y 0 checkouts, gancho de 7,9 %;
    - T2 y T4: 1 compra cada uno, con CPA de ~19k;
    - T3 (frente): Meta no le dio gasto (1,6k).
  - **Principal a 14 d:**
    - A5: 13,0k (23 compras);
    - Banner: 8,8k (4 compras, 0 en los últimos 7 d);
    - **N2: 30k con 1 compra** (24k sin compras en 7 d), y se llevaba los picos de gasto en días malos;
    - N3: 9,7k con 0 compras.
  - **Embudo móvil:** carrito→checkout 59,1 % desde el 8-nov (70,4 % antes). Por día es ruidoso: entre 5 y 19 carritos diarios, con 60 % y 68 % el 11 y el 12-nov. Tema MAIN sin cambios desde el 21-oct. QA móvil del 13-nov (producto → cajón → checkout, con contra entrega visible): sin fallas.
  - **Aplicado 13-nov (aprobado por el dueño):**
    - pausados los conjuntos de prueba T1, T2 y T4, y el anuncio T3;
    - el conjunto de T3b (`120254290548160684`) sube a **8k/día**;
    - pausado N2 en el principal.
    - Gasto total ≈ 38k/día (30k principal + 8k T3b). Sin anuncios ni ediciones nuevas en el principal antes del 20-nov.
    - **A5 sin catálogo hasta después de BF** (no se toca).
  - **Cortes en las revisiones del 15, 17 y 19-nov** (`report.cjs last_3d 2026-11-13`):
    - N3 se pausa con 20k sin compras;
    - Banner se pausa con 20k a 7 d sin compras;
    - T3b se pausa con CPA pixel acumulado mayor de 15k;
    - si el principal sigue por encima de 20k de CPA pixel a 3 d el 17-nov, se pausa T3b y se vuelve a 30k.
  - **Para BF (anuncios nuevos hacia el 20-nov; la web no tendrá oferta antes de esa fecha):**
    - T3b es el creativo base, adaptado a packs o «lleva 3», sin descuento porcentual;
    - el conjunto de A5 sigue vivo durante BF (≥ 10k/día);
    - las fechas de `black-week-2026/config.json` (13–20-nov) están pendientes de actualizar.

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
