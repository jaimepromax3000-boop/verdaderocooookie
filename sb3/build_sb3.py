#!/usr/bin/env python3
"""Genera CookieClicker.sb3 (proyecto de Scratch 3) a partir de los recursos del repositorio.

Uso:  python3 sb3/build_sb3.py
Salida: sb3/CookieClicker.sb3

Los edificios, iconos, precios base, produccion base (CpS), la progresion de precio x1.15,
las galletas doradas (Frenzy x7 durante 77 s y Lucky) y los sonidos salen del juego original.
Todo el texto se dibuja con el lapiz (pen) estampando un disfraz por letra, porque Scratch no
tiene texto dinamico en el escenario.
"""
import hashlib
import json
import math
import os
import subprocess
import tempfile
import zipfile

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
IMG = os.path.join(REPO, "img")
SND = os.path.join(REPO, "snd")
OUT = os.path.join(HERE, "CookieClicker.sb3")

# --------------------------------------------------------------------------------------
# Datos del juego (main.js: Game.Object)
# --------------------------------------------------------------------------------------
BUILDINGS = [  # (nombre, columna del icono en icons.png)
    ("Cursor", 0), ("Grandma", 1), ("Farm", 2), ("Mine", 3), ("Factory", 4), ("Bank", 15),
    ("Temple", 16), ("Wizard tower", 17), ("Shipment", 5), ("Alchemy lab", 6), ("Portal", 7),
    ("Time machine", 8), ("Antimatter condenser", 13), ("Prism", 14), ("Chancemaker", 19),
    ("Fractal engine", 20), ("Javascript console", 32), ("Idleverse", 33), ("Cortex baker", 34),
    ("You", 35),
]
N = len(BUILDINGS)
VISIBLE_ROWS = 7
MAX_OFFSET = N - VISIBLE_ROWS
SUFFIXES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion",
            "sextillion", "septillion", "octillion", "nonillion", "decillion"]


def js_round(x):
    return math.floor(x + 0.5)


def building_stats(n):
    """Port de Game.Object: precio base y CpS base del edificio n."""
    if n == 0:
        return 15, 0.1
    cps = math.ceil((n ** (n * 0.5 + 2)) * 10) / 10
    digits = 10 ** math.ceil(math.log(math.ceil(cps)) / math.log(10)) / 100
    cps = js_round(cps / digits) * digits
    price = (n + 9 + (0 if n < 5 else (n - 5) ** 1.75 * 5)) * 10 ** n * max(1, n - 14)
    digits = 10 ** math.ceil(math.log(math.ceil(price)) / math.log(10)) / 100
    price = js_round(price / digits) * digits
    if n >= 16:
        price *= 10
    if n >= 17:
        price *= 10
    if n >= 18:
        price *= 10
    if n >= 19:
        price *= 20
    return price, cps


def clean(x):
    x = float(x)
    return int(x) if x == int(x) and abs(x) < 1e15 else float(repr(x))


STATS = [building_stats(i) for i in range(N)]
PRICES = [clean(p) for p, _ in STATS]
CPS = [round(c, 10) if c < 1e15 else c for _, c in STATS]
CPS = [clean(c) if c == int(c) else c for c in CPS]
LN_PRICE_INC = math.log(1.15)  # Game.priceIncrease = 1.15

# --------------------------------------------------------------------------------------
# Recursos graficos y de sonido
# --------------------------------------------------------------------------------------
ASSETS = {}  # md5ext -> bytes


def add_asset(data, ext):
    md5 = hashlib.md5(data).hexdigest()
    ASSETS[f"{md5}.{ext}"] = data
    return md5


def png_bytes(im):
    import io
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    return b.getvalue()


def costume(name, im, res=2, center=None):
    md5 = add_asset(png_bytes(im), "png")
    cx, cy = center if center else (im.width / 2, im.height / 2)
    return {"name": name, "bitmapResolution": res, "dataFormat": "png", "assetId": md5,
            "md5ext": f"{md5}.png", "rotationCenterX": cx, "rotationCenterY": cy}


def sound(name, path):
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "s.wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ar", "22050", "-ac", "1",
                        "-c:a", "pcm_s16le", wav], check=True)
        data = open(wav, "rb").read()
    import wave, io
    with wave.open(io.BytesIO(data)) as w:
        frames, rate = w.getnframes(), w.getframerate()
    md5 = add_asset(data, "wav")
    return {"name": name, "assetId": md5, "dataFormat": "wav", "rate": rate, "sampleCount": frames,
            "md5ext": f"{md5}.wav"}


FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
GLYPH_W, GLYPH_H = 24, 40  # px a resolucion 2 -> 12 x 20 unidades de escenario


