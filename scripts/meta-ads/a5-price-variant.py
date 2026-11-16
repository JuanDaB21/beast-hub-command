"""Variante de precio del Anuncio 5: cambia el titular a «DESDE 44.900» y saca 4:5 y 9:16.

Uso: python -I scripts/meta-ads/a5-price-variant.py
No toca el original ni el Anuncio 5. Las coordenadas salen de los glifos rojos de IMG_4576.PNG.
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = r"C:\Users\jefte\OneDrive\Documentos\BEAST CLUB\Meta Ads"
SRC = os.path.join(BASE, "Septiembre 2026", "IMG_4576.PNG")
OUT = os.path.join(BASE, "Noviembre 2026", "listos")
FONT = os.path.join(BASE, "_fonts", "Montserrat-Black.ttf")  # OFL; igual a la tipografía del arte

HEADLINE = "DESDE 44.900"
PATCH = (160, 284, 1000, 394)  # zona del titular completo, con margen para no tomar el rojo al desenfocar
TOP, BOTTOM, CENTER = 301, 376, 576  # alto y centro del titular original
RED = (223, 12, 19)
W, H45, H916 = 1080, 1350, 1920
SCALE = 4


def erase(im):
    """Borra la zona con una superficie suave calculada desde sus cuatro bordes (parche de Coons)."""
    x0, y0, x1, y1 = PATCH
    px, edge = im.load(), im.filter(ImageFilter.GaussianBlur(6)).load()
    for y in range(y0, y1):
        v = (y - y0) / (y1 - y0)
        for x in range(x0, x1):
            u = (x - x0) / (x1 - x0)
            color = []
            for i in range(3):
                horizontal = edge[x0, y][i] * (1 - u) + edge[x1, y][i] * u
                vertical = edge[x, y0][i] * (1 - v) + edge[x, y1][i] * v
                corners = (edge[x0, y0][i] * (1 - u) + edge[x1, y0][i] * u) * (1 - v) + (edge[x0, y1][i] * (1 - u) + edge[x1, y1][i] * u) * v
                color.append(round(horizontal + vertical - corners))
            px[x, y] = tuple(color)


def draw_headline(im):
    """Dibuja el titular a 4x y lo baja de escala para que el alto coincida con el arte."""
    probe = ImageFont.truetype(FONT, 100 * SCALE)
    box = probe.getbbox(HEADLINE)
    size = round(100 * SCALE * (BOTTOM - TOP + 1) * SCALE / (box[3] - box[1]))
    font = ImageFont.truetype(FONT, size)
    box = font.getbbox(HEADLINE)
    mask = Image.new("L", (box[2] - box[0], box[3] - box[1]), 0)
    ImageDraw.Draw(mask).text((-box[0], -box[1]), HEADLINE, font=font, fill=255)
    mask = mask.resize((round(mask.width / SCALE), BOTTOM - TOP + 1), Image.LANCZOS)
    im.paste(Image.new("RGB", mask.size, RED), (CENTER - mask.width // 2, TOP), mask)


def to_45(im):
    """Reescala a 1350 de alto y prolonga el fondo gris con los bordes de la imagen, sin franjas."""
    small = im.resize((round(im.width * H45 / im.height), H45), Image.LANCZOS)
    gutter = (W - small.width) // 2
    canvas = Image.new("RGB", (W, H45))
    canvas.paste(small.crop((0, 0, 4, H45)).resize((gutter + 1, H45)), (0, 0))
    canvas.paste(small.crop((small.width - 4, 0, small.width, H45)).resize((W - gutter - small.width + 1, H45)), (gutter + small.width - 1, 0))
    canvas.paste(small, (gutter, 0))
    return canvas


def to_916(im):
    """Lleva la pieza 4:5 a 9:16 prolongando el fondo arriba y abajo; el degradado suaviza la unión."""
    top = (H916 - im.height) // 2
    canvas = Image.new("RGB", (W, H916))
    strip = lambda box, h: im.crop(box).resize((W, h)).filter(ImageFilter.GaussianBlur(30))
    canvas.paste(strip((0, 0, W, 6), top + 1), (0, 0))
    canvas.paste(strip((0, im.height - 6, W, im.height), H916 - top - im.height + 1), (0, top + im.height - 1))
    canvas.paste(im, (0, top))
    return canvas


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    art = Image.open(SRC).convert("RGB")
    erase(art)
    draw_headline(art)
    feed = to_45(art)
    feed.save(os.path.join(OUT, "A5P2_45.jpg"), quality=93)
    to_916(feed).save(os.path.join(OUT, "A5P2_916.jpg"), quality=93)
    print("A5P2_45.jpg", feed.size, "- A5P2_916.jpg", (W, H916))
