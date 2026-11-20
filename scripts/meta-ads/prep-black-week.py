"""Black Week 2026: versión 4:5 (feed) y 9:16 (Stories/Reels) de los estáticos del equipo.

Uso: python -I scripts/meta-ads/prep-black-week.py
Lee de SRC y escribe en SRC/listos con la clave del anuncio (BW1_45.jpg, BW1_916.jpg...). No toca los originales.
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = r"C:\Users\jefte\OneDrive\Documentos\BEAST CLUB\Meta Ads\Black week 2026"
OUT = os.path.join(SRC, "listos")
W, H45, H916 = 1080, 1350, 1920

# clave → archivo original (las 4:5 se extienden a 9:16; la historia 9:16 se encaja en 4:5).
PIECES = {
    "BW1": "Beast Club Posts (2).jpg",  # Trío en 3 modelos · 169.900
    "BW2": "Beast Club Posts (3).jpg",  # Trío flat lay · tachado 224.700
    "BW3": "IMG_0791.JPG",              # Outfit Beast · 189.900
    "BW4": "Historias Beast Club.jpg",  # Pack Training · 199.900 (9:16)
    "BW5": "Beast Club Posts.jpg",      # Mosaico «hasta 50% off»
    "BW6": "Beast Club Posts (1).jpg",  # Modelo «hasta 50% off · packs»
}


def extend_blur(im, h):
    """4:5 → 9:16 con fondo desenfocado de la misma imagen (sin recortar el diseño)."""
    bg = im.resize((W, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", (W, h), (0, 0, 0)), 0.35)
    bg.paste(im, (0, (h - im.height) // 2))
    return bg


def fit_on_canvas(im, h, color):
    """Encaja `im` completa en W×h sobre un lienzo liso del color del fondo."""
    s = min(W / im.width, h / im.height)
    small = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, h), color)
    canvas.paste(small, ((W - small.width) // 2, (h - small.height) // 2))
    return canvas



# Estáticos de los packs de mujer: flat lay de Nightjar + título, precio de lista tachado y precio del pack.
NJ = os.path.join(os.path.dirname(__file__), "..", "shopify-cro", ".out", "nightjar")
FONT = r"C:\Windows\Fonts\bahnschrift.ttf"
WOMEN = {
    "BWM1": ("bw-mujer-gris-flat-v4.webp", "PACK MUJER", "2 oversized + tank acid gris", "$229.700", "$179.900"),
    "BWM2": ("bw-mujer-negro-flat-v4.webp", "PACK MUJER", "2 oversized + tank negro", "$219.700", "$179.900"),
}


def font(size, style="Bold"):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(style)
    except Exception:
        pass
    return f


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def women_static(src, title, sub, was, now, h):
    im = cover(Image.open(os.path.join(NJ, src)).convert("RGB"), W, h)
    # Velos arriba y abajo para que el texto se lea sobre el concreto.
    veil = Image.new("L", (W, h), 0)
    d = ImageDraw.Draw(veil)
    for y in range(h):
        top = max(0, 1 - y / (h * 0.24)) * 200
        bot = max(0, (y - h * 0.74) / (h * 0.26)) * 220
        d.line([(0, y), (W, y)], fill=int(max(top, bot)))
    im = Image.composite(Image.new("RGB", (W, h), (11, 11, 12)), im, veil)
    d = ImageDraw.Draw(im)
    cx = W // 2
    top = 70 if h == H45 else 210
    d.text((cx, top), "BLACK WEEK BEAST", font=font(34, "SemiBold"), fill=(255, 90, 31), anchor="mt")
    d.text((cx, top + 46), title, font=font(118, "Bold Condensed"), fill=(244, 241, 234), anchor="mt")
    d.text((cx, top + 172), sub, font=font(40, "SemiLight"), fill=(244, 241, 234), anchor="mt")
    base = h - (150 if h == H45 else 300)
    fw, fn = font(56, "SemiBold"), font(96, "Bold Condensed")
    ww = d.textlength(was, font=fw)
    wn = d.textlength(now, font=fn)
    gap = 36
    x0 = cx - (ww + gap + wn) / 2
    d.text((x0, base), was, font=fw, fill=(244, 241, 234), anchor="ls")
    d.line([(x0 - 4, base - 20), (x0 + ww + 4, base - 20)], fill=(244, 241, 234), width=4)
    d.text((x0 + ww + gap, base + 6), now, font=fn, fill=(255, 90, 31), anchor="ls")
    d.text((cx, base + 52), "Pagas al recibir · Añade la 4.ª y el envío es gratis", font=font(32, "SemiLight"), fill=(244, 241, 234), anchor="mt")
    return im


os.makedirs(OUT, exist_ok=True)
for key, (src, title, sub, was, now) in WOMEN.items():
    feed = women_static(src, title, sub, was, now, H45)
    # 9:16 = la misma pieza 4:5 sobre fondo desenfocado (recortar el flat lay dejaba prendas cortadas).
    for fmt, img in (("45", feed), ("916", extend_blur(feed, H916))):
        img.save(os.path.join(OUT, f"{key}_{fmt}.jpg"), quality=93)
        print(f"  {key}_{fmt}.jpg")

for key, name in PIECES.items():
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    if im.height == H916:
        out = {"916": im, "45": fit_on_canvas(im, H45, im.getpixel((W - 10, 10)))}
    else:
        out = {"45": im, "916": extend_blur(im, H916)}
    for fmt, img in out.items():
        img.save(os.path.join(OUT, f"{key}_{fmt}.jpg"), quality=93)
        print(f"  {key}_{fmt}.jpg {img.size}")
