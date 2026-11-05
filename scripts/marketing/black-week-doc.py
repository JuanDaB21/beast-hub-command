"""Genera el plan ejecutivo de Black Week (PDF horizontal tipo diapositivas + MD con las mismas imágenes).

Uso: node scripts/analytics/black-week.cjs   (cifras, fotos de Shopify y miniaturas de Meta)
     python scripts/marketing/black-week-doc.py

Lee docs/marketing/black-week-2026/config.json y scripts/analytics/.out/black-week.json.
Escribe PLAN_BLACK_WEEK_BEAST_2026.md/.pdf y las imágenes en docs/marketing/black-week-2026/img/.
"""
import io
import json
import os
import re
import urllib.request
from datetime import date, datetime
from xml.sax.saxutils import escape

import matplotlib
matplotlib.use('Agg')
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from PIL import Image as PImage, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOC_DIR = os.path.join(ROOT, 'docs', 'marketing', 'black-week-2026')
IMG = os.path.join(DOC_DIR, 'img')
CFG = json.load(open(os.path.join(DOC_DIR, 'config.json'), encoding='utf8'))
DATA = json.load(open(os.path.join(ROOT, 'scripts', 'analytics', '.out', 'black-week.json'), encoding='utf8'))
OUT_NAME = 'PLAN_BLACK_WEEK_BEAST_2026'
os.makedirs(IMG, exist_ok=True)

INK, MUTED, ACCENT, GRAY, LIGHT = '#111111', '#5f5f5f', '#c8102e', '#b8b8b8', '#f2f2f2'
FONTS = 'C:/Windows/Fonts'


def cop(n):
    return '$' + f"{round(n):,}".replace(',', '.')


def k(n):
    return f"{n / 1000:.0f}k"


def mill(n):
    return f"{n / 1e6:.2f} M".replace('.', ',')


def pct(x):
    return f"{x * 100:.0f} %"


def font(size, weight='regular'):
    name = {'regular': 'arial.ttf', 'bold': 'arialbd.ttf', 'black': 'ariblk.ttf'}[weight]
    return ImageFont.truetype(os.path.join(FONTS, name), size)


# ---------------- Datos derivados ----------------
PACKS = {}
for x in DATA['packs']:
    PACKS.setdefault(x['pack'], []).append(x)
VERSION = {x['version']: x for x in DATA['packs']}
PACK_CFG = {p['id']: p for p in CFG['packs']}
ESC = {s['id']: s for s in DATA['escenarios']}
BASE = DATA['base']
three = [x for x in DATA['packs'] if x['prendas'] == 3]
avg3_with = sum(x['margen_con_envio'] for x in three) / len(three)
avg3_without = sum(x['margen_sin_envio'] for x in three) / len(three)
pack4 = PACKS['pack4'][0]
upgrade = pack4['precio'] - PACK_CFG['trio']['precio']


# ---------------- Imágenes de origen (caché) ----------------
def fetch(url, name):
    path = os.path.join(IMG, name)
    if os.path.exists(path):
        return path
    if not url:
        return None
    if 'cdn.shopify.com' in url:
        url += ('&' if '?' in url else '?') + 'width=800'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        im = PImage.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')
        im.thumbnail((800, 800))
        im.save(path, quality=88)
        return path
    except Exception as e:  # la imagen es opcional
        print('sin imagen', name, e)
        return None


def product_image(comp):
    return fetch(comp.get('image'), f"prod-{comp['handle']}.jpg")


def fit(im, w, h, bg=LIGHT):
    """Encaja la imagen en w×h sin recortar, sobre fondo bg."""
    canvas = PImage.new('RGB', (w, h), bg)
    im = im.copy()
    im.thumbnail((w, h))
    canvas.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return canvas


def cover(im, w, h):
    """Rellena w×h recortando al centro."""
    r = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1))
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def version_images(version_id):
    return [PImage.open(p) for p in (product_image(c) for c in VERSION[version_id]['componentes']) if p]


def text_center(d, xy_box, text, f, fill):
    x0, y0, x1, y1 = xy_box
    b = d.textbbox((0, 0), text, font=f)
    d.text((x0 + (x1 - x0 - (b[2] - b[0])) / 2, y0 + (y1 - y0 - (b[3] - b[1])) / 2 - b[1]), text, font=f, fill=fill)


