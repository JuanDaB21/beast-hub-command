"""Prepara creativos para Meta: versión 4:5 (feed) y 9:16 (Stories/Reels) de cada pieza.

Uso: python -I scripts/meta-ads/prep-creatives.py
Lee de SRC y escribe en OUT (no toca los originales). La receta de cada pieza vive en RECIPES.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = r"C:\Users\jefte\OneDrive\Documentos\BEAST CLUB\Meta Ads"
SRC = os.path.join(BASE, "Octubre 2025 Q2")
OUT = os.path.join(BASE, "Octubre 2026", "listos")
W, H45, H916 = 1080, 1350, 1920
FONT = r"C:\Windows\Fonts\arial.ttf"


def load(name):
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    if im.width != W:  # p. ej. 19.png viene a 941 px
        im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    return im


def bg_color(im):
    return im.getpixel((10, 10))


def fit_on_canvas(im, h, color):
    """Reescala `im` para que quepa en W×h y la centra sobre un lienzo liso (fondos uniformes)."""
    s = min(W / im.width, h / im.height)
    small = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, h), color)
    canvas.paste(small, ((W - small.width) // 2, (h - small.height) // 2))
    return canvas


def crop_y(im, h, top):
    return im.crop((0, top, W, top + h))


def extend_blur(im, h):
    """Lleva una pieza 4:5 a 9:16 con fondo desenfocado de la misma imagen (sin recortar el diseño)."""
    bg = im.resize((W, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", (W, h), (0, 0, 0)), 0.35)
    bg.paste(im, (0, (h - im.height) // 2))
    return bg


def fix_domain_17(im):
    """Pieza 17: el arte dice WWW.BEASTCLUB.COM (dominio equivocado); se reemplaza por BEASTCLUB.STORE."""
    d = ImageDraw.Draw(im)
    color = im.getpixel((420, 1245))
    d.rectangle((15, 1220, 415, 1272), fill=color)
    d.text((28, 1226), "BEASTCLUB.STORE", font=ImageFont.truetype(FONT, 31), fill=(20, 20, 20))
    return im


def save(im, name):
    im.save(os.path.join(OUT, name), quality=93) if name.endswith(".jpg") else im.save(os.path.join(OUT, name))
    print(f"  {name} {im.size}")


RECIPES = {
    # Fondo gris liso: se recorta el bloque útil (logo→zapatos) y se reescala sobre lienzo del mismo gris.
    "14.jpg": lambda im: {"916": im, "45": fit_on_canvas(crop_y(im, 1610, 240), H45, bg_color(im))},
    "15.jpg": lambda im: {"916": im, "45": fit_on_canvas(crop_y(im, 1610, 240), H45, bg_color(im))},
    "17.jpg": lambda im: (lambda f: {"916": f, "45": fit_on_canvas(crop_y(f, 1620, 230), H45, bg_color(f))})(fix_domain_17(im)),
    # Foto: recorte 4:5 que conserva titular y remate.
    "16.jpg": lambda im: {"916": im, "45": crop_y(im, H45, 285)},
    "19.png": lambda im: {"916": crop_y(im, H916, 0) if im.height >= H916 else fit_on_canvas(im, H916, (0, 0, 0)), "45": crop_y(im, H45, 520)},
    # Piezas 4:5: versión 9:16 con fondo desenfocado.
    "3.png": lambda im: {"45": im, "916": extend_blur(im, H916)},
    "5.1": lambda im: {"45": im, "916": extend_blur(im, H916)},
    "5.2": lambda im: {"45": im, "916": extend_blur(im, H916)},
    "5.3": lambda im: {"45": im, "916": extend_blur(im, H916)},
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for src, recipe in RECIPES.items():
        stem = os.path.splitext(src)[0] if src.endswith((".jpg", ".png")) else src
        print(src)
        for fmt, im in recipe(load(src)).items():
            save(im, f"{stem}_{fmt}.jpg")