def glyph_image(ch):
    im = Image.new("RGBA", (GLYPH_W, GLYPH_H), (0, 0, 0, 0))
    if ch != " ":
        d = ImageDraw.Draw(im)
        f = ImageFont.truetype(FONT_PATH, 36)
        d.text((GLYPH_W / 2, GLYPH_H / 2), ch, font=f, anchor="mm", fill=(255, 255, 255, 255),
               stroke_width=3, stroke_fill=(35, 18, 8, 255))
    return im


def tile_image(on):
    w, h = 184 * 2, 44 * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    base = (58, 44, 38, 235) if on else (22, 17, 15, 235)
    d.rounded_rectangle((0, 0, w - 1, h - 1), 8, fill=base, outline=(0, 0, 0, 255), width=3)
    d.line((8, 5, w - 9, 5), fill=(255, 255, 255, 60 if on else 18), width=2)
    return im


def arrow_image(up):
    im = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(20, 6), (36, 32), (4, 32)] if up else [(20, 34), (36, 8), (4, 8)]
    d.polygon(pts, fill=(255, 255, 255, 255), outline=(35, 18, 8, 255))
    d.line(pts + [pts[0]], fill=(35, 18, 8, 255), width=3)
    return im


def make_backdrop():
    bg = Image.open(os.path.join(IMG, "bgBlue.jpg")).convert("RGBA")
    W, H = 960, 720
    im = Image.new("RGBA", (W, H))
    for x in range(0, W, bg.width):
        for y in range(0, H, bg.height):
            im.paste(bg, (x, y))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(shade)
    d.rectangle((586, 0, W, H), fill=(0, 0, 0, 150))
    d.rectangle((582, 0, 590, H), fill=(0, 0, 0, 230))
    for i in range(60):  # degradado oscuro arriba y abajo en la zona del contador
        d.rectangle((0, i, 586, i), fill=(0, 0, 0, int(110 * (1 - i / 60))))
    im.alpha_composite(shade)
    return im


