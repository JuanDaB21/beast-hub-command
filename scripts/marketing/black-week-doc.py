"""Genera el plan de Black Week en Markdown y PDF.

Uso: node scripts/analytics/black-week.cjs  (actualiza las cifras)
     python scripts/marketing/black-week-doc.py

Lee docs/marketing/black-week-2026/config.json y scripts/analytics/.out/black-week.json.
Escribe PLAN_BLACK_WEEK_BEAST_2026.md y .pdf en docs/marketing/black-week-2026/.
"""
import json
import os
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (CondPageBreak, KeepTogether, ListFlowable, ListItem, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOC_DIR = os.path.join(ROOT, 'docs', 'marketing', 'black-week-2026')
CFG = json.load(open(os.path.join(DOC_DIR, 'config.json'), encoding='utf8'))
DATA = json.load(open(os.path.join(ROOT, 'scripts', 'analytics', '.out', 'black-week.json'), encoding='utf8'))
OUT_NAME = 'PLAN_BLACK_WEEK_BEAST_2026'


def cop(n):
    return f"{round(n):,}".replace(',', '.')


def k(n):
    return f"{n / 1000:.1f}k".replace('.', ',')


def pct(x):
    return f"{x * 100:.0f} %"


# ---------- Contenido (bloques neutros: se renderizan a MD y a PDF) ----------
def build():
    b = []
    p0, p1 = CFG['periodo']['inicio'], CFG['periodo']['fin']
    packs = DATA['packs']
    by_pack = {}
    for x in packs:
        by_pack.setdefault(x['pack'], []).append(x)
    kp = CFG['kpis']
    pa = CFG['pauta']

    b.append(('title', 'Black Week Beast 2026',
              f"Plan de ofertas, creativos y página · del 13 al 20 de noviembre · documento interno, cifras al {DATA['generado'][:10]}"))

    b.append(('h1', '1. Resumen'))
    b.append(('ul', [
        'La campaña ofrece **packs de 3 prendas con envío gratis** en lugar de un descuento general. Las prendas sueltas y los pedidos de 2 prendas mantienen su precio.',
        'Tres packs: **TRÍO BEAST** (3 oversized, 169.900), **PACK TRAINING** (compresión + tank + oversized, 199.900) y **OUTFIT BEAST** (2 camisetas + short, 179.900).',
        'Cada pack combina los diseños más vendidos con colores y prendas base que hoy rotan poco. Dos complementos liquidan stock estancado: ACID GRIS a 39.900 y buzo compresión a 59.900.',
        f"Pauta de {cop(pa['diaria_black_week'])} COP/día (hoy {cop(pa['diaria_actual'])}). Todos los anuncios llevan a una página única de packs.",
        f"Meta de la semana: {kp['pedidos']} pedidos ({kp['packs']} en pack), {kp['prendas']} prendas y {cop(kp['contribucion_neta_pauta'])} de contribución después de pauta.",
    ]))

    b.append(('h1', '2. Por qué estos packs'))
    b.append(('ul', CFG['hallazgos']))
    b.append(('h2', 'Prendas base: stock y rotación'))
    rows = []
    for r in sorted(DATA['restock'], key=lambda r: -(r['cobertura_semanas'] or 999)):
        cob = '—' if r['cobertura_semanas'] is None else f"{r['cobertura_semanas']:.1f}".replace('.', ',')
        estado = 'Estancada' if (r['cobertura_semanas'] is None or r['cobertura_semanas'] > 8) else (
            'Crítica' if r['cobertura_semanas'] < 2 else 'Normal')
        rows.append([r['base'], str(r['stock']), str(r['u30']), cob, estado])
    b.append(('table', ['Prenda base', 'Stock', 'Vendidas 30 d', 'Cobertura (sem.)', 'Estado'], rows, [0.46, 0.1, 0.14, 0.15, 0.15]))

    b.append(('h1', '3. La oferta'))
    b.append(('p', 'El ahorro se calcula sobre el **precio vigente** de cada prenda más el flete que el cliente ya no paga (19.000). '
                   'No se usa el precio tachado como «antes»: la SIC exige que el precio anterior sea el que se cobraba de verdad. '
                   'La contribución es lo que le queda a la empresa después del costo de las prendas, las comisiones y el flete, antes de la pauta.'))
    rows = []
    for x in packs:
        comp = ' + '.join(f"{c['title'] or c['producto']} ({c['color']})" for c in x['componentes'])
        rows.append([x['version_nombre'], comp, cop(x['regular']), cop(x['precio']),
                     f"{cop(x['ahorro'])} ({pct(x['ahorro_pct'])})", cop(round(x['contribucion'], -2))])
    b.append(('table', ['Pack', 'Prendas', 'Regular', 'Pack', 'Ahorro cliente', 'Contribución'], rows, [0.13, 0.39, 0.1, 0.1, 0.15, 0.13]))
    b.append(('p', 'Referencia: el pedido promedio de hoy deja unos 58.000 de contribución con 2,1 prendas y el cliente paga el envío. '
                   'Cada pack deja una cifra cercana con 3 prendas y envío gratis, y la diferencia la cubren los pedidos nuevos de la semana.'))

    b.append(('pagebreak',))
    b.append(('h1', '4. Brief de creativos por pack'))
    b.append(('p', 'Cada ficha dice qué prendas salen en el creativo, el gancho, el texto sobre la imagen, el copy y las piezas a producir. '
                   'Los textos no nombran marcas de terceros; el pack se nombra con su nombre Beast.'))
    for p in CFG['packs']:
        cr = p['creativos']
        vers = by_pack.get(p['id'], [])
        b.append(('h2', f"{p['nombre']} · {cop(p['precio'])} · envío gratis"))
        b.append(('p', f"**Rol:** {p['rol']}"))
        for v in vers:
            items = [f"{c['title'] or c['producto']} — {c['color']}" for c in v['componentes']]
            b.append(('p', f"**{v['version_nombre']}** (ahorro {cop(v['ahorro'])}, regular {cop(v['regular'])}):"))
            b.append(('ul', items))
        b.append(('kv', [
            ('Ganchos', ' / '.join(f"«{g}»" for g in cr['ganchos'])),
            ('Texto en imagen', cr['texto_imagen']),
            ('Copy principal', cr['copy']),
            ('CTA', cr['cta']),
            ('Destino', f"/pages/black-week-beast#{p['id']}"),
        ]))
        b.append(('table', ['Formato', 'Qué mostrar'], [[x['formato'], x['brief']] for x in cr['piezas']], [0.22, 0.78]))

    b.append(('h2', 'Complementos de liquidación'))
    b.append(('p', 'Se muestran en la página de packs, en stories y en retargeting; no llevan pauta propia de prospección.'))
    b.append(('table', ['Producto', 'Precio hoy', 'Black Week', 'Por qué'],
              [[c['nombre'], cop(c['precio_actual']), cop(c['precio_black_week']), c['nota']] for c in CFG['complementos']],
              [0.28, 0.12, 0.12, 0.48]))

    b.append(('h2', 'Reglas para todos los anuncios'))
    b.append(('ul', CFG['reglas_meta']))

    b.append(('h1', '5. Pauta'))
    b.append(('ul', CFG['pauta']['estructura'] + [
        f"CPA real máximo: {cop(pa['cpa_real_max'])} por pedido (último clic, gasto Meta × {str(pa['factor_impuestos']).replace('.', ',')}). "
        'Con ese tope cada pack deja más de 18.000 después de pauta.',
    ]))

    b.append(('h1', '6. Estrategia en la web (para implementar después)'))
    b.append(('ul', CFG['web']))

    b.append(('pagebreak',))
    b.append(('h1', '7. Calendario'))
    b.append(('table', ['Fecha', 'Hito'], [[c['fecha'], c['hito']] for c in CFG['calendario']], [0.18, 0.82]))
    b.append(('h2', 'Orgánico'))
    b.append(('table', ['Fecha', 'Pieza'], [[c['fecha'], c['pieza']] for c in CFG['organico']], [0.18, 0.82]))
    b.append(('h2', 'Correos (Shopify Email, los envía el dueño)'))
    b.append(('table', ['Fecha', 'Asunto', 'Contenido'], [[c['fecha'], c['asunto'], c['contenido']] for c in CFG['correos']], [0.14, 0.4, 0.46]))

    d = CFG['demanda']
    b.append(('h1', '8. Reabastecimiento (pedir a más tardar el 3 o 4 de noviembre)'))
    b.append(('p', f"Supuesto: {d['pedidos_semana']} pedidos en la semana, {pct(d['participacion_packs'])} en pack, "
                   f"{str(d['prendas_por_pedido_sin_pack']).replace('.', ',')} prendas por pedido sin pack, "
                   f"{d['semanas_de_seguridad']} semana de seguridad y mínimo {d['minimo_por_talla']} unidades por talla en las bases de los packs. "
                   'La curva de tallas sale de las ventas de 90 días.'))
    rows = [[r['base'], str(r['stock']), str(r['demanda_semana']), str(r['comprar']),
             ', '.join(f"{s} {n}" for s, n in r['tallas'].items() if n)]
            for r in sorted(DATA['restock'], key=lambda r: -r['comprar']) if r['comprar'] > 0]
    b.append(('table', ['Prenda base', 'Stock', 'Necesidad', 'Comprar', 'Por talla'], rows, [0.42, 0.1, 0.12, 0.1, 0.26]))

    b.append(('h1', '9. Metas'))
    b.append(('table', ['Indicador', 'Meta', 'Referencia'], [
        ['Pedidos en la semana', str(kp['pedidos']), '~20 por semana hoy'],
        ['Pedidos en pack', str(kp['packs']), '—'],
        ['Prendas vendidas', str(kp['prendas']), '~45 por semana hoy'],
        ['Contribución después de pauta', cop(kp['contribucion_neta_pauta']), '~950.000 por semana hoy'],
        ['ACID GRIS vendidas', str(kp['acid_gris_vendidas']), '2 en 30 días'],
        ['Tank acid vendidos', str(kp['tank_acid_vendidos']), '18 en 30 días'],
        ['CPA real', f"≤ {cop(kp['cpa_real_max'])}", '~25.000 en octubre'],
    ], [0.4, 0.25, 0.35]))

    b.append(('h1', '10. Riesgos y pendientes'))
    b.append(('ul', CFG['riesgos'] + [f"Aviso del generador: {a}" for a in DATA.get('avisos', [])]))

    b.append(('h1', 'Anexo: cómo se calcularon las cifras'))
    b.append(('ul', [
        'Fuentes: base de datos de producción de Beast Hub (solo lectura, 90 días), precios vigentes de Shopify y sesiones por ficha.',
        'Costo de cada prenda: BOM (prenda base + tinta) + impresión por metro + procesos, igual que el panel de rentabilidad.',
        f"Comisiones: Shopify {pct(0.02)} sobre todo pedido; pasarela 3 % + 900 en la parte prepagada ({pct(DATA['participacion_prepago'])} de los pedidos).",
        'Contribución del pack = precio − costo de las 3 prendas − comisiones − flete de 19.000.',
        'Generadores: scripts/analytics/black-week.cjs (cifras) y scripts/marketing/black-week-doc.py (este documento). '
        'Los supuestos se cambian en docs/marketing/black-week-2026/config.json.',
    ]))
    return b


# ---------- Markdown ----------
def to_md(blocks):
    out = []
    for blk in blocks:
        t = blk[0]
        if t == 'title':
            out += [f"# {blk[1]}", '', f"_{blk[2]}_", '']
        elif t == 'h1':
            out += [f"## {blk[1]}", '']
        elif t == 'h2':
            out += [f"### {blk[1]}", '']
        elif t == 'p':
            out += [blk[1], '']
        elif t == 'ul':
            out += [f"- {x}" for x in blk[1]] + ['']
        elif t == 'kv':
            out += [f"- **{a}:** {v}" for a, v in blk[1]] + ['']
        elif t == 'table':
            h, rows = blk[1], blk[2]
            out += ['| ' + ' | '.join(h) + ' |', '|' + '|'.join('---' for _ in h) + '|']
            out += ['| ' + ' | '.join(str(c).replace('|', '/') for c in r) + ' |' for r in rows] + ['']
    return '\n'.join(out)


# ---------- PDF ----------
FONT_DIR = 'C:/Windows/Fonts'
pdfmetrics.registerFont(TTFont('Arial', os.path.join(FONT_DIR, 'arial.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Bold', os.path.join(FONT_DIR, 'arialbd.ttf')))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial', boldItalic='Arial-Bold')

INK = colors.HexColor('#111111')
MUTED = colors.HexColor('#5f5f5f')
ACCENT = colors.HexColor('#c8102e')
RULE = colors.HexColor('#d9d9d9')
ZEBRA = colors.HexColor('#f4f4f4')

ST = {
    'title': ParagraphStyle('title', fontName='Arial-Bold', fontSize=26, leading=30, textColor=INK, spaceAfter=6),
    'subtitle': ParagraphStyle('subtitle', fontName='Arial', fontSize=10.5, leading=14, textColor=MUTED, spaceAfter=14),
    'h1': ParagraphStyle('h1', fontName='Arial-Bold', fontSize=15, leading=19, textColor=INK, spaceBefore=12, spaceAfter=6),
    'h2': ParagraphStyle('h2', fontName='Arial-Bold', fontSize=11.5, leading=15, textColor=ACCENT, spaceBefore=9, spaceAfter=4),
    'p': ParagraphStyle('p', fontName='Arial', fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=5, alignment=TA_LEFT),
    'cell': ParagraphStyle('cell', fontName='Arial', fontSize=8.3, leading=10.8, textColor=INK),
    'head': ParagraphStyle('head', fontName='Arial-Bold', fontSize=8.3, leading=10.8, textColor=colors.white),
}


def rich(text):
    """**negrita** → <b>; escapa el resto para Paragraph."""
    parts = escape(text).split('**')
    return ''.join(f"<b>{s}</b>" if i % 2 else s for i, s in enumerate(parts))


def to_pdf(blocks, path):
    width = A4[0] - 36 * mm
    story = []
    for blk in blocks:
        t = blk[0]
        if t == 'title':
            story += [Spacer(1, 4 * mm), Paragraph(rich(blk[1]), ST['title']), Paragraph(rich(blk[2]), ST['subtitle'])]
        elif t in ('h1', 'h2', 'p'):
            # Evita títulos huérfanos al pie de página.
            if t != 'p':
                story.append(CondPageBreak((45 if t == "h1" else 55) * mm))
            story.append(Paragraph(rich(blk[1]), ST[t]))
        elif t == 'pagebreak':
            story.append(PageBreak())
        elif t == 'ul':
            story.append(ListFlowable([ListItem(Paragraph(rich(x), ST['p']), leftIndent=10) for x in blk[1]],
                                      bulletType='bullet', bulletFontName='Arial', bulletFontSize=7, leftIndent=10,
                                      bulletColor=ACCENT, start='•'))
        elif t == 'kv':
            data = [[Paragraph(f"<b>{escape(a)}</b>", ST['cell']), Paragraph(rich(v), ST['cell'])] for a, v in blk[1]]
            tb = Table(data, colWidths=[width * 0.2, width * 0.8])
            tb.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), 0.4, RULE),
                                    ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
            story += [tb, Spacer(1, 4)]
        elif t == 'table':
            h, rows, ratios = blk[1], blk[2], blk[3]
            data = [[Paragraph(escape(x), ST['head']) for x in h]] + [[Paragraph(rich(str(c)), ST['cell']) for c in r] for r in rows]
            tb = Table(data, colWidths=[width * r for r in ratios], repeatRows=1)
            style = [('BACKGROUND', (0, 0), (-1, 0), INK), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                     ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                     ('LINEBELOW', (0, 1), (-1, -1), 0.3, RULE)]
            style += [('BACKGROUND', (0, i), (-1, i), ZEBRA) for i in range(2, len(data), 2)]
            tb.setStyle(TableStyle(style))
            story += [KeepTogether([tb]) if len(rows) <= 8 else tb, Spacer(1, 6)]

    def frame(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(ACCENT)
        canvas.rect(0, A4[1] - 5 * mm, A4[0], 5 * mm, stroke=0, fill=1)
        canvas.setFont('Arial', 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 10 * mm, 'Beast Club · Black Week Beast 2026 · uso interno')
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Página {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=17 * mm, title='Black Week Beast 2026', author='Beast Club')
    doc.build(story, onFirstPage=frame, onLaterPages=frame)


if __name__ == '__main__':
    blocks = build()
    md_path = os.path.join(DOC_DIR, f"{OUT_NAME}.md")
    pdf_path = os.path.join(DOC_DIR, f"{OUT_NAME}.pdf")
    with open(md_path, 'w', encoding='utf8', newline='\n') as f:
        f.write(to_md(blocks))
    to_pdf(blocks, pdf_path)
    print(md_path)
    print(pdf_path)
    print(f"Generado {datetime.now():%Y-%m-%d %H:%M}")