def strike(d, xy, text, f, fill):
    d.text(xy, text, font=f, fill=fill)
    b = d.textbbox(xy, text, font=f)
    y = (b[1] + b[3]) / 2
    d.line((b[0], y, b[2], y), fill=fill, width=max(2, f.size // 12))
    return b


def wrap(d, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    return lines + [cur] if cur else lines


# ---------------- Visuales generados ----------------
def img_oferta():
    """Escalera: una tarjeta por pack con las fotos reales; el Pack 4 destacado."""
    order = [('trio', 'trio-negro'), ('outfit', 'outfit'), ('training', 'training'), ('pack4', 'pack4')]
    W, H, cw, gap = 2400, 1180, 540, 40
    im = PImage.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    for i, (pid, vid) in enumerate(order):
        p, v = PACK_CFG[pid], VERSION[vid]
        x = 40 + i * (cw + gap)
        top = 150
        hl = p['envio_gratis']
        d.rounded_rectangle((x, top, x + cw, H - 30), 24, fill='white', outline=ACCENT if hl else '#d0d0d0', width=8 if hl else 3)
        pics = version_images(vid)
        n = len(pics)
        tile = (cw - 40) // n
        for j, pic in enumerate(pics):
            im.paste(fit(pic, tile - 6, 300), (x + 20 + j * tile, top + 24))
        y = top + 350
        d.text((x + 30, y), p['nombre'], font=font(44, 'black'), fill=INK)
        sub = f"{v['prendas']} prendas" + (' · Negra o Color' if pid == 'trio' else '')
        d.text((x + 30, y + 62), sub, font=font(30), fill=MUTED)
        strike(d, (x + 30, y + 120), f"Lista {cop(v['lista'])}", font(34), MUTED)
        d.text((x + 30, y + 170), cop(p['precio']), font=font(84, 'black'), fill=INK)
        d.text((x + 30, y + 275), f"−{pct(v['descuento_lista'])} sobre lista", font=font(32, 'bold'), fill=INK)
        badge = 'ENVÍO GRATIS' if hl else 'Envío normal (paga el cliente)'
        bx = (x + 30, y + 340, x + cw - 30, y + 410)
        d.rounded_rectangle(bx, 16, fill=ACCENT if hl else LIGHT)
        text_center(d, bx, badge, font(32 if hl else 26, 'black' if hl else 'regular'), 'white' if hl else MUTED)
        d.text((x + 30, y + 440), f"Le queda a la empresa ≈ {k(v['margen'])}", font=font(28), fill=MUTED)
    # Flecha de mejora del Trío al Pack 4
    ax0, ax1 = 40 + cw // 2, 40 + 3 * (cw + gap) + cw // 2
    d.line((ax0, 110, ax1, 110), fill=ACCENT, width=8)
    d.polygon([(ax1, 140), (ax1 - 26, 96), (ax1 + 26, 96)], fill=ACCENT)
    d.line((ax0, 110, ax0, 140), fill=ACCENT, width=8)
    label = f"+{cop(upgrade)} = 4.ª camiseta + envío gratis"
    f = font(46, 'black')
    tw = d.textlength(label, font=f)
    d.rectangle(((ax0 + ax1 - tw) / 2 - 24, 70, (ax0 + ax1 + tw) / 2 + 24, 150), fill='white')
    text_center(d, (ax0, 70, ax1, 150), label, f, ACCENT)
    path = os.path.join(IMG, 'oferta-escalera.png')
    im.save(path)
    return path


def style_axes(ax):
    for s in ('top', 'right', 'left'):
        ax.spines[s].set_visible(False)
    ax.spines['bottom'].set_color('#cccccc')
    ax.tick_params(axis='y', length=0, labelsize=11, labelcolor=INK)
    ax.tick_params(axis='x', colors=MUTED, labelsize=9)
    ax.xaxis.grid(True, color='#eeeeee', linewidth=0.8)
    ax.set_axisbelow(True)


def hbar(path, labels, values, colors_, fmt, xmax=None, size=(7.2, 3.2)):
    plt.rcParams['font.family'] = 'Arial'
    fig, ax = plt.subplots(figsize=size, dpi=200)
    y = list(range(len(labels)))[::-1]
    ax.barh(y, values, height=0.5, color=colors_, edgecolor='white', linewidth=2)
    ax.set_yticks(y, labels)
    style_axes(ax)
    top = xmax or max(values) * 1.22
    ax.set_xlim(0, top)
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: fmt(v)))
    for yi, v in zip(y, values):
        ax.text(v + top * 0.015, yi, fmt(v), va='center', fontsize=12, fontweight='bold', color=INK)
    fig.tight_layout()
    fig.savefig(path, facecolor='white')
    plt.close(fig)
    return path


def img_margen():
    labels = ['Pedido normal hoy\n(cliente paga envío)', 'Pack de 3 CON envío gratis', 'Pack de 3 SIN envío gratis', f"Pack 4 CON envío gratis\n(≥ {cop(CFG['envio']['umbral_black_week'])})"]
    values = [BASE['margen_pedido'], avg3_with, avg3_without, pack4['margen']]
    return hbar(os.path.join(IMG, 'margen-por-pedido.png'), labels, values, [GRAY, '#e3a3ad', ACCENT, ACCENT], lambda v: f"{v / 1000:.0f}k")


def img_pyl():
    labels = ['Semana normal', 'Black Week · packs\ncon envío gratis', f"Black Week · escalera\n(envío gratis ≥ {cop(CFG['envio']['umbral_black_week'])})"]
    values = [ESC['normal']['utilidad'], ESC['todo_gratis']['utilidad'], ESC['escalera']['utilidad']]
    return hbar(os.path.join(IMG, 'utilidad-semana.png'), labels, values, [GRAY, '#e3a3ad', ACCENT],
                lambda v: f"{v / 1e6:.2f} M".replace('.', ','), size=(7.2, 2.6))


def img_timeline():
    plt.rcParams['font.family'] = 'Arial'
    fases = CFG['fases']
    fig, ax = plt.subplots(figsize=(11, 3.1), dpi=200)
    for i, f in enumerate(fases[::-1]):
        a, b = date.fromisoformat(f['inicio']), date.fromisoformat(f['fin'])
        c = ACCENT if f['fase'] == 'Campaña' else '#9a9a9a'
        ax.barh(i, (b - a).days + 1, left=mdates.date2num(a), height=0.5, color=c, edgecolor='white')
        ax.text(mdates.date2num(b) + 1.4, i, f['detalle'], va='center', fontsize=9, color=MUTED)
    ax.set_yticks(range(len(fases)), [f['fase'] for f in fases[::-1]])
    for when, label in [('2026-11-10', 'Reabastecimiento'), ('2026-11-20', 'Lanzamiento'), ('2026-11-27', 'Black Friday')]:
        x = mdates.date2num(date.fromisoformat(when))
        ax.axvline(x, color=INK, linewidth=1, linestyle=(0, (3, 3)))
        ax.text(x, len(fases) - 0.35, label, ha='center', fontsize=9, fontweight='bold', color=INK)
    ticks = [date(2026, 11, d) for d in (3, 10, 17, 20, 24, 27)] + [date(2026, 12, 1)]
    ax.set_xticks([mdates.date2num(t) for t in ticks], [f"{t.day}-{'nov' if t.month == 11 else 'dic'}" for t in ticks])
    ax.set_xlim(mdates.date2num(date(2026, 11, 2)), mdates.date2num(date(2026, 12, 16)))
    style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    path = os.path.join(IMG, 'calendario.png')
    fig.savefig(path, facecolor='white')
    plt.close(fig)
    return path


def mockup(clave):
    """Maqueta 4:5 de un estático con fotos reales del pack y el precio grande."""
    c = next(m for m in CFG['matriz_creativa'] if m['clave'] == clave)
    W, H = 1080, 1350
    im = PImage.new('RGB', (W, H), '#0e0e0e')
    d = ImageDraw.Draw(im)
    text_center(d, (0, 40, W, 120), 'BLACK WEEK BEAST', font(64, 'black'), 'white')
    text_center(d, (0, 120, W, 170), 'del 20 al 27 de noviembre', font(34), '#bbbbbb')
    pics = version_images(c['version'])
    n = len(pics)
    tw = (W - 80) // n
    for j, pic in enumerate(pics):
        im.paste(fit(pic, tw - 12, 560, '#f4f4f4'), (40 + j * tw, 210))
    if clave == 'E2':
        trio = VERSION['trio-negro']
        text_center(d, (0, 820, W, 940), f"3 × {cop(PACK_CFG['trio']['precio'])}", font(96, 'black'), 'white')
        text_center(d, (0, 950, W, 1080), f"4 × {cop(pack4['precio'])}", font(110, 'black'), 'white')
        box = (170, 1100, W - 170, 1180)
        d.rounded_rectangle(box, 18, fill=ACCENT)
        text_center(d, box, '+ ENVÍO GRATIS', font(48, 'black'), 'white')
        lista = trio['lista']
    else:
        v = VERSION[c['version']]
        text_center(d, (0, 810, W, 960), f"3 × {cop(v['precio'])}", font(140, 'black'), 'white')
        lt = f"Precio de lista {cop(v['lista'])}"
        f = font(42)
        tw2 = d.textlength(lt, font=f)
        strike(d, ((W - tw2) / 2, 990), lt, f, '#9c9c9c')
        lista = v['lista']
    box = (300, 1220, W - 300, 1290)
    d.rounded_rectangle(box, 35, outline='white', width=3)
    text_center(d, box, 'Pagas al recibir', font(36, 'bold'), 'white')
    d.text((40, 1300), 'BEAST CLUB', font=font(30, 'black'), fill='#777777')
    d.text((W - 360, 1300), 'MAQUETA DE REFERENCIA', font=font(24, 'bold'), fill='#777777')
    _ = lista
    path = os.path.join(IMG, f"maqueta-{clave}.png")
    im.save(path)
    return path


def storyboard(clave):
    """Tres cuadros 9:16 con zonas seguras marcadas y el texto en pantalla de cada tiempo."""
    c = next(m for m in CFG['matriz_creativa'] if m['clave'] == clave)
    pics = version_images(c['version'])
    fw, fh, gap = 360, 640, 40
    W, H = 3 * fw + 4 * gap, fh + 90
    im = PImage.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    for i, (t, accion) in enumerate(c['guion']):
        x, y = gap + i * (fw + gap), 70
        d.text((x, 18), t, font=font(34, 'black'), fill=ACCENT)
        if i == 1 and pics:
            frame = cover(pics[0], fw, fh)
        else:
            frame = PImage.new('RGB', (fw, fh), '#f4f4f4')
            n = max(1, len(pics))
            for j, pic in enumerate(pics):
                frame.paste(fit(pic, fw - 20, (fh - 40) // n - 8, '#f4f4f4'), (10, 20 + j * ((fh - 40) // n)))
        im.paste(frame, (x, y))
        ov = PImage.new('RGBA', (fw, fh), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        od.rectangle((0, 0, fw, int(fh * 0.14)), fill=(17, 17, 17, 70))
        od.rectangle((0, int(fh * 0.65), fw, fh), fill=(17, 17, 17, 70))
        im.paste(ov, (x, y), ov)
        d.text((x + 8, y + 6), 'zona libre', font=font(18), fill='white')
        d.text((x + 8, y + fh - 28), 'zona libre (botones de Meta)', font=font(18), fill='white')
        quotes = re.findall(r'«(.+?)»', accion)
        if quotes:
            label = ' · '.join(quotes)
            f = font(26, 'black')
            lines = wrap(d, label, f, fw - 40)
            by = y + int(fh * 0.40) - 22 * len(lines)
            d.rectangle((x + 10, by - 10, x + fw - 10, by + 38 * len(lines) + 4), fill=(17, 17, 17))
            for li, line in enumerate(lines):
                text_center(d, (x, by + li * 38, x + fw, by + li * 38 + 34), line, f, 'white')
        d.rectangle((x, y, x + fw, y + fh), outline='#cccccc', width=2)
    path = os.path.join(IMG, f"storyboard-{clave}.png")
    im.save(path)
    return path


def ad_thumbs():
    out = []
    for a in DATA['anuncios']:
        p = fetch(a.get('thumb'), f"ad-{a['clave']}.jpg")
        out.append((a, p))
    return out


# ---------------- Revisión automática del copy ----------------
FORBIDDEN = re.compile(r'gymshark|youngla|cbum|gmthark|monster|nuevo lanzamiento|robar|\bantes\b', re.I)
copy_issues = [f"{m['clave']}: «{w}»" for m in CFG['matriz_creativa']
               for fld in ('titulo', 'copy', 'texto_pantalla', 'gancho') for w in FORBIDDEN.findall(m.get(fld, ''))]


# ---------------- Documento ----------------
FONT_DIR = 'C:/Windows/Fonts'
pdfmetrics.registerFont(TTFont('Arial', os.path.join(FONT_DIR, 'arial.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Bold', os.path.join(FONT_DIR, 'arialbd.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Black', os.path.join(FONT_DIR, 'ariblk.ttf')))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial', boldItalic='Arial-Bold')
C_INK, C_MUTED, C_ACCENT, C_RULE, C_LIGHT = (colors.HexColor(x) for x in (INK, MUTED, ACCENT, '#d9d9d9', LIGHT))
PAGE = landscape(A4)
MARGIN = 14 * mm
WIDTH = PAGE[0] - 2 * MARGIN
ST = {
    'cover': ParagraphStyle('cover', fontName='Arial-Black', fontSize=34, leading=38, textColor=C_INK),
    'kicker': ParagraphStyle('kicker', fontName='Arial-Bold', fontSize=10, leading=12, textColor=C_ACCENT, spaceAfter=2),
    'title': ParagraphStyle('title', fontName='Arial-Black', fontSize=21, leading=25, textColor=C_INK, spaceAfter=8),
    'p': ParagraphStyle('p', fontName='Arial', fontSize=10.5, leading=14.5, textColor=C_INK, spaceAfter=4),
    'small': ParagraphStyle('small', fontName='Arial', fontSize=8.5, leading=11.5, textColor=C_MUTED),
    'cell': ParagraphStyle('cell', fontName='Arial', fontSize=8.6, leading=11, textColor=C_INK),
    'head': ParagraphStyle('head', fontName='Arial-Bold', fontSize=8.6, leading=11, textColor=colors.white),
    'kpi': ParagraphStyle('kpi', fontName='Arial-Black', fontSize=22, leading=25, textColor=C_INK),
    'kpil': ParagraphStyle('kpil', fontName='Arial', fontSize=9, leading=11.5, textColor=C_MUTED),
}


def rich(text):
    parts = escape(text).split('**')
    return ''.join(f"<b>{s}</b>" if i % 2 else s for i, s in enumerate(parts))


def img(path, w, h=None):
    if not path:
        return Spacer(1, 1)
    with PImage.open(path) as im:
        ratio = im.height / im.width
    width = w
    height = w * ratio
    if h and height > h:
        height, width = h, h / ratio
    return Image(path, width=width, height=height)


def bullets(items, style='p'):
    return [Paragraph('<font color="#c8102e">■</font>&nbsp;&nbsp;' + rich(t), ST[style]) for t in items]


def table(head, rows, ratios, width=WIDTH):
    data = [[Paragraph(escape(h), ST['head']) for h in head]] + [[Paragraph(rich(str(c)), ST['cell']) for c in r] for r in rows]
    t = Table(data, colWidths=[width * r for r in ratios], repeatRows=1)
    style = [('BACKGROUND', (0, 0), (-1, 0), C_INK), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
             ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
             ('LINEBELOW', (0, 1), (-1, -1), 0.3, C_RULE)]
    style += [('BACKGROUND', (0, i), (-1, i), C_LIGHT) for i in range(2, len(data), 2)]
    t.setStyle(TableStyle(style))
    return t


def kpi_tiles(items, width=WIDTH):
    cells = [[Paragraph(v, ST['kpi']), Paragraph(lbl, ST['kpil'])] for v, lbl in items]
    t = Table([[Table([[c[0]], [c[1]]]) for c in cells]], colWidths=[width / len(items)] * len(items))
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0, colors.white), ('LINEBEFORE', (1, 0), (-1, -1), 0.6, C_RULE),
                           ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 10)]))
    return t


def side(left, right, ratio=0.5):
    t = Table([[left, right]], colWidths=[WIDTH * ratio, WIDTH * (1 - ratio)])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 10)]))
    return t


