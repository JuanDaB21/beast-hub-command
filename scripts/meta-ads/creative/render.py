"""Renderiza los creativos de Meta desde plantillas HTML: imágenes y videos en 4:5 y 9:16.

Uso: python scripts/meta-ads/creative/render.py [clave ...]   (sin claves = todas; sin -I porque playwright está en el sitio de usuario)
Requiere: playwright con Chromium (fuera de package.json) y ffmpeg.
Cada plantilla define window.seek(t) si es animada; así cada fotograma es exacto.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
MEDIA = Path(r"C:\Users\jefte\OneDrive\Documentos\BEAST CLUB\Meta Ads")
NOV = MEDIA / "Noviembre 2026"
OUT = NOV / "listos"
FORMATS = {"45": (1080, 1350), "916": (1080, 1920)}
FPS = 30

RECIPES = {
    "T1": {"kind": "motion", "template": "t1.html", "seconds": 7.5},
    "T3": {"kind": "still", "template": "t3.html", "vars": {"__PHOTO__": "3 (1).png"}},
    "T3b": {"kind": "still", "template": "t3.html", "vars": {"__PHOTO__": "4.png"}},
    "T4": {"kind": "overlay", "template": "t4.html", "src": "1023 (2).mp4", "start": 0.3, "seconds": 6.6, "crop_y": {"45": 200, "916": 0}},
}

# Dos avisos cortos: la notificación y la subida del carrito.
SOUND = ("aevalsrc='0.32*sin(2*PI*1318*t)*exp(-13*t)+0.22*sin(2*PI*1760*t)*exp(-13*t)"
         "+if(gte(t,2.3),0.18*sin(2*PI*520*(t-2.3))*exp(-18*(t-2.3)),0)':d={d}:s=48000")


def tool(name):
    links = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / f"{name}.exe"
    found = shutil.which(name) or (str(links) if links.exists() else None)
    if not found:
        sys.exit(f"Falta {name}: winget install Gyan.FFmpeg")
    return found


def build_html(recipe, fmt, work):
    w, h = FORMATS[fmt]
    html = (HERE / recipe["template"]).read_text(encoding="utf-8").replace("__TOKENS__", (HERE / "tokens.css").read_text(encoding="utf-8"))
    values = {"__MEDIA__": MEDIA.as_uri(), "__FONTS__": (REPO / "public" / "fonts").as_uri(), "__NOV__": NOV.as_uri(),
              "__W__": str(w), "__H__": str(h), "__FMT__": fmt, **recipe.get("vars", {})}
    for key, value in values.items():
        html = html.replace(key, value)
    path = Path(work) / f"page_{fmt}.html"
    path.write_text(html, encoding="utf-8")
    return path


def open_page(browser, path, fmt):
    w, h = FORMATS[fmt]
    page = browser.new_page(viewport={"width": w, "height": h})
    page.goto(path.as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_load_state("networkidle")
    return page


def capture(page, seconds, folder, image_type, transparent):
    folder.mkdir(exist_ok=True)
    ext = "jpg" if image_type == "jpeg" else "png"
    options = {"type": image_type, **({"quality": 95} if image_type == "jpeg" else {"omit_background": transparent})}
    for i in range(round(seconds * FPS)):
        page.evaluate("t => window.seek(t)", i / FPS)
        page.screenshot(path=str(folder / f"{i:04d}.{ext}"), **options)
    return folder / f"%04d.{ext}"


def report(ffprobe, dst):
    data = json.loads(subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", str(dst)],
                                     capture_output=True, text=True, check=True).stdout)
    s = data["streams"][0]
    print(f"  {dst.name} {s['width']}x{s['height']} {float(data['format']['duration']):.1f}s")


def encode(ffmpeg, args, dst):
    subprocess.run([ffmpeg, "-y", "-v", "error", *args, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(dst)], check=True)


def render(key, recipe, browser, ffmpeg, ffprobe, work):
    for fmt, (w, h) in FORMATS.items():
        page = open_page(browser, build_html(recipe, fmt, work), fmt)
        folder = Path(work) / f"{key}_{fmt}"
        if recipe["kind"] == "still":
            dst = OUT / f"{key}_{fmt}.jpg"
            page.screenshot(path=str(dst), type="jpeg", quality=94)
            print(f"  {dst.name} {w}x{h}")
        elif recipe["kind"] == "motion":
            frames = capture(page, recipe["seconds"], folder, "jpeg", False)
            dst = OUT / f"{key}_{fmt}.mp4"
            encode(ffmpeg, ["-framerate", str(FPS), "-i", str(frames), "-f", "lavfi", "-i", SOUND.format(d=recipe["seconds"]), "-shortest"], dst)
            report(ffprobe, dst)
        else:
            frames = capture(page, recipe["seconds"], folder, "png", True)
            dst = OUT / f"{key}_{fmt}.mp4"
            graph = (f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}:(iw-{w})/2:{recipe['crop_y'][fmt]},fps={FPS}[base];"
                     "[base][1:v]overlay=0:0:shortest=1[v]")
            encode(ffmpeg, ["-ss", str(recipe["start"]), "-t", str(recipe["seconds"]), "-i", str(NOV / recipe["src"]), "-framerate", str(FPS), "-i", str(frames),
                            "-filter_complex", graph, "-map", "[v]", "-map", "0:a:0", "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-ar", "48000"], dst)
            report(ffprobe, dst)
        page.close()


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    ffmpeg_bin, ffprobe_bin = tool("ffmpeg"), tool("ffprobe")
    keys = sys.argv[1:] or list(RECIPES)
    with sync_playwright() as p, tempfile.TemporaryDirectory() as tmp:
        chromium = p.chromium.launch()
        for k in keys:
            print(k)
            render(k, RECIPES[k], chromium, ffmpeg_bin, ffprobe_bin, tmp)
        chromium.close()
