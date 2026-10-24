"""Renderiza texto prefabricado (cadenas ya hechas) con la fuente real del juego (Merriweather Black).

Cada cadena se convierte en una imagen PNG a resolucion 2 (supermuestreada x3 y reducida) lista para usarse como
disfraz de un sprite o de sus clones; asi el texto se dibuja a la resolucion de la pantalla y no se pixela."""
import hashlib
import io
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = os.path.join(HERE, "assets", "merriweather-black.ttf")
SS = 3          # supermuestreo
RES = 2         # bitmapResolution de los disfraces
_fonts = {}


def _font(px):
    if px not in _fonts:
        _fonts[px] = ImageFont.truetype(FONT_PATH, px)
    return _fonts[px]


def render(text, units, color=(255, 255, 255), stroke=0.7, anchor="mid", align="left", gap=1.3, pad=1.4):
    """Devuelve (imagen RGBA, avance en unidades de la linea mas ancha, (cx, cy) centro de rotacion en px)."""
    lines = text.split("\n") if isinstance(text, str) else list(text)
    px = max(4, round(units * RES * SS))
    f = _font(px)
    asc, desc = f.getmetrics()
    lh = round((asc + desc) * gap) if len(lines) > 1 else asc + desc
    sw = round(stroke * RES * SS)
    padp = round(pad * RES * SS) + sw
    adv = [f.getlength(l) for l in lines]
    w = int(max(adv + [1])) + 2 * padp
    h = lh * (len(lines) - 1) + asc + desc + 2 * padp
    w += (-w) % SS
    h += (-h) % SS
    big = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    for i, l in enumerate(lines):
        x = padp
        if align == "center":
            x = padp + (max(adv) - adv[i]) / 2
        d.text((x, padp + i * lh), l, font=f, fill=color + (255,), stroke_width=sw, stroke_fill=(0, 0, 0, 215))
    im = big.resize((w // SS, h // SS), Image.LANCZOS)
    if anchor == "mid":
        c = (padp / SS, h / SS / 2)
    elif anchor == "top":
        c = (padp / SS, padp / SS)
    else:                                   # centro de la imagen
        c = (im.width / 2, im.height / 2)
    return im, max(adv) / (RES * SS), c


CACHE = os.path.join(HERE, ".cache")


def cached(keyparts, fn, quantize=40):
    """Renderiza una vez y guarda (PNG cuantizado, avance, centro) en disco: el generador es mucho mas rapido."""
    h = hashlib.md5(json.dumps(keyparts, sort_keys=True, default=str).encode()).hexdigest()
    p = os.path.join(CACHE, h + ".png")
    if os.path.exists(p) and os.path.exists(p + ".json"):
        adv, c = json.load(open(p + ".json"))
        return open(p, "rb").read(), adv, tuple(c)
    im, adv, c = fn()
    q = im.quantize(colors=quantize, method=Image.FASTOCTREE)
    b = io.BytesIO()
    q.save(b, "PNG", optimize=True)
    os.makedirs(CACHE, exist_ok=True)
    open(p, "wb").write(b.getvalue())
    json.dump([adv, list(c)], open(p + ".json", "w"))
    return b.getvalue(), adv, tuple(c)


def wrap_px(text, units, max_units, max_lines=3):
    """Parte el texto en lineas que no superen max_units (midiendo con la fuente real)."""
    f = _font(max(4, round(units * RES * SS)))
    limit = max_units * RES * SS
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w) if cur else w
        if f.getlength(trial) > limit and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while f.getlength(lines[-1] + "..") > limit and len(lines[-1]) > 3:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + ".."
    return lines


if __name__ == "__main__":
    import io
    im, adv, c = render("Carpal tunnel prevention cream", 11)
    b = io.BytesIO(); im.save(b, "PNG", optimize=True)
    print(im.size, round(adv, 1), c, len(b.getvalue()))
    q = im.quantize(colors=48, method=Image.FASTOCTREE)
    b2 = io.BytesIO(); q.save(b2, "PNG", optimize=True); print('quantized', len(b2.getvalue()))
    big, a2, c2 = render("The mouse and cursors are twice as efficient.\nSecond line of the description text here.\nThird", 8.8, anchor="top")
    b = io.BytesIO(); big.save(b, "PNG", optimize=True); print(big.size, len(b.getvalue()))
    big.save('/tmp/claude-0/sample_text.png'); im.save('/tmp/claude-0/sample_text2.png')