def build():
    """Devuelve [(kicker, título, [flowables PDF], [líneas MD])] — una entrada por página."""
    pages = []
    per = CFG['periodo']
    esc = ESC['escalera']

    # 1. Portada
    imgs_cover = img_oferta()
    tiles = [(mill(esc['utilidad']), f"utilidad estimada de la semana, frente a {mill(ESC['normal']['utilidad'])} en una semana normal"),
             (f"{CFG['demanda']['pedidos_semana']} pedidos", f"meta de la semana ({round(CFG['demanda']['pedidos_semana'] * CFG['demanda']['participacion_packs'])} en pack); hoy ≈ {BASE['pedidos_semana']:.0f}"),
             (cop(PACK_CFG['trio']['precio']), 'pack de entrada (3 prendas)'),
             (f"{k(CFG['pauta']['diaria_black_week'])}/día", f"pauta durante {per['dias']} días")]
    pdf = [Paragraph('BEAST CLUB · PLAN DE CAMPAÑA', ST['kicker']),
           Paragraph(f"Black Week Beast<br/>{per['texto']} de 2026", ST['cover']), Spacer(1, 10),
           kpi_tiles(tiles), Spacer(1, 12),
           side([Paragraph('<b>En 30 segundos</b>', ST['p'])] + bullets(CFG['resumen']), img(imgs_cover, WIDTH * 0.45), 0.53)]
    md = [f"# Black Week Beast · {per['texto']} de 2026", '',
          '| ' + ' | '.join(v for v, _ in tiles) + ' |', '|' + '---|' * len(tiles), '| ' + ' | '.join(lbl for _, lbl in tiles) + ' |', '',
          '**En 30 segundos**', ''] + [f"- {x}" for x in CFG['resumen']] + ['']
    pages.append(('', '', pdf, md))

    # 2. Oferta
    rows = [[x['version_nombre'], ' + '.join(c['title'] for c in x['componentes']), cop(x['lista']), cop(x['precio']),
             pct(x['descuento_lista']), 'Sí' if x['envio_gratis'] else 'No', k(x['margen'])] for x in DATA['packs']]
    head = ['Pack', 'Prendas', 'Lista', 'Precio', 'Desc.', 'Envío gratis', 'Le queda']
    comp = '; '.join(f"{c['nombre']} {cop(c['precio_black_week'])} (lista {cop(c['precio_lista'])})" for c in CFG['complementos'])
    pdf = [img(imgs_cover, WIDTH, 82 * mm), Spacer(1, 6),
           table(head, rows, [0.11, 0.47, 0.08, 0.08, 0.06, 0.09, 0.11]), Spacer(1, 4),
           Paragraph(f"<b>Complementos de liquidación:</b> {escape(comp)}. Se muestran en la página de packs; no llevan pauta propia.", ST['small'])]
    md = ['![Escalera de packs](img/oferta-escalera.png)', '', '| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + \
         ['| ' + ' | '.join(r) + ' |' for r in rows] + ['', f"**Complementos de liquidación:** {comp}.", '']
    pages.append(('LA OFERTA', f"4 packs en escalera; el envío gratis solo desde {cop(CFG['envio']['umbral_black_week'])}", pdf, md))

    # 3. Rentabilidad
    g1, g2 = img_margen(), img_pyl()
    msg = [f"Una vez pagadas las prendas, las comisiones y la nómina ({k(DATA['nomina'])} por prenda), un pack de 3 con envío gratis deja ≈ **{k(avg3_with)}**: menos que un pedido normal (≈ {k(BASE['margen_pedido'])}).",
           f"Sin envío gratis, el mismo pack deja ≈ **{k(avg3_without)}**. El envío gratis se reserva para el Pack 4 ({cop(pack4['precio'])}), que lo soporta (≈ {k(pack4['margen'])}).",
           f"Con {CFG['demanda']['pedidos_semana']} pedidos, la escalera deja **{mill(esc['utilidad'])}** después de pauta. Con envío gratis en todo se necesitarían **{DATA['pedidos_para_igualar']:.0f} pedidos** para igualarla.",
           'Para el cliente, el «antes» es el precio de lista (tachado), y el descuento se mide contra ese precio.']
    pdf = [side([Paragraph('<b>Lo que le queda a la empresa por pedido, antes de pauta</b>', ST['p']), img(g1, WIDTH * 0.55)],
                [Spacer(1, 6)] + bullets(msg), 0.58), Spacer(1, 4),
           side([Paragraph('<b>Utilidad de la semana después de pauta</b>', ST['p']), img(g2, WIDTH * 0.55)],
                [Paragraph(f"Supuestos: {CFG['demanda']['pedidos_semana']} pedidos, {pct(CFG['demanda']['participacion_packs'])} en pack, pauta de {k(CFG['pauta']['diaria_black_week'])}/día × {per['dias']} días con impuestos. Semana normal: {BASE['pedidos_semana']:.0f} pedidos y {k(CFG['pauta']['diaria_actual'])}/día.", ST['small'])], 0.58)]
    md = ['![Margen por pedido](img/margen-por-pedido.png)', ''] + [f"- {x}" for x in msg] + ['', '![Utilidad de la semana](img/utilidad-semana.png)', '']
    pages.append(('RENTABILIDAD', 'El envío gratis en packs de 3 se come la mitad del margen', pdf, md))

    # 4. Qué funciona en Meta
    thumbs = ad_thumbs()
    cells, md_rows = [], []
    for a, p in thumbs:
        cpa = k(a['cpa']) if a.get('cpa') else '—'
        cv = f"{a['compra_visita'] * 100:.1f} %".replace('.', ',') if a.get('compra_visita') is not None else '—'
        cap = f"<b>{escape(a['clave'])}</b> · {escape(a['formato'])}<br/>CPA {cpa} · compran {cv} de las visitas<br/><font color='#5f5f5f'>{escape(a['lectura'])}</font>"
        cells.append([img(p, WIDTH / 4 - 14, 52 * mm), Paragraph(cap, ST['cell'])])
        md_rows.append(f"| ![{a['clave']}](img/ad-{a['clave']}.jpg) | **{a['clave']}** · {a['formato']} · CPA {cpa} · compra/visita {cv} · {a['lectura']} |")
    grid = Table([[c[0] for c in cells], [c[1] for c in cells]], colWidths=[WIDTH / 4] * 4)
    grid.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (0, 0), (-1, 0), 'CENTER')]))
    research = [f"{r['hallazgo']} <font color='#5f5f5f' size='8'>({escape(r['fuente'])})</font>" for r in CFG['investigacion']]
    pdf = [grid, Spacer(1, 6),
           side([Paragraph('<b>Reglas que salen de la cuenta</b>', ST['p'])] + bullets(CFG['aprendizajes_cuenta']['reglas']),
                [Paragraph('<b>Lo que dice la investigación</b>', ST['p'])] + [Paragraph('<font color="#c8102e">■</font>&nbsp;&nbsp;' + r, ST['p']) for r in research], 0.5)]
    md = [f"Anuncios del {CFG['aprendizajes_cuenta']['periodo']}:", '', '| Anuncio | Lectura |', '|---|---|'] + md_rows + \
         ['', '**Reglas que salen de la cuenta**', ''] + [f"- {x}" for x in CFG['aprendizajes_cuenta']['reglas']] + \
         ['', '**Lo que dice la investigación**', ''] + [f"- {r['hallazgo']} ([{r['fuente']}]({r['url']}))" for r in CFG['investigacion']] + ['']
    pages.append(('APRENDIZAJES', 'En nuestra cuenta venden los estáticos con precio y los carruseles', pdf, md))

    # 5. Matriz de creativos + maquetas
    m1, m2 = mockup('E1'), mockup('E2')
    head = ['Clave', 'Segmento', 'Formato', 'Pack', 'Concepto', 'Gancho']
    rows = [[m['clave'], m['segmento'], m['formato'], PACK_CFG[m['pack']]['nombre'], m['concepto'], m['gancho']] for m in CFG['matriz_creativa']]
    budget = ' · '.join(f"{b['bloque']} {k(b['diaria'])}/día" for b in CFG['pauta']['estructura'])
    pdf = [side([table(head, rows, [0.08, 0.13, 0.17, 0.16, 0.26, 0.20], WIDTH * 0.62), Spacer(1, 5),
                 Paragraph(f"<b>Pauta:</b> {escape(budget)}.", ST['small']), Spacer(1, 3)] + bullets(CFG['especificaciones'], 'small'),
                [Table([[img(m1, WIDTH * 0.18), img(m2, WIDTH * 0.18)],
                        [Paragraph('<b>E1</b> · Trío con precio grande', ST['small']), Paragraph('<b>E2</b> · Escalera 3 o 4', ST['small'])]])], 0.63)]
    md = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(r) + ' |' for r in rows] + \
         ['', f"**Pauta:** {budget}.", '', '| E1 | E2 |', '|---|---|', '| ![E1](img/maqueta-E1.png) | ![E2](img/maqueta-E2.png) |', ''] + \
         [f"- {x}" for x in CFG['especificaciones']] + ['']
    pages.append(('CREATIVOS', '8 creativos: 6 de prospección y 2 de retargeting', pdf, md))

    # 6. Storyboards
    pdf, md = [], []
    videos = [m for m in CFG['matriz_creativa'] if m.get('guion')]
    rowsb = []
    for m in videos:
        sb = storyboard(m['clave'])
        steps = ''.join(f"<br/><b>{escape(t)}</b> {escape(a)}" for t, a in m['guion'])
        tomas = ' · '.join(escape(t) for t in m['tomas'])
        rowsb.append([img(sb, WIDTH * 0.42, 50 * mm),
                      Paragraph(f"<b>{m['clave']} · {escape(m['concepto'])}</b> <font color='#5f5f5f'>({escape(m['formato'])})</font>{steps}"
                                f"<br/><font color='#5f5f5f'><b>Tomas:</b> {tomas}</font>", ST['cell'])])
        md += [f"### {m['clave']} · {m['concepto']} ({m['formato']})", '', f"![Storyboard {m['clave']}](img/storyboard-{m['clave']}.png)", '',
               '| Tiempo | Qué pasa |', '|---|---|'] + [f"| {t} | {a} |" for t, a in m['guion']] + ['', 'Tomas: ' + '; '.join(m['tomas']) + '.', '']
    grid = Table(rowsb, colWidths=[WIDTH * 0.36, WIDTH * 0.64])
    grid.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 2),
                              ('LINEBELOW', (0, 0), (-1, -2), 0.3, C_RULE), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
    pdf = [grid, Spacer(1, 4), Paragraph('Las franjas oscuras marcan las zonas libres de texto en 9:16 (el 14 % de arriba y el 35 % de abajo). La oferta aparece en el segundo 0–1.', ST['small'])]
    pages.append(('GUIONES DE VIDEO', 'La oferta en el primer segundo; el producto, cerca de la cámara', pdf, md))

    # 7. Calendario
    cal = img_timeline()
    mails = [[c['fecha'], c['asunto']] for c in CFG['correos']]
    pdf = [img(cal, WIDTH), Spacer(1, 6),
           side([Paragraph('<b>Correos (los envía el dueño)</b>', ST['p']), table(['Fecha', 'Asunto'], mails, [0.25, 0.75], WIDTH * 0.45)],
                [Paragraph('<b>Rotación de creativos</b>', ST['p'])] + bullets(CFG['reglas_rotacion']), 0.48)]
    md = ['![Calendario](img/calendario.png)', '', '| Fase | Fechas | Qué pasa |', '|---|---|---|'] + \
         [f"| {f['fase']} | {f['inicio'][5:]} → {f['fin'][5:]} | {f['detalle']} |" for f in CFG['fases']] + \
         ['', '| Correo | Asunto |', '|---|---|'] + [f"| {a} | {b} |" for a, b in mails] + ['', '**Rotación:**', ''] + [f"- {x}" for x in CFG['reglas_rotacion']] + ['']
    pages.append(('CALENDARIO', 'Reabastecer antes del 10-nov, lanzar el 20 y cerrar en Black Friday', pdf, md))

    # 8. Reabastecimiento, metas y reglas
    rest = [[r['base'], str(r['stock']), str(r['comprar']), ', '.join(f"{s} {n}" for s, n in r['tallas'].items() if n)]
            for r in sorted(DATA['restock'], key=lambda r: -r['comprar']) if r['comprar'] > 0]
    metas = [('Pedidos', f"{CFG['demanda']['pedidos_semana']}"), ('Pedidos en pack', f"{round(CFG['demanda']['pedidos_semana'] * CFG['demanda']['participacion_packs'])}"),
             ('Utilidad después de pauta', mill(esc['utilidad'])), ('CPA real', f"≤ {k(CFG['pauta']['cpa_real_max'])}")]
    risks = CFG['riesgos'] + ([f"Revisión del copy: {', '.join(copy_issues)}"] if copy_issues else [])
    pdf = [side([Paragraph('<b>Comprar antes del 10 de noviembre</b>', ST['p']), table(['Prenda base', 'Stock', 'Comprar', 'Por talla'], rest, [0.5, 0.12, 0.13, 0.25], WIDTH * 0.5),
                 Spacer(1, 8), Paragraph('<b>Metas de la semana</b>', ST['p']), table(['Indicador', 'Meta'], metas, [0.6, 0.4], WIDTH * 0.5)],
                [Paragraph('<b>Reglas de Meta</b>', ST['p'])] + bullets(CFG['reglas_meta'], 'small') + [Spacer(1, 6), Paragraph('<b>Riesgos y pendientes</b>', ST['p'])] + bullets(risks, 'small') +
                [Spacer(1, 6), Paragraph('<b>Página de packs (se implementa después)</b>', ST['p'])] + bullets(CFG['web'], 'small'), 0.52)]
    md = ['**Comprar antes del 10 de noviembre**', '', '| Prenda base | Stock | Comprar | Por talla |', '|---|---|---|---|'] + ['| ' + ' | '.join(r) + ' |' for r in rest] + \
         ['', '| Meta | Valor |', '|---|---|'] + [f"| {a} | {b} |" for a, b in metas] + \
         ['', '**Reglas de Meta**', ''] + [f"- {x}" for x in CFG['reglas_meta']] + ['', '**Riesgos y pendientes**', ''] + [f"- {x}" for x in risks] + \
         ['', '**Página de packs (se implementa después)**', ''] + [f"- {x}" for x in CFG['web']] + ['']
    pages.append(('OPERACIÓN', 'Reabastecimiento, metas y reglas', pdf, md))

    # 9. Textos listos
    head = ['Clave', 'Título', 'Texto en la imagen', 'Copy', 'Destino']
    rows = [[m['clave'], m['titulo'], m['texto_pantalla'], m['copy'], m['destino']] for m in CFG['matriz_creativa']]
    pdf = [table(head, rows, [0.05, 0.13, 0.24, 0.37, 0.21]), Spacer(1, 4),
           Paragraph(f"CTA de todos: «Comprar». Cifras generadas el {DATA['generado'][:10]} con scripts/analytics/black-week.cjs; documento con scripts/marketing/black-week-doc.py.", ST['small'])]
    md = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(x.replace('|', '/') for x in r) + ' |' for r in rows] + \
         ['', f"_CTA de todos: «Comprar». Cifras del {DATA['generado'][:10]} (`scripts/analytics/black-week.cjs`); documento generado con `scripts/marketing/black-week-doc.py`._", '']
    pages.append(('TEXTOS', 'Copys listos para usar', pdf, md))
    return pages


