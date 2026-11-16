"""Reedita videos para Meta: recorte, oferta en pantalla desde el primer fotograma, 4:5 y 9:16, audio normalizado.

Uso: python -I scripts/meta-ads/video-edit.py [clave ...]   (sin claves = todas)
Lee de SRC y escribe en OUT (no toca los originales). La receta de cada pieza vive en RECIPES.
Requiere ffmpeg (winget install Gyan.FFmpeg).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

BASE = r"C:\Users\jefte\OneDrive\Documentos\BEAST CLUB\Meta Ads"
SRC = os.path.join(BASE, "Noviembre 2026")
OUT = os.path.join(SRC, "listos")
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FONT = os.path.join(REPO, "public", "fonts", "khand-700.woff2")
FORMATS = {"45": (1080, 1350), "916": (1080, 1920)}
RED, BLACK, WHITE = (227, 18, 18), (15, 15, 15), (255, 255, 255)

# crop_y: píxel superior del recorte, ya escalado a 1080 de ancho.
# text_y: dónde va la franja; en 9:16 se mantiene fuera de la interfaz de Reels (abajo).
# hook_seconds: None = la franja se queda todo el video.
RECIPES = {
    "U2R": {
        "src": "1023 (2).mp4",
        "start": None,
        "end": None,
        "hook_seconds": None,
        "crop_y": {"45": 200, "916": 0},
        "text_y": {"45": 960, "916": 960},
        "lines": [("$59.900", 170, RED), ("Pagas al recibir", 84, BLACK)],
    },
}


def tool(name):
    links = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Links", f"{name}.exe")
    found = shutil.which(name) or (links if os.path.exists(links) else None)
    if not found:
        sys.exit(f"Falta {name}: winget install Gyan.FFmpeg")
    return found


def overlay_png(path, size, y, lines):
    """Franja blanca con la oferta sobre un lienzo transparente del tamaño del video."""
    w, h = size
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    fonts = [ImageFont.truetype(FONT, s) for _, s, _ in lines]
    heights = [draw.textbbox((0, 0), t, font=f)[3] - draw.textbbox((0, 0), t, font=f)[1] for (t, _, _), f in zip(lines, fonts)]
    pad, gap, margin = 28, 18, 60
    bottom = y + sum(heights) + gap * (len(lines) - 1) + pad * 2
    draw.rounded_rectangle((margin, y, w - margin, bottom), radius=24, fill=(*WHITE, 240))
    cursor = y + pad
    for (text, _, color), font, height in zip(lines, fonts, heights):
        box = draw.textbbox((0, 0), text, font=font)
        draw.text(((w - (box[2] - box[0])) / 2 - box[0], cursor - box[1]), text, font=font, fill=color)
        cursor += height + gap
    if bottom > h:
        sys.exit(f"La franja se sale del cuadro ({bottom} > {h})")
    canvas.save(path)


def has_audio(ffprobe, src):
    out = subprocess.run([ffprobe, "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", src],
                         capture_output=True, text=True, check=True).stdout
    return bool(out.strip())


def render(key, recipe, ffmpeg, ffprobe, tmp):
    src = os.path.join(SRC, recipe["src"])
    audio = has_audio(ffprobe, src)
    for fmt, (w, h) in FORMATS.items():
        png = os.path.join(tmp, f"{key}_{fmt}.png")
        overlay_png(png, (w, h), recipe["text_y"][fmt], recipe["lines"])
        limit = recipe["hook_seconds"]
        enable = f":enable='between(t,0,{limit})'" if limit else ""
        graph = (f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,"
                 f"crop={w}:{h}:(iw-{w})/2:{recipe['crop_y'][fmt]},fps=30[base];[base][1:v]overlay=0:0{enable},format=yuv420p[v]")
        dst = os.path.join(OUT, f"{key}_{fmt}.mp4")
        cmd = [ffmpeg, "-y", "-v", "error"]
        if recipe["start"] is not None:
            cmd += ["-ss", str(recipe["start"])]
        if recipe["end"] is not None:
            cmd += ["-to", str(recipe["end"])]
        cmd += ["-i", src, "-i", png, "-filter_complex", graph, "-map", "[v]"]
        if audio:
            cmd += ["-map", "0:a:0", "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "160k"]
        cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-movflags", "+faststart", dst]
        subprocess.run(cmd, check=True)
        info = json.loads(subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
                                          "-of", "json", dst], capture_output=True, text=True, check=True).stdout)
        s = info["streams"][0]
        print(f"  {os.path.basename(dst)} {s['width']}x{s['height']} {float(info['format']['duration']):.1f}s audio={audio}")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ffmpeg_bin, ffprobe_bin = tool("ffmpeg"), tool("ffprobe")
    keys = sys.argv[1:] or list(RECIPES)
    with tempfile.TemporaryDirectory() as work:
        for k in keys:
            print(k)
            render(k, RECIPES[k], ffmpeg_bin, ffprobe_bin, work)
