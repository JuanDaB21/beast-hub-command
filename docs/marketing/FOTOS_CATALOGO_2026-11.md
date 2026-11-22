# Fotos de catálogo — estándar y fase 1 (noviembre 2026)

Objetivo: fichas consistentes que muestren la prenda real (horma, color de base y estampado), para subir la conversión. Fase 1 ejecutada el 2026-11-21 con Nightjar.

## Estándar

- **Portada**: estudio gris (estilo `BC Packshot` + fondo *Soft Grey Studio Sweep*), 4:5, 2k (1856×2304, WebP), en modelo musculoso y del lado del estampado: espalda si el diseño va atrás, frente si va en el pecho.
- **Galería**, en este orden:
  1. portada;
  2. lado contrario;
  3. tres cuartos;
  4. detalle del estampado;
  5. una foto por color extra, enlazada a sus variantes;
  6. fotos antiguas al final (no se borran).
- **Una sola prenda en escena**: sin percheros, ganchos ni prendas flotando. Short negro y tenis blancos por defecto; `outfit` por producto (p. ej. CROPPED TEE con jogger).
- **Rotación de modelos** entre productos vecinos: Daniel, Malik, Diego, Yusuf, Hassan, Theo, Jefte.
- **Referencias** en orden de fidelidad: foto real (`BEAST CLUB/Fotos Reales`) > vector > foto de Shopify. Cada color lleva su propia referencia: el `colorway` de Nightjar solo cambia la tela, no la tinta.
- **Productos que solo reciben fotos de colores extra** (sin sesión principal, p. ej. GS TANK Arena): las fotos nuevas van al final y no cambian la portada.
- **Packs y landing de Black Week**: no se tocan. La landing toma imágenes de los productos pack y de sus propios selectores de imagen, nunca de las prendas sueltas.

## Hormas (`photos-plan.json` → `garments`)

| Clave | Prenda real | Productos |
|---|---|---|
| `oversized200` | Oversized 200 g, hombro caído, manga al codo | GYMSHARK Training, CRACKED, ESSENTIAL, HEAVY DUTY, CHAOS TEE |
| `slim` | Camiseta Slim (Vega Penn), costuras del mismo color | SLIM LEGACY, SPAND |
| `c4tank` | C4 200 g regular con mangas cortadas | GS TANK, RUNTECH |
| `oversizedTank` | Oversized 200 g sin mangas, sisa ancha | BASIC GS TANK, MOTOR |
| `hugeTank` / `hugeTankPlain` | Oversized acid (o 200 g lisa) sin mangas, largo a la cadera, **no recortada** | HUGE TANK |
| `croppedAcid` | Oversized acid 220 g negra jaspeada, ~5 cm bajo la pretina, borde cortado con tijera | CROPPED TEE |

## Fase 1 (2026-11-21)

- **Créditos**: 65 de 104 (quedan 39).
  - Calibración (CP2): 3 productos.
  - Tanda A: reactivados y colores nuevos.
  - Tanda B: más vendidos.
  - Correcciones pedidas por el dueño: logo frontal YL de RUNTECH, horma de HUGE, logo y atuendo de CROPPED.
  - SHADOW TOFFER a partir de foto real.
- **Subidas**: 75 fotos en 15 productos, con 136 variantes enlazadas a la foto de su color. CRACKED pasó a ACTIVE con etiquetas `genero:hombre`, `tipo:camiseta-oversized`, `linea:gymshark`, `estado:oferta`.
- **Tandas C, D y E** (31 créditos; quedan 8 de 104):
  - C, portadas fuera de estándar: TWIN BADASS, TRAINING BEAST, STREET TANK, REVENGE, GALAXY, REGULAR, DARK BEAST, INQUEBRANTABLE.
  - D, galerías con 2 fotos o menos: GREEN BARBELL, ATLAS, BULKING SEASON, LIFTING SHARK.
  - E, shorts: BASIC Gymshark Short, MONSTER SHRT (modelo con camiseta negra lisa).
  - 59 fotos más y 72 variantes enlazadas. **Total: 134 fotos en 29 productos y 208 variantes.**
- **Verificación**: `node scripts/shopify-cro/photos-verify.cjs` → 29/29 OK y 14 packs activos 100 % vendibles.
- **Colecciones**: se reordenaron con `collection-order.cjs --apply` y `collections-sold-out-last.cjs --apply`.

## Curaduría de galerías (2026-11-21, `photos-curate.cjs`)

**Color ganador**
- Se cuentan las unidades de 90 días por color, solo de colores con alguna variante vendible.
- Si el producto vendió menos de 3 unidades en ese periodo, se usan las de 2 años.
- En empate se queda la portada actual. Con `"winner"` en `photos-curation.json` se fuerza el color.
- Un color cuenta las ventas de su coincidencia más larga: «Negro/Letras Blancas» no suma las de «Acid Negro/Letras Blancas».

**Orden de la galería**
1. Color ganador, empezando por la foto del lado del estampado (`print_side`).
2. Resto de colores, por ventas.
3. Fotos sin color, al final.