def write(pages):
    story = []
    for i, (kicker, title, flow, _) in enumerate(pages):
        if i:
            story.append(PageBreak())
        if title:
            story += [Paragraph(kicker, ST['kicker']), Paragraph(escape(title), ST['title'])]
        story += flow

    def frame(c, doc):
        c.saveState()
        c.setFillColor(C_ACCENT)
        c.rect(0, PAGE[1] - 4 * mm, PAGE[0], 4 * mm, stroke=0, fill=1)
        c.setFont('Arial', 7.5)
        c.setFillColor(C_MUTED)
        c.drawString(MARGIN, 7 * mm, 'Beast Club · Black Week Beast 2026 · uso interno')
        c.drawRightString(PAGE[0] - MARGIN, 7 * mm, str(doc.page))
        c.restoreState()

    pdf_path = os.path.join(DOC_DIR, f"{OUT_NAME}.pdf")
    SimpleDocTemplate(pdf_path, pagesize=PAGE, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=11 * mm, bottomMargin=11 * mm,
                      title='Black Week Beast 2026', author='Beast Club').build(story, onFirstPage=frame, onLaterPages=frame)
    md = []
    for kicker, title, _, lines in pages:
        if title:
            md += [f"## {title}", '']
        md += lines
    md_path = os.path.join(DOC_DIR, f"{OUT_NAME}.md")
    with open(md_path, 'w', encoding='utf8', newline='\n') as f:
        f.write('\n'.join(md))
    return md_path, pdf_path


if __name__ == '__main__':
    for p in write(build()):
        print(p)
    if copy_issues:
        print('REVISAR COPY:', copy_issues)
    print(f"Generado {datetime.now():%Y-%m-%d %H:%M}")