def plus_image():
    im = Image.new("RGBA", (72, 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT_PATH, 34)
    d.text((36, 22), "+1", font=f, anchor="mm", fill=(255, 255, 255, 255), stroke_width=3,
           stroke_fill=(35, 18, 8, 255))
    return im


# --------------------------------------------------------------------------------------
# Mini DSL para escribir bloques de Scratch 3
# --------------------------------------------------------------------------------------
class Rep(str):
    """Id de un bloque reportero/booleano."""


class Var:
    def __init__(self, name):
        self.name, self.id = name, "var_" + name


class Lst:
    def __init__(self, name):
        self.name, self.id = name, "lst_" + name


GLOBAL_VARS = {}
GLOBAL_LISTS = {}


def gv(name, initial=0):
    GLOBAL_VARS[name] = initial
    return Var(name)


def gl(name, items):
    GLOBAL_LISTS[name] = items
    return Lst(name)


def val(x, kind="n"):
    """Codifica un valor como entrada de bloque. kind: n (numero) o s (texto)."""
    code = 4 if kind == "n" else 10
    if isinstance(x, Rep):
        return [3, str(x), [code, "0" if kind == "n" else ""]]
    if isinstance(x, Var):
        return [3, [12, x.name, x.id], [code, "0" if kind == "n" else ""]]
    return [1, [code, str(x)]]


def bool_in(x):
    return [2, str(x)]


class Proc:
    def __init__(self, target, name, args, warp):
        self.t, self.name, self.args, self.warp = target, name, args, warp
        self.code = name + "".join(" %s" for _ in args)
        self.ids = [f"{name}_arg_{a}" for a in args]
        self.defn = None

    def mutation(self):
        return {"tagName": "mutation", "children": [], "proccode": self.code,
                "argumentids": json.dumps(self.ids), "argumentnames": json.dumps(self.args),
                "argumentdefaults": json.dumps([""] * len(self.args)),
                "warp": "true" if self.warp else "false"}

    def a(self, name):
        return Rep(self.t.blk("argument_reporter_string_number", fields={"VALUE": [name, None]}))

    def call(self, *vals):
        t = self.t
        mut = self.mutation()
        mut.pop("argumentnames")
        mut.pop("argumentdefaults")
        inputs = {i: val(v, "s") for i, v in zip(self.ids, vals)}
        return t.blk("procedures_call", inputs, mutation=mut)


class Target:
    def __init__(self, name, stage=False):
        self.name, self.stage = name, stage
        self.blocks = {}
        self.n = 0
        self.costumes, self.sounds = [], []
        self.pos = (0, 0)
        self.size = 100
        self.visible = True
        self.ybase = 0
        self.tops = 0

    # ---- bajo nivel
    def blk(self, op, inputs=None, fields=None, mutation=None, shadow=False):
        self.n += 1
        i = f"{self.name[:3].lower()}{self.n}"
        d = {"opcode": op, "next": None, "parent": None, "inputs": inputs or {},
             "fields": fields or {}, "shadow": shadow, "topLevel": False}
        if mutation:
            d["mutation"] = mutation
        self.blocks[i] = d
        return i

    def stack(self, *ids):
        ids = [i for i in ids if i is not None]
        for a, b in zip(ids, ids[1:]):
            self.blocks[a]["next"] = b
        return ids[0] if ids else None

    def hat(self, op, fields=None, inputs=None):
        i = self.blk(op, inputs, fields)
        b = self.blocks[i]
        b["topLevel"] = True
        b["x"], b["y"] = 20, 20 + 400 * self.tops
        self.tops += 1
        return i

    def script(self, hat, *body):
        first = self.stack(hat, *body)
        return first

    def defproc(self, name, args, warp=True):
        p = Proc(self, name, args, warp)
        p.defn_id = self.blk("procedures_definition")
        proto_inputs = {}
        for aid, an in zip(p.ids, p.args):
            r = self.blk("argument_reporter_string_number", fields={"VALUE": [an, None]}, shadow=True)
            proto_inputs[aid] = [1, r]
        proto = self.blk("procedures_prototype", proto_inputs, mutation=p.mutation(), shadow=True)
        d = self.blocks[p.defn_id]
        d["inputs"] = {"custom_block": [1, proto]}
        d["topLevel"] = True
        d["x"], d["y"] = 20, 20 + 400 * self.tops
        self.tops += 1
        return p

    def body(self, p, *ids):
        first = self.stack(*ids)
        self.blocks[p.defn_id]["next"] = first

    # ---- operadores
    def _op(self, opcode, k1, k2, a, b, kind="n"):
        return Rep(self.blk(opcode, {k1: val(a, kind), k2: val(b, kind)}))

    def add(self, a, b): return self._op("operator_add", "NUM1", "NUM2", a, b)
    def sub(self, a, b): return self._op("operator_subtract", "NUM1", "NUM2", a, b)
    def mul(self, a, b): return self._op("operator_multiply", "NUM1", "NUM2", a, b)
    def div(self, a, b): return self._op("operator_divide", "NUM1", "NUM2", a, b)
    def mod(self, a, b): return self._op("operator_mod", "NUM1", "NUM2", a, b)
    def lt(self, a, b): return self._op("operator_lt", "OPERAND1", "OPERAND2", a, b, "s")
    def gt(self, a, b): return self._op("operator_gt", "OPERAND1", "OPERAND2", a, b, "s")
    def eq(self, a, b): return self._op("operator_equals", "OPERAND1", "OPERAND2", a, b, "s")
    def join(self, a, b): return self._op("operator_join", "STRING1", "STRING2", a, b, "s")
    def rnd(self, a, b): return self._op("operator_random", "FROM", "TO", a, b)

    def and_(self, a, b):
        return Rep(self.blk("operator_and", {"OPERAND1": bool_in(a), "OPERAND2": bool_in(b)}))

    def or_(self, a, b):
        return Rep(self.blk("operator_or", {"OPERAND1": bool_in(a), "OPERAND2": bool_in(b)}))

    def not_(self, a):
        return Rep(self.blk("operator_not", {"OPERAND": bool_in(a)}))

    def math(self, fn, a):
        return Rep(self.blk("operator_mathop", {"NUM": val(a)}, {"OPERATOR": [fn, None]}))

    def round_(self, a): return Rep(self.blk("operator_round", {"NUM": val(a)}))
    def letter(self, i, s): return Rep(self.blk("operator_letter_of", {"LETTER": val(i), "STRING": val(s, "s")}))
    def length(self, s): return Rep(self.blk("operator_length", {"STRING": val(s, "s")}))

    # ---- datos
    def setv(self, v, x):
        kind = "n" if isinstance(x, (int, float)) else "s"
        return self.blk("data_setvariableto", {"VALUE": val(x, kind)}, {"VARIABLE": [v.name, v.id]})

    def chg(self, v, x):
        return self.blk("data_changevariableby", {"VALUE": val(x)}, {"VARIABLE": [v.name, v.id]})

    def item(self, l, i):
        return Rep(self.blk("data_itemoflist", {"INDEX": val(i)}, {"LIST": [l.name, l.id]}))

    def addto(self, l, x):
        return self.blk("data_addtolist", {"ITEM": val(x, "s")}, {"LIST": [l.name, l.id]})

    def delall(self, l):
        return self.blk("data_deletealloflist", fields={"LIST": [l.name, l.id]})

    def replace(self, l, i, x):
        return self.blk("data_replaceitemoflist", {"INDEX": val(i), "ITEM": val(x, "s")},
                        {"LIST": [l.name, l.id]})

    # ---- control
    def wait(self, s): return self.blk("control_wait", {"DURATION": val(s)})
    def forever(self, *body): return self.blk("control_forever", {"SUBSTACK": [2, self.stack(*body)]})

    def repeat(self, n, *body):
        return self.blk("control_repeat", {"TIMES": val(n), "SUBSTACK": [2, self.stack(*body)]})

    def until(self, cond, *body):
        inp = {"CONDITION": bool_in(cond)}
        if body:
            inp["SUBSTACK"] = [2, self.stack(*body)]
        return self.blk("control_repeat_until", inp)

    def if_(self, cond, *body):
        return self.blk("control_if", {"CONDITION": bool_in(cond), "SUBSTACK": [2, self.stack(*body)]})

    def ifelse(self, cond, a, b):
        return self.blk("control_if_else", {"CONDITION": bool_in(cond), "SUBSTACK": [2, self.stack(*a)],
                                            "SUBSTACK2": [2, self.stack(*b)]})

    def clone_self(self):
        m = self.blk("control_create_clone_of_menu", fields={"CLONE_OPTION": ["_myself_", None]}, shadow=True)
        return self.blk("control_create_clone_of", {"CLONE_OPTION": [1, m]})

    def delete_clone(self): return self.blk("control_delete_this_clone")

    # ---- eventos
    def whenflag(self): return self.hat("event_whenflagclicked")
    def whenclicked(self): return self.hat("event_whenthisspriteclicked")
    def whenkey(self, k): return self.hat("event_whenkeypressed", {"KEY_OPTION": [k, None]})
    def whenclone(self): return self.hat("control_start_as_clone")

    def whenbcast(self, name):
        return self.hat("event_whenbroadcastreceived", {"BROADCAST_OPTION": [name, "bc_" + name]})

    def bcast(self, name):
        return self.blk("event_broadcast", {"BROADCAST_INPUT": [1, [11, name, "bc_" + name]]})

    # ---- apariencia / movimiento
    def costume_to(self, name):
        if isinstance(name, Rep):
            m = self.blk("looks_costume", fields={"COSTUME": ["", None]}, shadow=True)
            return self.blk("looks_switchcostumeto", {"COSTUME": [3, str(name), m]})
        m = self.blk("looks_costume", fields={"COSTUME": [name, None]}, shadow=True)
        return self.blk("looks_switchcostumeto", {"COSTUME": [1, m]})

    def show(self): return self.blk("looks_show")
    def hide(self): return self.blk("looks_hide")
    def size_to(self, v): return self.blk("looks_setsizeto", {"SIZE": val(v)})

    def effect(self, name, v):
        return self.blk("looks_seteffectto", {"VALUE": val(v)}, {"EFFECT": [name, None]})

    def effect_chg(self, name, v):
        return self.blk("looks_changeeffectby", {"CHANGE": val(v)}, {"EFFECT": [name, None]})

    def goto(self, x, y): return self.blk("motion_gotoxy", {"X": val(x), "Y": val(y)})
    def direction(self, v): return self.blk("motion_pointindirection", {"DIRECTION": val(v)})
    def turn(self, v): return self.blk("motion_turnright", {"DEGREES": val(v)})
    def chgy(self, v): return self.blk("motion_changeyby", {"DY": val(v)})

    def rotstyle(self, s):
        return self.blk("motion_setrotationstyle", fields={"STYLE": [s, None]})

    # ---- lapiz / sensores / sonido
    def pen_clear(self): return self.blk("pen_clear")
    def pen_stamp(self): return self.blk("pen_stamp")
    def mousex(self): return Rep(self.blk("sensing_mousex"))
    def mousey(self): return Rep(self.blk("sensing_mousey"))
    def mousedown(self): return Rep(self.blk("sensing_mousedown"))
    def timer(self): return Rep(self.blk("sensing_timer"))
    def reset_timer(self): return self.blk("sensing_resettimer")

    def touching_mouse(self):
        m = self.blk("sensing_touchingobjectmenu", fields={"TOUCHINGOBJECTMENU": ["_mouse_", None]}, shadow=True)
        return Rep(self.blk("sensing_touchingobject", {"TOUCHINGOBJECTMENU": [1, m]}))

    def play(self, name):
        m = self.blk("sound_sounds_menu", fields={"SOUND_MENU": [name, None]}, shadow=True)
        return self.blk("sound_play", {"SOUND_MENU": [1, m]})

    # ---- salida
    def finalize(self):
        for bid, b in self.blocks.items():
            if b["next"]:
                self.blocks[b["next"]]["parent"] = bid
            for v in b["inputs"].values():
                for ref in v[1:]:
                    if isinstance(ref, str) and ref in self.blocks:
                        self.blocks[ref]["parent"] = bid

    def to_json(self, layer):
        self.finalize()
        d = {"isStage": self.stage, "name": self.name, "variables": {}, "lists": {}, "broadcasts": {},
             "blocks": self.blocks, "comments": {}, "currentCostume": 0, "costumes": self.costumes,
             "sounds": self.sounds, "volume": 100, "layerOrder": layer}
        if self.stage:
            d.update({"variables": {f"var_{k}": [k, v] for k, v in GLOBAL_VARS.items()},
                      "lists": {f"lst_{k}": [k, v] for k, v in GLOBAL_LISTS.items()},
                      "broadcasts": {f"bc_{k}": k for k in BROADCASTS},
                      "tempo": 60, "videoTransparency": 50, "videoState": "on",
                      "textToSpeechLanguage": None})
        else:
            d.update({"visible": self.visible, "x": self.pos[0], "y": self.pos[1], "size": self.size,
                      "direction": 90, "draggable": False, "rotationStyle": "all around"})
        return d


BROADCASTS = ["galleta"]
# Intervalo (s) entre galletas doradas. En el original son 5-15 min; aqui 45-120 s para que se vean.
GOLD_DELAY = (1, 2) if os.environ.get("COOKIE_TEST_FAST") else (45, 120)
OUT = os.environ.get("COOKIE_OUT", OUT)

# --------------------------------------------------------------------------------------
# Variables y listas globales
# --------------------------------------------------------------------------------------
cookies, cps, mult = gv("cookies"), gv("cookies per second"), gv("multiplicador", 1)
offset, frenzy_t, price = gv("scroll"), gv("frenzy restante"), gv("precio")
fmt_out, last_t, dt = gv("texto numero", ""), gv("t anterior"), gv("dt")
was_down, msg_kind, msg_gain, msg_until = gv("raton antes"), gv("aviso tipo"), gv("aviso cantidad"), gv("aviso hasta")
g_clicked, g_t, g_choice = gv("dorada pulsada"), gv("dorada t0"), gv("dorada efecto")
t_a, t_b, d_i, d_x = gv("tmp a"), gv("tmp b"), gv("dibujo i"), gv("dibujo x")
mx, my, row, rr = gv("raton x"), gv("raton y"), gv("fila"), gv("fila dibujo")
ring_n, ring_i, ring_a, row_y, afford, idx_v = (gv("anillo n"), gv("anillo i"), gv("anillo angulo"),
                                                 gv("fila y"), gv("se puede"), gv("indice"))

L_NAME = gl("nombre", [b[0] for b in BUILDINGS])
L_PRICE = gl("precio base", PRICES)
L_CPS = gl("cps base", CPS)
L_OWNED = gl("cantidad", [0] * N)
L_SUFFIX = gl("sufijo", SUFFIXES)

# --------------------------------------------------------------------------------------
# Escenario
# --------------------------------------------------------------------------------------
stage = Target("Stage", stage=True)
stage.costumes = [costume("bakery", make_backdrop(), 2)]

# --------------------------------------------------------------------------------------
# Sprite "Texto": toda la interfaz (tienda, contadores, cursores) y la logica del juego
# --------------------------------------------------------------------------------------
ui = Target("Texto")
ui.visible = False
chars = [chr(c) for c in range(32, 127)]
ui.costumes = [costume("g" + ch, glyph_image(ch), 2) for ch in chars]
ui.costumes += [costume("tileOn", tile_image(True)), costume("tileOff", tile_image(False)),
                costume("btnUp", arrow_image(True)), costume("btnDown", arrow_image(False))]
icons_sheet = Image.open(os.path.join(IMG, "icons.png")).convert("RGBA")
for i, (_, col) in enumerate(BUILDINGS):
    ui.costumes.append(costume(f"i{i}", icons_sheet.crop((col * 48, 0, col * 48 + 48, 48)), 1))
cur = Image.open(os.path.join(IMG, "cursor.png")).convert("RGBA").crop((0, 0, 32, 32))
ui.costumes.append(costume("cursor", cur.resize((64, 64), Image.NEAREST), 2))
ui.sounds = [sound("buy", os.path.join(SND, "buy1.mp3"))]

# --- drawText(str, x, y, size, align): estampa una letra por disfraz
draw_text = ui.defproc("drawText", ["str", "x", "y", "size", "align"])
p = draw_text
ui.body(
    draw_text,
    ui.size_to(p.a("size")),
    ui.setv(d_x, ui.add(ui.sub(p.a("x"), ui.div(ui.mul(ui.mul(p.a("align"), ui.length(p.a("str"))),
                                                      ui.div(ui.mul(12, p.a("size")), 100)), 2)),
                        ui.div(ui.div(ui.mul(12, p.a("size")), 100), 2))),
    ui.setv(d_i, 1),
    ui.repeat(ui.length(p.a("str")),
              ui.costume_to(ui.join("g", ui.letter(d_i, p.a("str")))),
              ui.goto(d_x, p.a("y")),
              ui.pen_stamp(),
              ui.chg(d_x, ui.div(ui.mul(12, p.a("size")), 100)),
              ui.chg(d_i, 1)),
)

# --- fmt(n): numero grande -> "1,234" / "1.234 million"
fmt = ui.defproc("fmt", ["n"])
pad = ui.ifelse(
    ui.lt(t_b, 10),
    [ui.setv(fmt_out, ui.join(ui.math("floor", ui.div(t_a, 1000)), ui.join(",00", t_b)))],
    [ui.ifelse(ui.lt(t_b, 100),
               [ui.setv(fmt_out, ui.join(ui.math("floor", ui.div(t_a, 1000)), ui.join(",0", t_b)))],
               [ui.setv(fmt_out, ui.join(ui.math("floor", ui.div(t_a, 1000)), ui.join(",", t_b)))])],
)
small = ui.stack(
    ui.setv(t_a, ui.math("floor", fmt.a("n"))),
    ui.ifelse(ui.lt(t_a, 1000),
              [ui.setv(fmt_out, t_a)],
              [ui.setv(t_b, ui.mod(t_a, 1000)), pad]),
)
big = ui.stack(
    ui.setv(t_a, fmt.a("n")),
    ui.setv(t_b, 0),
    ui.until(ui.lt(t_a, 1000), ui.setv(t_a, ui.div(t_a, 1000)), ui.chg(t_b, 1)),
    ui.ifelse(ui.gt(t_b, len(SUFFIXES) - 1),
              [ui.setv(fmt_out, fmt.a("n"))],
              [ui.setv(fmt_out, ui.join(ui.div(ui.round_(ui.mul(t_a, 1000)), 1000),
                                        ui.join(" ", ui.item(L_SUFFIX, ui.add(t_b, 1)))))]),
)
ui.body(fmt, ui.ifelse(ui.lt(fmt.a("n"), 1000000), [small], [big]))

# --- fmt1(n): produccion por segundo con 1 decimal
fmt1 = ui.defproc("fmt1", ["n"])
ui.body(fmt1, ui.ifelse(ui.lt(fmt1.a("n"), 1000),
                        [ui.setv(fmt_out, ui.div(ui.round_(ui.mul(fmt1.a("n"), 10)), 10))],
                        [fmt.call(fmt1.a("n"))]))

# --- calcPrice(idx): precio = ceil(base * 1.15^cantidad)
calc_price = ui.defproc("calcPrice", ["idx"])
ui.body(calc_price, ui.setv(price, ui.math("ceiling", ui.mul(
    ui.item(L_PRICE, calc_price.a("idx")),
    ui.math("e ^", ui.mul(ui.item(L_OWNED, calc_price.a("idx")), LN_PRICE_INC))))))

# --- recalc: CpS total
recalc = ui.defproc("recalc", [])
ui.body(recalc, ui.setv(cps, 0), ui.setv(t_a, 1),
        ui.repeat(N, ui.chg(cps, ui.mul(ui.item(L_CPS, t_a), ui.item(L_OWNED, t_a))), ui.chg(t_a, 1)))

# --- buy(idx)
buy = ui.defproc("buy", ["idx"])
ui.body(buy, calc_price.call(buy.a("idx")),
        ui.if_(ui.not_(ui.lt(cookies, price)),
               ui.chg(cookies, ui.sub(0, price)),
               ui.replace(L_OWNED, buy.a("idx"), ui.add(ui.item(L_OWNED, buy.a("idx")), 1)),
               recalc.call(),
               ui.play("buy")))

# --- click(): ratón sobre la tienda o las flechas
click = ui.defproc("clickMouse", [])
ui.body(
    click,
    ui.setv(mx, ui.mousex()),
    ui.setv(my, ui.mousey()),
    ui.if_(ui.and_(ui.gt(mx, 56), ui.lt(mx, 240)),
           ui.setv(row, ui.math("floor", ui.div(ui.sub(162, my), 46))),
           ui.if_(ui.and_(ui.and_(ui.not_(ui.lt(row, 0)), ui.lt(row, VISIBLE_ROWS)),
                          ui.lt(ui.sub(ui.sub(162, my), ui.mul(row, 46)), 44)),
                  buy.call(ui.add(ui.add(offset, row), 1)))),
    ui.if_(ui.and_(ui.lt(ui.math("abs", ui.sub(mx, 208)), 11), ui.lt(ui.math("abs", ui.sub(my, 171)), 11)),
           ui.if_(ui.gt(offset, 0), ui.chg(offset, -1))),
    ui.if_(ui.and_(ui.lt(ui.math("abs", ui.sub(mx, 232)), 11), ui.lt(ui.math("abs", ui.sub(my, 171)), 11)),
           ui.if_(ui.lt(offset, MAX_OFFSET), ui.chg(offset, 1))),
)

# --- render(): pinta todo con el lapiz
render = ui.defproc("render", [])
store_rows = ui.repeat(
    VISIBLE_ROWS,
    ui.setv(idx_v, ui.add(ui.add(offset, rr), 1)),
    ui.setv(row_y, ui.sub(140, ui.mul(rr, 46))),
    calc_price.call(idx_v),
    ui.ifelse(ui.lt(cookies, price),
              [ui.setv(afford, 0), ui.costume_to("tileOff"), ui.effect("ghost", 0)],
              [ui.setv(afford, 1), ui.costume_to("tileOn"), ui.effect("ghost", 0)]),
    ui.size_to(100),
    ui.goto(148, row_y),
    ui.pen_stamp(),
    ui.if_(ui.eq(afford, 0), ui.effect("ghost", 45)),
    ui.costume_to(ui.join("i", ui.sub(idx_v, 1))),
    ui.size_to(75),
    ui.goto(80, row_y),
    ui.pen_stamp(),
    draw_text.call(ui.item(L_NAME, idx_v), 100, ui.add(row_y, 9), 52, 0),
    fmt.call(price),
    draw_text.call(fmt_out, 100, ui.sub(row_y, 9), 50, 0),
    ui.if_(ui.gt(ui.item(L_OWNED, idx_v), 0),
           draw_text.call(ui.item(L_OWNED, idx_v), 237, ui.sub(row_y, 9), 90, 2)),
    ui.chg(rr, 1),
)
header = [
    ui.effect("ghost", 0),
    draw_text.call("Store", 62, 171, 90, 0),
    ui.costume_to("btnUp"), ui.size_to(60), ui.goto(208, 171), ui.pen_stamp(),
    ui.costume_to("btnDown"), ui.goto(232, 171), ui.pen_stamp(),
]
left = [
    ui.effect("ghost", 0),
    draw_text.call("Your bakery", -100, 172, 75, 1),
    fmt.call(cookies),
    draw_text.call(fmt_out, -100, 149, 140, 1),
    ui.ifelse(ui.eq(ui.math("floor", cookies), 1),
              [draw_text.call("cookie", -100, 127, 85, 1)],
              [draw_text.call("cookies", -100, 127, 85, 1)]),
    fmt1.call(ui.mul(cps, mult)),
    draw_text.call(ui.join("per second : ", fmt_out), -100, 110, 62, 1),
]
notice = [
    ui.if_(ui.and_(ui.gt(msg_kind, 0), ui.lt(ui.timer(), msg_until)),
           ui.ifelse(ui.eq(msg_kind, 1),
                     [draw_text.call("Frenzy! Production x7 for 77s", -100, -150, 70, 1)],
                     [fmt.call(msg_gain),
                      draw_text.call(ui.join("Lucky! +", ui.join(fmt_out, " cookies")), -100, -150, 70, 1)])),
]
ring = [
    ui.setv(ring_n, ui.item(L_OWNED, 1)),
    ui.if_(ui.gt(ring_n, 60), ui.setv(ring_n, 60)),
    ui.costume_to("cursor"), ui.size_to(100), ui.effect("ghost", 0),
    ui.setv(ring_i, 0),
    ui.repeat(ring_n,
              ui.setv(ring_a, ui.add(ui.mul(ui.div(360, ring_n), ring_i), ui.mul(ui.timer(), 6))),
              ui.goto(ui.add(-100, ui.mul(100, ui.math("sin", ring_a))),
                      ui.add(-15, ui.mul(100, ui.math("cos", ring_a)))),
              ui.direction(ui.add(ring_a, 270)),
              ui.pen_stamp(),
              ui.chg(ring_i, 1)),
    ui.direction(90),
]
ui.body(render, ui.show(), ui.pen_clear(), ui.setv(rr, 0), *header, store_rows, *left, *notice, *ring,
        ui.effect("ghost", 0), ui.hide())

# --- bucle principal
h = ui.whenflag()
ui.script(
    h,
    ui.setv(cookies, 0), ui.setv(cps, 0), ui.setv(mult, 1), ui.setv(offset, 0), ui.setv(frenzy_t, 0),
    ui.setv(msg_kind, 0), ui.setv(msg_until, 0), ui.setv(was_down, 0),
    ui.delall(L_OWNED), ui.repeat(N, ui.addto(L_OWNED, 0)),
    ui.rotstyle("all around"),
    ui.reset_timer(), ui.setv(last_t, 0),
    ui.forever(
        ui.setv(dt, ui.sub(ui.timer(), last_t)),
        ui.setv(last_t, ui.timer()),
        ui.ifelse(ui.gt(frenzy_t, 0),
                  [ui.chg(frenzy_t, ui.sub(0, dt)), ui.setv(mult, 7)],
                  [ui.setv(mult, 1)]),
        ui.chg(cookies, ui.mul(ui.mul(cps, mult), dt)),
        ui.ifelse(ui.mousedown(),
                  [ui.if_(ui.eq(was_down, 0), ui.setv(was_down, 1), click.call())],
                  [ui.setv(was_down, 0)]),
        render.call(),
    ),
)
h = ui.whenkey("up arrow")
ui.script(h, ui.if_(ui.gt(offset, 0), ui.chg(offset, -1)))
h = ui.whenkey("down arrow")
ui.script(h, ui.if_(ui.lt(offset, MAX_OFFSET), ui.chg(offset, 1)))

# --------------------------------------------------------------------------------------
# Sprite "Big cookie"
# --------------------------------------------------------------------------------------
cookie = Target("Big cookie")
cookie.pos = (-100, -15)
cookie.costumes = [costume("perfectCookie", Image.open(os.path.join(IMG, "perfectCookie.png"))
                           .convert("RGBA").resize((300, 300), Image.LANCZOS), 2)]
cookie.sounds = [sound("click", os.path.join(SND, "click1.mp3"))]
h = cookie.whenflag()
cookie.script(
    h, cookie.goto(-100, -15), cookie.show(),
    cookie.forever(cookie.ifelse(
        cookie.touching_mouse(),
        [cookie.ifelse(cookie.mousedown(), [cookie.size_to(96)], [cookie.size_to(104)])],
        [cookie.size_to(100)])),
)
h = cookie.whenclicked()
cookie.script(h, cookie.chg(cookies, 1), cookie.play("click"), cookie.bcast("galleta"))

# --------------------------------------------------------------------------------------
# Sprite "+1": numero flotante al hacer clic
# --------------------------------------------------------------------------------------
plus = Target("Plus one")
plus.visible = False
plus.costumes = [costume("+1", plus_image(), 2)]
h = plus.whenbcast("galleta")
plus.script(h, plus.clone_self())
h = plus.whenclone()
plus.script(
    h,
    plus.goto(plus.add(plus.mousex(), plus.rnd(-12, 12)), plus.sub(plus.mousey(), 10)),
    plus.effect("ghost", 0), plus.show(),
    plus.repeat(20, plus.chgy(2.5), plus.effect_chg("ghost", 5)),
    plus.delete_clone(),
)

# --------------------------------------------------------------------------------------
# Sprite "Golden cookie": Frenzy (x7, 77 s) o Lucky
# --------------------------------------------------------------------------------------
gold = Target("Golden cookie")
gold.visible = False
gold.costumes = [costume("goldCookie", Image.open(os.path.join(IMG, "goldCookie.png")).convert("RGBA"), 2)]
gold.sounds = [sound("chime", os.path.join(SND, "chime.mp3"))]
h = gold.whenflag()
gold.script(
    h, gold.hide(), gold.size_to(130),
    gold.forever(
        gold.wait(gold.rnd(*GOLD_DELAY)),
        gold.goto(gold.rnd(-190, 0), gold.rnd(-100, 85)),
        gold.setv(g_clicked, 0),
        gold.effect("ghost", 100), gold.show(),
        gold.repeat(10, gold.effect_chg("ghost", -10), gold.wait(0.03)),
        gold.setv(g_t, gold.timer()),
        gold.until(gold.or_(gold.eq(g_clicked, 1), gold.gt(gold.sub(gold.timer(), g_t), 13)),
                   gold.turn(2)),
        gold.if_(gold.eq(g_clicked, 1),
                 gold.play("chime"),
                 gold.setv(g_choice, gold.rnd(1, 2)),
                 gold.setv(msg_until, gold.add(gold.timer(), 6)),
                 gold.ifelse(gold.eq(g_choice, 1),
                             [gold.setv(frenzy_t, 77), gold.setv(msg_kind, 1)],
                             [gold.setv(msg_gain, gold.mul(cookies, 0.15)),
                              gold.if_(gold.gt(msg_gain, gold.mul(cps, 900)),
                                       gold.setv(msg_gain, gold.mul(cps, 900))),
                              gold.chg(msg_gain, 13),
                              gold.chg(cookies, msg_gain),
                              gold.setv(msg_kind, 2)])),
        gold.repeat(10, gold.effect_chg("ghost", 10), gold.wait(0.02)),
        gold.hide(),
    ),
)
h = gold.whenclicked()
gold.script(h, gold.setv(g_clicked, 1))

# --------------------------------------------------------------------------------------
# Proyecto
# --------------------------------------------------------------------------------------
targets = [stage.to_json(0), cookie.to_json(1), ui.to_json(2), plus.to_json(3), gold.to_json(4)]
project = {"targets": targets, "monitors": [], "extensions": ["pen"],
           "meta": {"semver": "3.0.0", "vm": "0.2.0", "agent": "cookie-clicker-sb3-builder"}}

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("project.json", json.dumps(project, separators=(",", ":")))
    for name, data in ASSETS.items():
        z.writestr(name, data)
print(f"{OUT}: {os.path.getsize(OUT) / 1024:.0f} KB, {sum(len(t['blocks']) for t in targets)} bloques, "
      f"{len(ASSETS)} recursos")