**Limpieza**
- En los productos con fotos nuevas se quitan **todas** las fotos viejas de colores que ya tienen foto nueva, por decisión del dueño, reales incluidas.
- También se quitan las de colores que no se venden.
- Las demás se conservan.
- Las fotos quitadas se **desvinculan**, no se borran: `fileUpdate referencesToRemove`, así que siguen en Contenido › Archivos. Se revierte con `referencesToAdd` usando `.out/curation-log-*.json`.

**La ficha abre en la primera variante**
- El tema muestra primero la foto de la variante seleccionada, no la portada de la galería.
- Por eso el color ganador va **primero en la opción Color** (`--options --apply`, con `productOptionsReorder`). Solo cambia el orden: los ids de variantes, los SKU y los packs no cambian.

**Resultado**
- 42 productos curados y 120 fotos desvinculadas (las 120 siguen en Archivos).
- 6 portadas cambiaron (TRAINING BEAST, LEGENDARY, BASIC TEE, POWER, RESPECT THE CODES, ACTIVE MONSTER) y 10 productos tuvieron que reordenar la opción Color.
- Las variantes verde y azul de GYMSHARK Training quedaron enlazadas. Antes no lo estaban por la diferencia «Negro / Letras» frente a «Negro/ Letras»; ahora los scripts normalizan los espacios alrededor de la barra.
- Fotos extra con los últimos 7 créditos (quedan 0): sesión de GS TANK negra con letras negras más la de letras rojas, sesión de CBUM, sesión de NECKLACE y TRAINING BEAST con letras negras.
- **Formato**: todas las fotos nuevas están en `image/webp`; `photos-verify.cjs` lo comprueba.

```
node photos-curate.cjs --classify          # arma photos-curation.json (color y vista de cada foto)
node photos-curate.cjs --sheet             # hoja de las fotos viejas sin clasificar (se anotan con manual:true)
node photos-curate.cjs --plan              # dry-run + hojas .out/curation/plan-*.jpg
node photos-curate.cjs --apply             # desvincula, ordena y enlaza colores
node photos-curate.cjs --options [--apply] # color ganador primero en la opción Color
```

## Línea base (landing en la ficha, 30 días a 2026-11-21)

Archivo `scripts/shopify-cro/.out/photos-baseline--30d_today.json`. Agregado de los 29 productos: **585 sesiones, 8,7 % agregan al carrito, 1,5 % compran**. Tandas A y B (15 productos): 399 sesiones, 10,3 % y 1,75 %. Tandas C, D y E (14): 185 sesiones, 5,4 % y 1,1 %. Por producto la muestra es chica: comparar el agregado y los de más tráfico.

| Producto | Sesiones | Agregan al carrito | Compran |
|---|---|---|---|
| GYMSHARK Training | 98 | 14,3 % | 0 % |
| BASIC GS TANK | 80 | 7,5 % | 2,5 % |
| MOTOR Youngla | 61 | 0 % | 0 % |
| CHAOS TANK | 39 | 5,1 % | 0 % |
| HUGE TANK | 39 | 12,8 % | 7,7 % |
| GS TANK | 30 | 16,7 % | 6,7 % |

**Medición**: el 2026-12-05, correr `node scripts/shopify-cro/photos-baseline.cjs 2026-11-22 2026-12-05` y comparar.

## Uso de los scripts (`scripts/shopify-cro/`)

```
node photos-run.cjs --estimate <tanda|handles>     # créditos (no gasta)
node photos-run.cjs --generate <tanda|handles>     # 4 en paralelo; idempotente por toma
node photos-run.cjs --sheet <tanda|handles>        # hoja de contacto para aprobación
node photos-run.cjs --upload <handles> [--apply]   # sube, ordena y enlaza colores
node photos-verify.cjs                             # control posterior a la subida
```

Para regenerar una toma, se borra su entrada en `.out/nightjar/state.json` (`gens["handle|toma"]` y, si cambian las referencias, `products["handle|color"]`). Para excluir una salida: `"reject": [i]` en la toma.

## Pendiente

- **Tanda 2** (requiere recargar créditos de Nightjar):
  - THE MONSTER CLUB (ya en estudio, en 3:4 y con otro modelo);
  - POWER (fotos de mujer: confirmar si es unisex);
  - colores sin foto propia, como BULKING blanca, BASIC short logo negro y TRAINING BEAST letras negras/rojas y blanca;
  - shorts CONDITIONING, FITNESS y STRENGTH;
  - línea Warwolf.
- **MONSTER TANK**: falta confirmar el estampado real (las fotos muestran garra verde neón; en Beast Hub figura «THE MONSTER CLUB»).
- **Tema**: el encabezado transparente tapa la parte de arriba de la portada en móvil, y en CRACKED cubre parte del estampado. Hay que evaluar en staging un encabezado sólido en la ficha y la galería en 4:5 fija. Publicarlo lo hace el dueño.
- **Fotos viejas** que contradicen la prenda real: borrarlas requiere OK. Ejemplos: CROPPED con otro logo, BASIC GS TANK con logo rojo, HUGE recortada.
