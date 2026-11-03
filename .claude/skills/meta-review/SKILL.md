---
name: meta-review
description: Revisión periódica (72 h / semanal) de la pauta de Meta de Beast Club. Cruza Meta con Shopify, aplica las reglas de decisión y propone cambios (no los aplica sin OK del dueño).
---

# Revisión de Meta Ads — Beast Club

Contexto fijo: `docs/marketing/PLAN_META_ADS_OCT_2026.md` (decisiones, CPA objetivo, línea base). Memorias relacionadas: `meta-ads-account`, `shopify-store-cro`, `ask-dont-assume`.

## Pasos
1. Corre el reporte (solo lectura, salida compacta):
   `node scripts/meta-ads/report.cjs last_7d <fecha_corte_del_último_cambio>`
   Si Meta responde «User request limit reached», espera unos minutos y vuelve a intentar. No reintentes en bucle.
2. Aplica las reglas a cada anuncio con al menos 1.000 COP de gasto (metas del 30-oct, vigentes hasta aplicar la nómina mixta y el −5 % en el costo de las prendas; después vuelve el límite de 30k real):
   - **CPA real** = gasto de Meta × 1,114 (impuestos) / pedidos de Meta por último clic en Shopify. Objetivo: **≤ 20k**. CPA pixel objetivo: **10k** (pixel ≈ 1,7× último clic).
   - **Pausar:** 20k gastados (2× el CPA pixel objetivo) con 0 compras, o CPA a 7 d mayor que 1,5× el de la cuenta.
   - **Rotar el creativo:** frecuencia a 7 d mayor que 3, CTR −30 % frente a su primera semana o hook (video) menor de 20 %.
   - **Escalar (solo proponer):** CPA real con impuestos ≤ 20k durante 14 d, en escalones de +20 %. Si a 7 d supera 20k, se vuelve al presupuesto anterior. Subir el presupuesto requiere aprobación.
   - **Destino:** ningún anuncio nuevo a la home ni a `/collections/compresion` (A5 es la excepción histórica).
   - **Estructura:** no se agregan anuncios al conjunto principal (cada tanda reinicia el aprendizaje y Meta deja sin gasto a lo nuevo frente al ganador). Las piezas nuevas se prueban en una campaña ABO aparte con presupuesto propio (2–3 piezas, unos 4k/día cada una, 5 días). Se gradúa la que logre CPA pixel ≤ 10k con al menos 2 compras.
   - Revisa el gasto diario por anuncio (`time_ranges` por día) si un anuncio nuevo le quita gasto al ganador: el 29-oct U2 se llevó el 91 % y las compras cayeron de 10 a 2.
3. Revisa el embudo móvil: si carrito→checkout baja de 60 %, revisa el cajón y los mensajes de envío del tema.
4. **Propón** los cambios en una tabla (anuncio · evidencia · acción) y pide confirmación con AskUserQuestion.
5. Al aprobarse, edita `scripts/meta-ads/plan.json` y corre `apply.cjs` (dry-run → `--create` → `--previews <claves>` → `--status ACTIVE <claves>`). Todo lo nuevo se crea en PAUSA. No uses `--activate`: reactivaría anuncios pausados.
6. **Landings**: actualiza los `pin` de `scripts/shopify-cro/collection-order.json` si cambió el producto o la colección de un anuncio. Corre `node scripts/shopify-cro/collection-order.cjs` (dry-run) y, con OK, `--apply`. Va semanal, porque cambian el stock y las ventas.
7. Actualiza la sección 5 de `docs/marketing/PLAN_META_ADS_OCT_2026.md` con la fecha y las cifras.

## Reglas de contenido
- Los textos nunca nombran marcas de terceros.
- La primera línea lleva el precio y «Pagas al recibir» (en video: en los primeros 2 s). Este público compra por oferta clara, no por contenido de estilo de vida.
- Catálogo bajo el anuncio (`product_extensions`): solo con un conjunto de productos de línea propia; los títulos del catálogo llevan marcas de terceros.
- Black Friday: nada de descuento porcentual general (un 15 % se come la utilidad por pedido); mejor regalo o «lleva 3».
- Cada pieza en 4:5 (feed) y 9:16 (Stories y Reels): `python -I scripts/meta-ads/prep-creatives.py`.
- No inventar datos (stock, materiales, tiempos): preguntar.
