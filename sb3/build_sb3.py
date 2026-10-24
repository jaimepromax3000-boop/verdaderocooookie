#!/usr/bin/env python3
"""Genera CookieClicker.sb3 (proyecto de Scratch 3) a partir de los recursos y datos reales del repositorio.

    python3 sb3/build_sb3.py            ->  sb3/CookieClicker.sb3

Requiere Pillow y ffmpeg. Los datos del juego (sb3/game_data.json) y los glifos con la fuente real
(sb3/glyphs.json) se regeneran con sb3/extract_game_data.js y sb3/render_glyphs.js (Playwright).
"""
import base64
import io
import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gamedata as G                                   # noqa: E402
from sb3dsl import Project, Target, Rep, Var, Lst      # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
IMG = os.path.join(REPO, "img")
SND = os.path.join(REPO, "snd")
OUT = os.environ.get("COOKIE_OUT", os.path.join(HERE, "CookieClicker.sb3"))
FAST = bool(os.environ.get("COOKIE_TEST_FAST"))        # galletas doradas casi inmediatas (solo para pruebas)

P = Project()
N = G.N
UPG = G.build_upgrades()
ACH = G.build_achievements()
NU, NA = len(UPG), len(ACH)
PRICE_INC = 1.15
LN_INC = math.log(PRICE_INC)


def fl(x):
    x = float(x)
    return int(x) if x == int(x) and abs(x) < 1e15 else x


# ======================================================================================
# Disposicion (coordenadas de escenario, origen en el centro, y hacia arriba)
# ======================================================================================
LEFT_CX, CK_Y = -172.5, -20
CEN_L, CEN_W, ROW_H, ROW_TOP, CROWS = -105, 150, 48, 128, 6
HDR_Y = 139                                      # botones Stats / Achievements
R_X0 = 45
UP_COLS, UP_ROWS, UP_SP, UP_Y0 = 6, 3, 32, 148
UP_X0 = R_X0 + 3 + UP_SP / 2
UP_SZ = round(UP_SP / 60 * 100)                  # tamano (%) de marco e icono de cada mejora
BTN_Y = 58
SH_W, SH_ROW_H, SH_Y0, SH_SP, SH_ROWS = 172, 36, 31, 37, 6
SH_X = R_X0 + 2 + SH_W / 2
SB_X = R_X0 + SH_W + 16                          # barra de desplazamiento de la tienda
TIP_W, TIP_H, TIP_RX = 250, 104, 40              # cuadro de ayuda: ancho, alto y borde derecho
MILK_W = CEN_L + 240                             # ancho de la columna izquierda
OV_W, OV_CX = (R_X0 + 240), (-240 + R_X0) / 2    # paneles a pantalla de Logros / Stats
TICK_CX, TICK_W = (-240 + R_X0) / 2, R_X0 + 240  # titular de noticias (arriba, izquierda + centro)

# ======================================================================================
# Recursos graficos
# ======================================================================================
GL = json.load(open(os.path.join(HERE, "glyphs.json")))
BANKS = ["w", "g", "r", "y", "W", "Y"]             # pequenos (blanco, verde, rojo, dorado) y grandes (blanco, dorado)
NGLYPH = 95
ADV_ALL = []                                       # avance de cada disfraz de glifo (unidades al 100 % de su banco)
BANK_K = []                                        # factor para que "tamano 100 %" equivalga a una fuente de 14 unidades
for _b in BANKS:
    ADV_ALL += [a / 2 for a in GL[_b]["adv"]]
    BANK_K.append(round(14 / (GL[_b]["px"] / 2), 4))


def png(b64):
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")


def load(name):
    return Image.open(os.path.join(IMG, name)).convert("RGBA")


ui = Target(P, "Texto")
ui.visible = False
ui.pos = (0, 0)


def add_costume(name, im, res=2, center=None):
    ui.costumes.append(P.costume(name, im, res, center))
    return len(ui.costumes)                              # indice de costume (1-based)


# --- glifos (6 bancos x 95 caracteres) con origen a la izquierda del caracter
for bank in BANKS:
    info = GL[bank]
    for k, b64 in enumerate(info["imgs"]):
        add_costume(bank + chr(32 + k), png(b64), 2, (info["pad"], info["cellH"] / 2))
assert len(ui.costumes) == NGLYPH * len(BANKS)

# --- baldosas de la tienda (storeTile.jpg, 4 variantes), marcos de mejora, botones, tooltips
st = Image.open(os.path.join(IMG, "storeTile.jpg")).convert("RGBA")
C_TILE = add_costume("tile0", st.crop((0, 0, 300, 64)).resize((336, 72), Image.LANCZOS))
for k in range(1, 4):
    add_costume(f"tile{k}", st.crop((0, 64 * k, 300, 64 * k + 64)).resize((336, 72), Image.LANCZOS))
fr = load("upgradeFrame.png")
C_FRAME_ON = add_costume("frameOn", fr.crop((0, 0, 60, 60)), 1)
C_FRAME_HOV = add_costume("frameHover", fr.crop((60, 0, 120, 60)), 1)
C_FRAME_OFF = add_costume("frameOff", fr.crop((120, 0, 180, 60)), 1)
C_CRATE_BG = add_costume("crateBG", Image.new("RGBA", (48, 48), (0, 0, 0, 70)), 1)
C_MONEY = add_costume("money", load("money.png"), 2)


def button_image(w, h, on):
    im = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fill = (112, 86, 58, 255) if on else (52, 40, 30, 255)
    d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), 6, fill=fill, outline=(214, 182, 132, 255), width=2)
    return im


BTN_W = {"buy": 30, "sell": 30, "b1": 24, "b10": 24, "b100": 28, "bmax": 28, "wide": 80, "stats": 40}
C_BTN = {}
for key, w in BTN_W.items():
    C_BTN[key] = add_costume(key + "Off", button_image(w, 14, False))
    add_costume(key + "On", button_image(w, 14, True))     # = C_BTN[key] + 1


def panel_image(w, h, alpha=225, border=(214, 182, 132, 255)):
    im = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), 8, fill=(14, 10, 8, alpha), outline=border, width=2)
    return im


C_TIP = add_costume("tip", panel_image(TIP_W, TIP_H))
C_OVER = add_costume("overlay", panel_image(OV_W, 360, 255))
C_TOAST = add_costume("toast", panel_image(MILK_W - 4, 30, 232))


def solid(w, h, rgba, radius=0):
    im = Image.new("RGBA", (int(w * 2), int(h * 2)), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, int(w * 2) - 1, int(h * 2) - 1), radius, fill=rgba)
    return im


C_BAND = add_costume("counterBand", solid(MILK_W, 52, (0, 0, 0, 105)))
C_PILL = add_costume("bakeryPill", solid(MILK_W - 24, 22, (0, 0, 0, 120), 14))
C_TRACK = add_costume("scrollTrack", solid(5, 204, (0, 0, 0, 150), 3))
C_THUMB = add_costume("scrollThumb", solid(8, 22, (214, 182, 132, 255), 4))
_sh = load("cookieShadow.png").resize((200, 200), Image.LANCZOS)
C_SHADOW = add_costume("cookieShadow", _sh)
C_COOKIE = add_costume("perfectCookie", load("perfectCookie.png").resize((200, 200), Image.LANCZOS))


def arrow_image(up):
    im = Image.new("RGBA", (28, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(14, 4), (25, 22), (3, 22)] if up else [(14, 24), (25, 6), (3, 6)]
    d.polygon(pts, fill=(255, 235, 190, 255), outline=(30, 16, 8, 255))
    return im


C_ARR_UP, C_ARR_DN = add_costume("arrowUp", arrow_image(True)), add_costume("arrowDown", arrow_image(False))

# --- iconos (icons.png, celdas de 48 px) usados por mejoras, logros y edificios
icons = load("icons.png")
cell_set = {G.icon_key(r["icon"]) for r in UPG + ACH}
cell_set |= {(o["icon"], 0) for o in G.OBJS}
cell_list = sorted(cell_set)
C_ICON0 = len(ui.costumes) + 1
CELL_IDX = {}
for k, (cx, cy) in enumerate(cell_list):
    CELL_IDX[(cx, cy)] = k
    add_costume(f"i{cx}_{cy}", icons.crop((cx * 48, cy * 48, cx * 48 + 48, cy * 48 + 48)), 1)
_q = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
_d = ImageDraw.Draw(_q)
_d.rounded_rectangle((3, 3, 44, 44), 6, fill=(30, 22, 18, 255), outline=(120, 100, 80, 255), width=2)
_gm = png(GL["W"]["imgs"][ord("?") - 32])
_q.alpha_composite(_gm, ((48 - _gm.width) // 2 - 2, (48 - _gm.height) // 2))
C_UNKNOWN = add_costume("unknown", _q, 1)

# --- cursor (anillo alrededor de la galleta) y leches
cur = load("cursor.png").crop((0, 0, 32, 32)).resize((25, 25), Image.LANCZOS)
C_CURSOR = add_costume("cursor", cur, 2)
milk_costumes = []
for m in G.D["milks"]:
    pic = load(m["pic"])
    tile = pic.resize((374, 374), Image.LANCZOS)            # azulejo de 480 px reales -> 187 unidades
    strip = Image.new("RGBA", (MILK_W * 2, 374), (0, 0, 0, 0))
    strip.paste(tile.crop((0, 0, MILK_W * 2, 374)), (0, 0))
    milk_costumes.append(add_costume("milk" + m["name"], strip, 2, (MILK_W, 0)))
C_MILK0 = milk_costumes[0]
N_MILK = len(milk_costumes)

# --- arte de los edificios (filas de la barra central)
ART = {}   # indice de edificio -> dict(pic0, nframes, bg)
for i, o in enumerate(G.OBJS):
    b = i + 1
    if b == 1:
        continue
    a = o["art"]
    frames = a.get("frames") or 1
    pic_name = a["pic"] or "grandma.png"
    pics = [pic_name]
    if b == 2:
        pics = ["grandma.png", "farmerGrandma.png", "workerGrandma.png", "minerGrandma.png", "cosmicGrandma.png",
                "transmutedGrandma.png", "alteredGrandma.png", "grandmasGrandma.png", "antiGrandma.png",
                "rainbowGrandma.png", "bankGrandma.png", "templeGrandma.png", "witchGrandma.png",
                "luckyGrandma.png", "metaGrandma.png", "scriptGrandma.png", "alternateGrandma.png",
                "brainyGrandma.png", "cloneGrandma.png"]
    first = None
    for pn in pics:
        im = load(pn)
        for f in range(frames):
            fw = im.width // frames
            fim = im.crop((f * fw, 0, f * fw + fw, min(im.height, 96)))
            # centrado en un lienzo de 64x64 (las piezas estrechas, como la consola, conservan su alto)
            idx = add_costume(f"p{b}_{pn}_{f}", fim, 2)
            first = first or idx
    bgname = (a.get("bg") or (a["base"] + "Background.png"))
    bg = load(bgname)
    row = Image.new("RGBA", (CEN_W * 2, 96), (0, 0, 0, 255))
    for x in range(0, CEN_W * 2, 128):
        row.paste(bg.crop((0, 0, 128, 96)), (x, 0))
    ART[b] = {"pic0": first, "frames": frames, "bg": add_costume(f"bg{b}", row, 2),
              "npics": len(pics), "w": a.get("w") or 48, "rows": a.get("rows") or 1,
              "xV": a.get("xV") or 0, "yV": a.get("yV") or 0, "x": a.get("x") or 0, "y": a.get("y") or 0}
    ART[b]["pw"] = Image.open(os.path.join(IMG, pic_name)).size[0] // frames
    ART[b]["ph"] = min(Image.open(os.path.join(IMG, pic_name)).size[1], 96)

# --- sonidos
ui.sounds += [P.sound(f"click{k}", os.path.join(SND, f"click{k}.mp3")) for k in range(1, 8)]
ui.sounds += [P.sound(f"buy{k}", os.path.join(SND, f"buy{k}.mp3")) for k in range(1, 5)]
ui.sounds += [P.sound(f"sell{k}", os.path.join(SND, f"sell{k}.mp3")) for k in range(1, 5)]
ui.sounds += [P.sound("upgrade", os.path.join(SND, "press.mp3")),
              P.sound("achievement", os.path.join(SND, "jingle.mp3"))]

# ======================================================================================
# Variables y listas globales
# ======================================================================================
V = P.var
cookies, baked, handmade = V("cookies"), V("cookies baked"), V("handmade cookies")
clicks, gclicks, ach_count, up_bought = V("cookie clicks"), V("golden cookies clicked"), V("achievements won"), V("upgrades bought")
milk, cps, cps_full, mouse_cps = V("milk progress"), V("cps raw"), V("cookies per second"), V("cookies per click")
buff_mult, click_mult = V("buff production", 1), V("buff click", 1)
frenzy_t, click_t, bb_t, bb_idx, bb_pow = V("frenzy time"), V("click frenzy time"), V("building buff time"), V("building buff building"), V("building buff power")
buy_mode, bulk, shop_off, up_off, cen_off, ov_open, ov_off = V("buy mode", 1), V("bulk buy", 1), V("store scroll"), V("upgrades scroll"), V("rows scroll"), V("achievements open"), V("achievements scroll")
build_total, non_cursor, cursor_x2, finger_add, mice = V("buildings owned"), V("non cursor buildings"), V("cursor doublings"), V("finger add"), V("mice owned")
gmult, cat_mult, gjobs, bingo, kittens_owned = V("cookie multiplier", 1), V("kitten multiplier", 1), V("grandma jobs owned"), V("bingo owned"), V("kitten upgrades owned")
gold_freq, gold_dur, eff_dur, gold_last = V("golden frequency", 1), V("golden duration", 1), V("effect duration", 1), V("golden last effect")
dirty_up, chk_t, dt, last_t, was_down, clk, clk_ui = V("upgrades dirty", 1), V("check timer"), V("dt"), V("last time"), V("mouse was down"), V("click edge"), V("click ui")
mx, my, hk, hi, hy = V("mouse x"), V("mouse y"), V("hover kind"), V("hover index"), V("hover y")
toast_text, toast_until, toast_icon = V("toast text", ""), V("toast until"), V("toast icon")
notice_kind, notice_gain, notice_until = V("notice kind"), V("notice gain"), V("notice until")
fmt_out = V("number text", "")
d_x, d_i, d_w, d_adv = V("draw x"), V("draw i"), V("draw width"), V("draw advance")
t_a, t_b, t_c, t_d, t_e = V("tmp a"), V("tmp b"), V("tmp c"), V("tmp d"), V("tmp e")
r_i, r_b, r_slot, r_y, r_n = V("row i"), V("row building"), V("row slot"), V("row y"), V("row n")
r_x, r_px, r_py, r_k, r_fr = V("row x"), V("row px"), V("row py"), V("row k"), V("row frame")
min_amt, grand_types = V("min amount"), V("grandma types")
shop_n, up_n, p_n = V("store count"), V("upgrade slots"), V("particle count")
tip_x, tip_top = V("tip x"), V("tip top")
price_v, afford_v, pcount = V("price now"), V("affordable"), V("buy count")
ach_flag, ok_v = V("ach flag"), V("unlock ok")
ACH_IDX = {r["name"]: i + 1 for i, r in enumerate(ACH)}
ACH_JUSTWRONG = ACH_IDX["Just wrong"]
key_cd = V("key cooldown")

L_BNAME = P.lst("building name", [o["name"] for o in G.OBJS])
L_BSING = P.lst("building single", [o["single"] for o in G.OBJS])
L_BPLUR = P.lst("building plural", [o["plural"] for o in G.OBJS])
L_BBASEP = P.lst("building base price", [fl(o["base"]) for o in G.OBJS])
L_BBASEC = P.lst("building base cps", [fl(round(o.get("cps", 0.1), 10)) for o in G.OBJS])
L_BICON = P.lst("building icon", [C_ICON0 + CELL_IDX[(o["icon"], 0)] for o in G.OBJS])
L_BAMT = P.lst("building amount", [0] * N)
L_BTOT = P.lst("building produced", [0] * N)
L_BTIER = P.lst("building tier doublings", [0] * N)
L_BJOB = P.lst("building grandma job", [0] * N)
L_BBUFF = P.lst("building buff mult", [1] * N)
L_BEACH = P.lst("building cps each", [0] * N)
L_SHOP = P.lst("store listing", [])
L_ADV = P.lst("glyph advance", [round(a, 3) for a in ADV_ALL])
L_BANKK = P.lst("glyph bank scale", BANK_K)
L_SUFFIX = P.lst("number suffix", ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion",
                                   "sextillion", "septillion", "octillion", "nonillion", "decillion"])
L_GPICS = P.lst("grandma costumes", [ART[2]["pic0"]])
_JOBPIC = {3: 1, 5: 2, 4: 3, 9: 4, 10: 5, 11: 6, 12: 7, 13: 8, 14: 9, 6: 10, 7: 11, 8: 12, 15: 13, 16: 14, 17: 15,
           18: 16, 19: 17, 20: 18}
L_JOBPIC = P.lst("grandma job costume", [ART[2]["pic0"] + _JOBPIC.get(b, 0) for b in range(1, N + 1)])

L_UNAME = P.lst("upgrade name", [r["name"] for r in UPG])
L_UPRICE = P.lst("upgrade price", [fl(r["price"]) for r in UPG])
L_UICON = P.lst("upgrade icon", [C_ICON0 + CELL_IDX[G.icon_key(r["icon"])] for r in UPG])
L_UTYPE = P.lst("upgrade type", [r["type"] for r in UPG])
L_UA = P.lst("upgrade a", [fl(r["a"]) for r in UPG])
L_UUT = P.lst("upgrade unlock type", [r["ut"] for r in UPG])
L_UUA = P.lst("upgrade unlock a", [fl(r["ua"]) for r in UPG])
L_UUB = P.lst("upgrade unlock b", [fl(r["ub"]) for r in UPG])
L_USTATE = P.lst("upgrade state", [0] * NU)
L_UD = [P.lst(f"upgrade desc {k + 1}", [G.wrap(r["desc"], 44, 3)[k] for r in UPG]) for k in range(3)]
L_USHOW = P.lst("upgrades in store", [])

L_ANAME = P.lst("achievement name", [r["name"] for r in ACH])
L_AICON = P.lst("achievement icon", [C_ICON0 + CELL_IDX[G.icon_key(r["icon"])] for r in ACH])
L_ATYPE = P.lst("achievement type", [r["type"] for r in ACH])
L_AA = P.lst("achievement a", [fl(r["a"]) for r in ACH])
L_AB = P.lst("achievement b", [fl(r["b"]) for r in ACH])
L_AWON = P.lst("achievement won", [0] * NA)
L_AD = [P.lst(f"achievement desc {k + 1}", [G.wrap(r["desc"], 44, 2)[k] for r in ACH]) for k in range(2)]

L_PX = P.lst("particle x", [])
L_PY = P.lst("particle y", [])
L_PT = P.lst("particle age", [])
L_PTXT = P.lst("particle text", [])

# ======================================================================================
# Escenario: fondo de las tres columnas
# ======================================================================================


def make_backdrop():
    W, H = 960, 720
    im = Image.new("RGBA", (W, H))
    bg = load("bgBlue.jpg")
    for x in range(0, W, bg.width):
        for y in range(0, H, bg.height):
            im.paste(bg, (x, y))
    dark = Image.open(os.path.join(IMG, "darkNoise.jpg")).convert("RGBA")
    cx0, cx1 = (CEN_L + 240) * 2, (R_X0 + 240) * 2
    for x in range(cx0, W, 512):
        for y in range(0, H, 512):
            im.paste(dark.crop((0, 0, min(512, W - x), min(512, H - y))), (x, y))
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(shade)
    d.rectangle((cx0, 0, cx1, H), fill=(0, 0, 0, 90))        # columna central
    d.rectangle((cx1, 0, W, H), fill=(0, 0, 0, 45))          # tienda
    im.alpha_composite(shade)
    sb = load("shadedBordersSoft.png").resize((cx0, H), Image.LANCZOS)
    im.alpha_composite(sb, (0, 0))
    top = Image.open(os.path.join(IMG, "darkNoiseTopBar.jpg")).convert("RGBA")   # franja del titular de noticias
    for x in range(0, cx1, 512):
        im.paste(top.crop((0, 0, min(512, cx1 - x), 60)), (x, 0))
    ph = Image.open(os.path.join(IMG, "panelHorizontal.png")).convert("RGBA")
    for x in range(0, cx1, 512):
        im.alpha_composite(ph.crop((0, 0, min(512, cx1 - x), 16)), (x, 52))
    pv = Image.open(os.path.join(IMG, "panelVertical.png")).convert("RGBA")
    for x in (cx0 - 8, cx1 - 8):
        for y in range(0, H, 512):
            im.alpha_composite(pv, (x, y))
    return im


stage = Target(P, "Stage", stage=True)
stage.costumes = [P.costume("bakery", make_backdrop(), 2)]

# ======================================================================================
# Helpers de dibujo / logica (sprite "Texto")
# ======================================================================================
T = ui


def inside(cx, cy, hw, hh):
    return T.and_(T.lt(T.math("abs", T.sub(mx, cx)), hw), T.lt(T.math("abs", T.sub(my, cy)), hh))


def for_range(var, n, *body):
    """var = 1..n"""
    return [T.setv(var, 1), T.repeat(n, *body, T.chg(var, 1))]


# --- drawText(str, x, y, size, align, bank) -----------------------------------------
draw_text = T.defproc("drawText", ["str", "x", "y", "size", "align", "bank"])
p = draw_text
d_s = V("draw scale")
T.body(
    draw_text,
    T.costume_to(T.join(p.a("bank"), "A")),
    T.setv(d_s, T.mul(p.a("size"), T.item(L_BANKK, T.add(T.math("floor", T.div(T.sub(T.costume_number(), 1), NGLYPH)), 1)))),
    T.size_to(d_s),
    T.setv(d_x, p.a("x")),
    T.if_(T.gt(p.a("align"), 0),
          T.setv(d_w, 0), T.setv(d_i, 1),
          T.repeat(T.length(p.a("str")),
                   T.costume_to(T.join(p.a("bank"), T.letter(d_i, p.a("str")))),
                   T.chg(d_w, T.item(L_ADV, T.costume_number())),
                   T.chg(d_i, 1)),
          T.setv(d_x, T.sub(p.a("x"), T.div(T.mul(T.mul(d_w, T.div(d_s, 100)), p.a("align")), 2)))),
    T.setv(d_i, 1),
    T.repeat(T.length(p.a("str")),
             T.costume_to(T.join(p.a("bank"), T.letter(d_i, p.a("str")))),
             T.goto(d_x, p.a("y")),
             T.pen_stamp(),
             T.chg(d_x, T.mul(T.item(L_ADV, T.costume_number()), T.div(d_s, 100))),
             T.chg(d_i, 1)),
)

# --- fmt(n): 1,234 / 1.235 million ...
fmt = T.defproc("fmt", ["n"])
pad = T.ifelse(
    T.lt(t_b, 10),
    [T.setv(fmt_out, T.join(T.math("floor", T.div(t_a, 1000)), T.join(",00", t_b)))],
    [T.ifelse(T.lt(t_b, 100),
              [T.setv(fmt_out, T.join(T.math("floor", T.div(t_a, 1000)), T.join(",0", t_b)))],
              [T.setv(fmt_out, T.join(T.math("floor", T.div(t_a, 1000)), T.join(",", t_b)))])],
)
small = T.stack(
    T.setv(t_a, T.math("floor", fmt.a("n"))),
    T.ifelse(T.lt(t_a, 1000), [T.setv(fmt_out, t_a)], [T.setv(t_b, T.mod(t_a, 1000)), pad]),
)
big = T.stack(
    T.setv(t_a, fmt.a("n")), T.setv(t_b, 0),
    T.until(T.lt(t_a, 1000), T.setv(t_a, T.div(t_a, 1000)), T.chg(t_b, 1)),
    T.ifelse(T.gt(t_b, 11),
             [T.setv(fmt_out, fmt.a("n"))],
             [T.setv(fmt_out, T.join(T.div(T.round_(T.mul(t_a, 1000)), 1000),
                                     T.join(" ", T.item(L_SUFFIX, T.add(t_b, 1)))))]),
)
T.body(fmt, T.ifelse(T.lt(fmt.a("n"), 1000000), [small], [big]))

# --- fmt1(n): produccion por segundo (con decimales por debajo de 1000)
fmt1 = T.defproc("fmt1", ["n"])
T.body(fmt1, T.ifelse(T.lt(fmt1.a("n"), 1000),
                      [T.setv(fmt_out, T.div(T.round_(T.mul(fmt1.a("n"), 10)), 10))],
                      [fmt.call(fmt1.a("n"))]))

# --- precios de edificios --------------------------------------------------------------
# calcPrice(i): precio del siguiente = ceil(base * 1.15^cantidad)
calc_price = T.defproc("calcPrice", ["i"])
T.body(calc_price, T.setv(price_v, T.math("ceiling", T.mul(
    T.item(L_BBASEP, calc_price.a("i")),
    T.pow_(PRICE_INC, T.item(L_BAMT, calc_price.a("i")))))))

# sumPrice(i, n): coste de comprar n mas (serie geometrica) -> price_v
sum_price = T.defproc("sumPrice", ["i", "n"])
T.body(sum_price, T.setv(price_v, T.math("ceiling", T.mul(
    T.mul(T.item(L_BBASEP, sum_price.a("i")), T.pow_(PRICE_INC, T.item(L_BAMT, sum_price.a("i")))),
    T.div(T.sub(T.pow_(PRICE_INC, sum_price.a("n")), 1), PRICE_INC - 1)))))

# sellPrice(i, n): lo que se obtiene al vender n (suma inversa * 0.25)
sell_price = T.defproc("sellPrice", ["i", "n"])
T.body(sell_price,
       T.setv(t_c, T.min_(sell_price.a("n"), T.item(L_BAMT, sell_price.a("i")))),
       T.setv(price_v, T.math("ceiling", T.mul(T.mul(
           T.item(L_BBASEP, sell_price.a("i")),
           T.pow_(PRICE_INC, T.sub(T.item(L_BAMT, sell_price.a("i")), t_c))),
           T.mul(T.div(T.sub(T.pow_(PRICE_INC, t_c), 1), PRICE_INC - 1), 0.25)))))

# maxBuy(i): cuantos se pueden comprar con las galletas actuales -> t_d
max_buy = T.defproc("maxBuy", ["i"])
T.body(max_buy,
       calc_price.call(max_buy.a("i")),
       T.setv(t_d, 0),
       T.if_(T.not_(T.lt(cookies, price_v)),
             T.setv(t_d, T.math("floor", T.div(T.math("ln", T.add(1, T.div(T.mul(cookies, PRICE_INC - 1),
                                                                      T.mul(T.item(L_BBASEP, max_buy.a("i")),
                                                                            T.pow_(PRICE_INC, T.item(L_BAMT, max_buy.a("i"))))))),
                                               LN_INC)))),
       T.if_(T.gt(t_d, 1000), T.setv(t_d, 1000)))

# --- recalc: produccion total y por edificio -------------------------------------------
bingo_f = V("bingo factor", 1)
recalc = T.defproc("recalc", [])
U = lambda i: T.item(L_USTATE, i)
T.body(
    recalc,
    T.setv(build_total, 0),
    *for_range(r_i, N, T.chg(build_total, T.item(L_BAMT, r_i)),
               T.replace(L_BTIER, r_i, 0), T.replace(L_BJOB, r_i, 0)),
    T.setv(non_cursor, T.sub(build_total, T.item(L_BAMT, 1))),
    T.delall(L_GPICS), T.addto(L_GPICS, ART[2]["pic0"]),
    T.setv(cursor_x2, 0), T.setv(finger_add, 0), T.setv(mice, 0), T.setv(gmult, 1), T.setv(gjobs, 0),
    T.setv(bingo, 0), T.setv(cat_mult, 1), T.setv(kittens_owned, 0), T.setv(milk, T.div(ach_count, 25)),
    T.setv(gold_freq, 1), T.setv(gold_dur, 1), T.setv(eff_dur, 1),
    *for_range(
        r_i, NU,
        T.if_(T.eq(U(r_i), 2),
              T.setv(t_a, T.item(L_UTYPE, r_i)),
              T.setv(t_b, T.item(L_UA, r_i)),
              T.if_(T.eq(t_a, G.T_TIER), T.lchg(L_BTIER, t_b, 1)),
              T.if_(T.eq(t_a, G.T_CURSOR2), T.chg(cursor_x2, 1)),
              T.if_(T.eq(t_a, G.T_FINGER),
                    T.ifelse(T.eq(t_b, 0), [T.chg(finger_add, 0.1)], [T.setv(finger_add, T.mul(finger_add, t_b))])),
              T.if_(T.eq(t_a, G.T_MOUSE), T.chg(mice, 1)),
              T.if_(T.eq(t_a, G.T_JOB), T.replace(L_BJOB, t_b, 1), T.chg(gjobs, 1),
                    T.addto(L_GPICS, T.item(L_JOBPIC, t_b))),
              T.if_(T.eq(t_a, G.T_KITTEN),
                    T.setv(cat_mult, T.mul(cat_mult, T.add(1, T.mul(milk, t_b)))), T.chg(kittens_owned, 1)),
              T.if_(T.eq(t_a, G.T_COOKIE), T.setv(gmult, T.mul(gmult, T.add(1, T.div(t_b, 100))))),
              T.if_(T.eq(t_a, G.T_GOLD),
                    T.ifelse(T.eq(t_b, 1),
                             [T.setv(gold_freq, T.mul(gold_freq, 2)), T.setv(gold_dur, T.mul(gold_dur, 2))],
                             [T.setv(eff_dur, T.mul(eff_dur, 2))])),
              T.if_(T.eq(t_a, G.T_BINGO), T.setv(bingo, 1)))),
    T.setv(grand_types, T.add(1, gjobs)),
    T.ifelse(T.eq(bingo, 1), [T.setv(bingo_f, 4)], [T.setv(bingo_f, 1)]),
    T.setv(t_e, 0),
    *for_range(
        r_i, N,
        T.ifelse(
            T.eq(r_i, 1),
            # cursor: ComputeCps(0.1, dobles, dedos * edificios que no son cursores)
            [T.setv(t_c, T.add(T.mul(0.1, T.pow_(2, cursor_x2)), T.mul(finger_add, non_cursor)))],
            [T.ifelse(
                T.eq(r_i, 2),
                # abuela: x2 por oficio, x4 con bingo, x2 por nivel
                [T.setv(t_c, T.mul(T.mul(T.pow_(2, gjobs), bingo_f), T.pow_(2, T.item(L_BTIER, r_i))))],
                [T.setv(t_c, T.mul(T.item(L_BBASEC, r_i), T.pow_(2, T.item(L_BTIER, r_i)))),
                 T.if_(T.eq(T.item(L_BJOB, r_i), 1),
                       T.setv(t_c, T.mul(t_c, T.add(1, T.div(T.mul(T.item(L_BAMT, 2), 0.01),
                                                             T.sub(r_i, 2))))))])]),
        T.replace(L_BEACH, r_i, T.mul(t_c, T.item(L_BBUFF, r_i))),
        T.chg(t_e, T.mul(T.item(L_BEACH, r_i), T.item(L_BAMT, r_i)))),
    T.setv(cps, T.mul(T.mul(t_e, gmult), cat_mult)),
    T.setv(cps_full, T.mul(cps, buff_mult)),
)

# --- toast + ganar logro ---------------------------------------------------------------
need_recalc = V("needs recalc")
win = T.defproc("win", ["a"])
T.body(
    win,
    T.if_(T.eq(T.item(L_AWON, win.a("a")), 0),
          T.replace(L_AWON, win.a("a"), 1),
          T.chg(ach_count, 1),
          T.setv(need_recalc, 1),
          T.setv(toast_text, T.item(L_ANAME, win.a("a"))),
          T.setv(toast_icon, T.item(L_AICON, win.a("a"))),
          T.setv(toast_until, T.add(T.timer(), 5)),
          T.play("achievement")),
)

# --- checkUnlocks: desbloquea mejoras y logros -------------------------------------------
check = T.defproc("checkUnlocks", [])
A = lambda i: T.item(L_AA, i)
B = lambda i: T.item(L_AB, i)
amt = lambda i: T.item(L_BAMT, i)
upg_unlock = [
    T.setv(ok_v, 0),
    T.setv(t_a, T.item(L_UUT, r_i)), T.setv(t_b, T.item(L_UUA, r_i)), T.setv(t_c, T.item(L_UUB, r_i)),
    T.if_(T.eq(t_a, G.U_AMOUNT), T.if_(T.not_(T.lt(amt(t_b), t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.U_JOB), T.if_(T.and_(T.not_(T.lt(amt(t_b), t_c)), T.gt(amt(2), 0)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.U_COOKIES),
          T.if_(T.and_(T.not_(T.lt(baked, t_b)),
                       T.or_(T.eq(t_c, 0), T.eq(T.item(L_USTATE, t_c), 2))), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.U_HANDMADE), T.if_(T.not_(T.lt(handmade, t_b)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.U_MILK), T.if_(T.not_(T.lt(milk, t_b)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.U_GOLDEN), T.if_(T.not_(T.lt(gclicks, t_b)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.U_BINGO),
          T.if_(T.and_(T.not_(T.lt(amt(2), 6)), T.not_(T.lt(grand_types, 7))), T.setv(ok_v, 1))),
    T.if_(T.eq(ok_v, 1), T.replace(L_USTATE, r_i, 1), T.setv(dirty_up, 1)),
]
ach_check = [
    T.setv(ok_v, 0),
    T.setv(t_a, T.item(L_ATYPE, r_i)), T.setv(t_b, A(r_i)), T.setv(t_c, B(r_i)),
    T.if_(T.eq(t_a, G.A_BANK), T.if_(T.not_(T.lt(baked, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_CPS), T.if_(T.not_(T.lt(cps, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_HAVE), T.if_(T.not_(T.lt(amt(t_b), t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_MAKE), T.if_(T.not_(T.lt(T.item(L_BTOT, t_b), t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_HANDMADE), T.if_(T.not_(T.lt(handmade, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_GOLDEN), T.if_(T.not_(T.lt(gclicks, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_UPG), T.if_(T.and_(T.not_(T.lt(up_bought, t_b)), T.not_(T.lt(build_total, t_c))), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_MIN), T.if_(T.not_(T.lt(min_amt, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_GC), T.if_(T.not_(T.lt(build_total, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_KITTEN), T.if_(T.not_(T.lt(kittens_owned, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_TYPES), T.if_(T.not_(T.lt(grand_types, t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(t_a, G.A_GCUR), T.if_(T.not_(T.lt(T.add(amt(1), amt(2)), t_c)), T.setv(ok_v, 1))),
    T.if_(T.eq(ok_v, 1), win.call(r_i)),
]
T.body(
    check,
    T.setv(need_recalc, 0),
    T.setv(min_amt, amt(1)),
    *for_range(r_i, N, T.if_(T.lt(amt(r_i), min_amt), T.setv(min_amt, amt(r_i)))),
    *for_range(r_i, NU, T.if_(T.eq(T.item(L_USTATE, r_i), 0), *upg_unlock)),
    *for_range(r_i, NA, T.if_(T.eq(T.item(L_AWON, r_i), 0), *ach_check)),
    T.if_(T.eq(need_recalc, 1), recalc.call(), T.setv(dirty_up, 1)),
)

# --- ratón: +1 % del CpS por clic por cada raton --------------------------------------
mc_add = V("click add")
compute_mouse = T.defproc("computeMouse", [])
T.body(
    compute_mouse,
    T.setv(mc_add, T.add(T.mul(finger_add, non_cursor), T.mul(T.mul(mice, 0.01), cps_full))),
    T.setv(mouse_cps, T.mul(T.add(T.pow_(2, cursor_x2), mc_add), click_mult)),
)

# --- listas de tienda -------------------------------------------------------------------
build_store = T.defproc("buildStore", [])
T.body(
    build_store,
    T.delall(L_SHOP), T.setv(t_a, 0),
    *for_range(r_i, N,
               T.if_(T.eq(t_a, 0),
                     T.ifelse(T.or_(T.gt(amt(r_i), 0), T.not_(T.lt(baked, T.item(L_BBASEP, r_i)))),
                              [T.addto(L_SHOP, r_i)],
                              [T.addto(L_SHOP, T.sub(0, r_i)), T.setv(t_a, 1)]))),
    T.setv(shop_n, T.lsize(L_SHOP)),
    T.if_(T.gt(shop_off, T.max_(0, T.sub(shop_n, SH_ROWS))), T.setv(shop_off, T.max_(0, T.sub(shop_n, SH_ROWS)))),
    T.if_(T.eq(dirty_up, 1),
          T.setv(dirty_up, 0), T.delall(L_USHOW),
          *for_range(r_i, NU, T.if_(T.eq(T.item(L_USTATE, r_i), 1), T.addto(L_USHOW, r_i))),
          T.setv(up_n, T.lsize(L_USHOW)),
          T.setv(t_b, T.max_(0, T.sub(T.math("ceiling", T.div(up_n, UP_COLS)), UP_ROWS))),
          T.if_(T.gt(up_off, t_b), T.setv(up_off, t_b))),
)

# --- comprar / vender edificios, comprar mejoras ----------------------------------------
buy_b = T.defproc("buyBuilding", ["i"])
T.body(
    buy_b,
    T.setv(pcount, 0),
    T.setv(t_e, bulk),
    T.ifelse(T.eq(buy_mode, 1),
             [T.if_(T.eq(t_e, -1), T.setv(t_e, 1000)),
              T.repeat(t_e,
                       calc_price.call(buy_b.a("i")),
                       T.if_(T.not_(T.lt(cookies, price_v)),
                             T.chg(cookies, T.sub(0, price_v)),
                             T.lchg(L_BAMT, buy_b.a("i"), 1),
                             T.chg(pcount, 1))),
              T.if_(T.gt(pcount, 0), T.play(T.join("buy", T.rnd(1, 4))))],
             [T.if_(T.eq(t_e, -1), T.setv(t_e, T.item(L_BAMT, buy_b.a("i")))),
              T.repeat(t_e,
                       T.if_(T.gt(T.item(L_BAMT, buy_b.a("i")), 0),
                             calc_price.call(buy_b.a("i")),
                             T.chg(cookies, T.math("floor", T.mul(price_v, 0.25))),
                             T.if_(T.gt(cookies, baked), T.setv(baked, cookies)),
                             T.lchg(L_BAMT, buy_b.a("i"), -1),
                             T.chg(pcount, 1))),
              T.if_(T.gt(pcount, 0), T.play(T.join("sell", T.rnd(1, 4))),
                    T.if_(T.and_(T.eq(buy_b.a("i"), 2), T.eq(T.item(L_AWON, ACH_JUSTWRONG), 0)),
                          win.call(ACH_JUSTWRONG)))]),
    T.if_(T.gt(pcount, 0), recalc.call(), check.call(), recalc.call(), T.setv(dirty_up, 1)),
)

buy_u = T.defproc("buyUpgrade", ["u"])
T.body(
    buy_u,
    T.if_(T.and_(T.eq(T.item(L_USTATE, buy_u.a("u")), 1),
                 T.not_(T.lt(cookies, T.item(L_UPRICE, buy_u.a("u"))))),
          T.chg(cookies, T.sub(0, T.item(L_UPRICE, buy_u.a("u")))),
          T.replace(L_USTATE, buy_u.a("u"), 2),
          T.chg(up_bought, 1),
          T.play("upgrade"),
          recalc.call(), check.call(), T.setv(dirty_up, 1)),
)

# ======================================================================================
# Dibujo
# ======================================================================================
# tabla por edificio para las filas de la barra central
L_AW = P.lst("art spacing", [ART.get(b, {}).get("w", 0) for b in range(1, N + 1)])
L_AROWS = P.lst("art rows", [ART.get(b, {}).get("rows", 1) for b in range(1, N + 1)])
L_AXV = P.lst("art xv", [ART.get(b, {}).get("xV", 0) for b in range(1, N + 1)])
L_AYV = P.lst("art yv", [ART.get(b, {}).get("yV", 0) for b in range(1, N + 1)])
L_AX = P.lst("art x", [ART.get(b, {}).get("x", 0) for b in range(1, N + 1)])
L_AY = P.lst("art y", [ART.get(b, {}).get("y", 0) for b in range(1, N + 1)])
L_AFR = P.lst("art frames", [ART.get(b, {}).get("frames", 1) for b in range(1, N + 1)])
L_APIC = P.lst("art costume", [ART.get(b, {}).get("pic0", 0) for b in range(1, N + 1)])
L_ABG = P.lst("art background", [ART.get(b, {}).get("bg", 0) for b in range(1, N + 1)])
L_APW = P.lst("art sprite width", [ART.get(b, {}).get("pw", 64) for b in range(1, N + 1)])
L_APH = P.lst("art sprite height", [ART.get(b, {}).get("ph", 64) for b in range(1, N + 1)])
h1, h2, dummy = V("hash a"), V("hash b"), V("hash c")


def stamp_at(costume, x, y, size=100, ghost=None):
    out = [T.costume_to(costume), T.size_to(size)]
    if ghost is not None:
        out.append(T.effect("ghost", ghost))
    out += [T.goto(x, y), T.pen_stamp()]
    return out


# --- drawRow(b, slot): una fila de la barra central -------------------------------------
draw_row = T.defproc("drawRow", ["b", "slot"])
b_, slot_ = draw_row.a("b"), draw_row.a("slot")
rows_v, w_v = V("art rows now"), V("art w now")
T.body(
    draw_row,
    T.setv(r_y, T.sub(ROW_TOP, T.mul(ROW_H, slot_))),
    T.effect("ghost", 0),
    *stamp_at(T.item(L_ABG, b_), CEN_L + CEN_W / 2, T.sub(r_y, ROW_H / 2)),
    T.setv(rows_v, T.item(L_AROWS, b_)),
    T.setv(w_v, T.item(L_AW, b_)),
    T.setv(r_n, T.item(L_BAMT, b_)),
    T.setv(t_a, T.math("floor", T.add(T.div(CEN_W * 2, T.div(w_v, rows_v)), 1))),
    T.if_(T.gt(r_n, t_a), T.setv(r_n, t_a)),
    T.setv(t_d, 0),
    T.repeat(rows_v,
             T.setv(r_i, t_d),
             T.until(T.not_(T.lt(r_i, r_n)),
                     T.setv(h1, T.div(T.mod(T.add(T.mul(r_i, 7919), T.mul(b_, 104729)), 997), 997)),
                     T.setv(h2, T.div(T.mod(T.add(T.mul(r_i, 6151), T.mul(b_, 3331)), 991), 991)),
                     T.ifelse(T.eq(rows_v, 1),
                              [T.setv(r_px, T.add(T.add(T.mul(r_i, w_v), T.math("floor", T.mul(T.sub(h1, 0.5), T.item(L_AXV, b_)))),
                                                  T.item(L_AX, b_))),
                               T.setv(r_py, T.add(T.add(32, T.math("floor", T.mul(T.sub(h2, 0.5), T.item(L_AYV, b_)))),
                                                  T.item(L_AY, b_)))],
                              [T.setv(r_px, T.add(T.add(T.add(T.mul(T.math("floor", T.div(r_i, rows_v)), w_v),
                                                             T.mul(T.div(T.mod(r_i, rows_v), rows_v), w_v)),
                                                        T.math("floor", T.mul(T.sub(h1, 0.5), T.item(L_AXV, b_)))),
                                                  T.item(L_AX, b_))),
                               T.setv(r_py, T.add(T.add(T.add(32, T.math("floor", T.mul(T.sub(h2, 0.5), T.item(L_AYV, b_)))),
                                                         T.add(T.mul(rows_v, -8), T.mul(T.mod(r_i, rows_v), 16))),
                                                  T.item(L_AY, b_)))]),
                     T.setv(r_fr, T.mod(T.add(T.mul(r_i, 3), b_), T.item(L_AFR, b_))),
                     T.ifelse(T.eq(b_, 2),
                              [T.setv(r_k, T.item(L_GPICS, T.add(1, T.mod(T.add(T.mul(r_i, 7), 3), T.lsize(L_GPICS)))))],
                              [T.setv(r_k, T.add(T.item(L_APIC, b_), r_fr))]),
                     T.setv(t_c, T.item(L_APH, b_)),
                     T.if_(T.lt(r_py, 0), T.setv(r_py, 0)),
                     T.if_(T.gt(r_py, T.sub(96, t_c)), T.setv(r_py, T.sub(96, t_c))),
                     T.if_(T.not_(T.gt(T.add(r_px, T.item(L_APW, b_)), CEN_W * 2 + 8)),
                           T.costume_to(r_k),
                           T.goto(T.add(CEN_L, T.div(T.add(r_px, T.div(T.item(L_APW, b_), 2)), 2)),
                                  T.sub(r_y, T.div(T.add(r_py, T.div(t_c, 2)), 2))),
                           T.pen_stamp()),
                     T.chg(r_i, rows_v)),
             T.chg(t_d, 1)),
)

# --- botones pequenos con texto -------------------------------------------------------
btn = T.defproc("drawButton", ["kind", "x", "y", "label", "on"])
btn_w = {k: v for k, v in BTN_W.items()}


def draw_btn(kind, x, y, label, on_expr):
    return btn.call(C_BTN[kind], x, y, label, on_expr)


T.body(
    btn,
    T.size_to(100), T.effect("ghost", 0),
    T.costume_to(T.add(btn.a("kind"), btn.a("on"))),
    T.goto(btn.a("x"), btn.a("y")), T.pen_stamp(),
    draw_text.call(btn.a("label"), btn.a("x"), T.add(btn.a("y"), 0.5), 55, 1, "w"),
)


# --- datos del titular de noticias (titulares reales muestreados de Game.getNewTicker) ----
_news = json.load(open(os.path.join(HERE, "news.json")))
_norm = lambda t: __import__("re").sub(r"\d+", "#", t)
_entries, _seen = [], set()
for _t, _x in _news["general"]:
    if _norm(_x) not in _seen:
        _seen.add(_norm(_x))
        _entries.append((0, _t, _x))
for _bn, _lst in _news["buildings"].items():
    _bi = G.BIDX[_bn]
    for _x in _lst:
        if (_bn, _norm(_x)) not in _seen:
            _seen.add((_bn, _norm(_x)))
            _entries.append((_bi, 0, _x))


def _news_layout(x):
    x = G.ascii_(x)
    if len(x) <= 108:
        lines, size, nl = G.wrap(x, 54, 3)[:2] + [""], 62, 2
        rest = G.wrap(x, 54, 3)
        if rest[2]:
            lines, size, nl = G.wrap(x, 70, 3), 47, 3
    else:
        lines, size, nl = G.wrap(x, 70, 3), 47, 3
    return lines, size, nl


_lay = [_news_layout(e[2]) for e in _entries]
L_NCAT = P.lst("news category", [e[0] for e in _entries])
L_NMIN = P.lst("news min baked", [fl(e[1]) for e in _entries])
L_NSIZE = P.lst("news size", [l[1] for l in _lay])
L_NNL = P.lst("news lines", [l[2] for l in _lay])
L_NL = [P.lst(f"news line {k + 1}", [l[0][k] for l in _lay]) for k in range(3)]
L_NCATS = P.lst("news categories now", [])
L_NOK = P.lst("news eligible", [])
tick_cur, tick_t0, tick_clicks, nm_sz = V("news current"), V("news started"), V("news clicks"), V("name size")
rows_owned, news_try = V("rows owned"), V("news try")

# --- pickNews: categoria al azar (general + edificios comprados), luego un titular de esa categoria ---
pick_news = T.defproc("pickNews", [])
T.body(
    pick_news,
    T.delall(L_NCATS), T.addto(L_NCATS, 0),
    T.setv(r_b, 2),
    T.repeat(N - 1, T.if_(T.gt(T.item(L_BAMT, r_b), 0), T.addto(L_NCATS, r_b)), T.chg(r_b, 1)),
    T.setv(news_try, 0),
    T.setv(t_a, tick_cur),
    T.until(T.or_(T.gt(news_try, 0), T.eq(tick_cur, -1)),
            T.setv(t_c, T.item(L_NCATS, T.rnd(1, T.lsize(L_NCATS)))),
            T.delall(L_NOK),
            *for_range(r_i, len(_entries),
                       T.if_(T.eq(T.item(L_NCAT, r_i), t_c),
                             T.if_(T.or_(T.gt(t_c, 0), T.not_(T.lt(baked, T.item(L_NMIN, r_i)))), T.addto(L_NOK, r_i)))),
            T.if_(T.gt(T.lsize(L_NOK), 0),
                  T.setv(tick_cur, T.item(L_NOK, T.rnd(1, T.lsize(L_NOK)))),
                  T.if_(T.or_(T.ne(tick_cur, t_a), T.lt(T.lsize(L_NOK), 2)), T.setv(news_try, 1)))),
    T.setv(tick_t0, T.timer()),
)

# --- drawTicker: titular de noticias arriba (se desvanece; cambia cada 10 s o al hacer clic) ---
draw_ticker = T.defproc("drawTicker", [])
age_v, fade_v = V("news age"), V("news fade")
TK_Y = 165
T.body(
    draw_ticker,
    T.setv(age_v, T.sub(T.timer(), tick_t0)),
    T.if_(T.or_(T.lt(tick_cur, 1), T.gt(age_v, 10)), pick_news.call(), T.setv(age_v, 0)),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(TICK_CX, TK_Y, TICK_W / 2, 15)),
          T.setv(clk_ui, 0), pick_news.call(), T.setv(age_v, 0), T.chg(tick_clicks, 1),
          T.if_(T.eq(tick_clicks, 50), T.bcast("win tabloid"))),
    T.setv(fade_v, T.max_(0, T.min_(1, T.min_(T.mul(age_v, 2.5), T.mul(T.sub(10, age_v), 2.5))))),
    T.effect("ghost", T.mul(100, T.sub(1, fade_v))),
    T.setv(r_n, T.item(L_NNL, tick_cur)),
    T.ifelse(T.eq(r_n, 2),
             [draw_text.call(T.item(L_NL[0], tick_cur), TICK_CX, TK_Y + 6, T.item(L_NSIZE, tick_cur), 1, "w"),
              draw_text.call(T.item(L_NL[1], tick_cur), TICK_CX, TK_Y - 5, T.item(L_NSIZE, tick_cur), 1, "w")],
             [draw_text.call(T.item(L_NL[0], tick_cur), TICK_CX, TK_Y + 9.5, T.item(L_NSIZE, tick_cur), 1, "w"),
              draw_text.call(T.item(L_NL[1], tick_cur), TICK_CX, TK_Y, T.item(L_NSIZE, tick_cur), 1, "w"),
              draw_text.call(T.item(L_NL[2], tick_cur), TICK_CX, TK_Y - 9.5, T.item(L_NSIZE, tick_cur), 1, "w")]),
    T.effect("ghost", 0),
)

# --- drawCenter: botones Stats / Achievements, flechas y filas de edificios ---------------
btn_on = V("button on")
draw_center = T.defproc("drawCenter", [])
ST_X = CEN_L + 4 + BTN_W["stats"] / 2
AC_X = CEN_L + 4 + BTN_W["stats"] + 4 + BTN_W["wide"] / 2
CA_UP, CA_DN = CEN_L + CEN_W - 22, CEN_L + CEN_W - 8
T.body(
    draw_center,
    T.setv(btn_on, 0),
    T.if_(T.eq(ov_open, 2), T.setv(btn_on, 1)),
    T.if_(inside(ST_X, HDR_Y, BTN_W["stats"] / 2, 8), T.setv(btn_on, 1),
          T.if_(T.eq(clk_ui, 1), T.setv(ov_open, 2), T.setv(clk_ui, 0))),
    btn.call(C_BTN["stats"], ST_X, HDR_Y, "Stats", btn_on),
    T.setv(btn_on, 0),
    T.if_(T.eq(ov_open, 1), T.setv(btn_on, 1)),
    T.if_(inside(AC_X, HDR_Y, BTN_W["wide"] / 2, 8), T.setv(btn_on, 1),
          T.if_(T.eq(clk_ui, 1), T.setv(ov_open, 1), T.setv(clk_ui, 0))),
    btn.call(C_BTN["wide"], AC_X, HDR_Y, "Achievements", btn_on),
    T.setv(r_slot, 0), T.setv(r_k, 0), T.setv(r_b, 2),
    T.repeat(N - 1,
             T.if_(T.gt(T.item(L_BAMT, r_b), 0),
                   T.chg(r_k, 1),
                   T.if_(T.and_(T.gt(r_k, cen_off), T.lt(r_slot, CROWS)),
                         draw_row.call(r_b, r_slot), T.chg(r_slot, 1))),
             T.chg(r_b, 1)),
    T.setv(rows_owned, r_k),
    T.if_(T.gt(cen_off, T.max_(0, T.sub(rows_owned, CROWS))), T.setv(cen_off, T.max_(0, T.sub(rows_owned, CROWS)))),
    *stamp_at(C_ARR_UP, CA_UP, HDR_Y, 36, 0), *stamp_at(C_ARR_DN, CA_DN, HDR_Y, 36, 0),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(CA_UP, HDR_Y, 8, 8)),
          T.if_(T.gt(cen_off, 0), T.chg(cen_off, -1)), T.setv(clk_ui, 0)),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(CA_DN, HDR_Y, 8, 8)),
          T.if_(T.lt(cen_off, T.max_(0, T.sub(rows_owned, CROWS))), T.chg(cen_off, 1)), T.setv(clk_ui, 0)),
)

# --- drawUpgrades: cuadricula de mejoras (marcos de upgradeFrame.png) ---------------------
draw_up = T.defproc("drawUpgrades", [])
uk, uu, ucx, ucy = V("up slot"), V("up index"), V("up x"), V("up y")
afford_u = V("up affordable")
UA1, UA2 = R_X0 + SH_W - 12, R_X0 + SH_W + 6
UH_Y = 172
T.body(
    draw_up,
    T.effect("ghost", 0),
    draw_text.call("Upgrades", R_X0 + 5, UH_Y, 82, 0, "w"),
    *stamp_at(C_ARR_UP, UA1, UH_Y, 40, 0), *stamp_at(C_ARR_DN, UA2, UH_Y, 40, 0),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(UA1, UH_Y, 9, 9)),
          T.if_(T.gt(up_off, 0), T.chg(up_off, -1)), T.setv(clk_ui, 0)),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(UA2, UH_Y, 9, 9)),
          T.if_(T.lt(up_off, T.max_(0, T.sub(T.math("ceiling", T.div(up_n, UP_COLS)), UP_ROWS))),
                T.chg(up_off, 1)), T.setv(clk_ui, 0)),
    *for_range(
        uk, UP_COLS * UP_ROWS,
        T.setv(uu, T.add(T.mul(up_off, UP_COLS), uk)),
        T.if_(T.not_(T.gt(uu, up_n)),
              T.setv(uu, T.item(L_USHOW, uu)),
              T.setv(ucx, T.add(UP_X0, T.mul(UP_SP, T.mod(T.sub(uk, 1), UP_COLS)))),
              T.setv(ucy, T.sub(UP_Y0, T.mul(UP_SP, T.math("floor", T.div(T.sub(uk, 1), UP_COLS))))),
              T.ifelse(T.lt(cookies, T.item(L_UPRICE, uu)), [T.setv(afford_u, 0)], [T.setv(afford_u, 1)]),
              *stamp_at(C_CRATE_BG, ucx, ucy, UP_SZ, 0),
              T.if_(T.eq(afford_u, 0), T.effect("ghost", 55)),
              *stamp_at(T.item(L_UICON, uu), ucx, ucy, UP_SZ),
              T.effect("ghost", 0),
              T.ifelse(T.eq(afford_u, 1), [T.costume_to(C_FRAME_ON)], [T.costume_to(C_FRAME_OFF)]),
              T.if_(inside(ucx, ucy, UP_SP / 2, UP_SP / 2),
                    T.setv(hk, 1), T.setv(hi, uu), T.setv(hy, ucy),
                    T.if_(T.eq(afford_u, 1), T.costume_to(C_FRAME_HOV)),
                    T.if_(T.eq(clk_ui, 1), T.setv(clk_ui, 0), buy_u.call(uu))),
              T.size_to(UP_SZ), T.goto(ucx, ucy), T.pen_stamp())),
)

# --- drawShop: botones comprar/vender, filas de edificios y barra de desplazamiento -------
draw_shop = T.defproc("drawShop", [])
sk, sb_, sy_, sv_ = V("shop slot"), V("shop building"), V("shop y"), V("shop value")
locked_v, n_v = V("shop locked"), V("shop n")
btn_defs = [("buy", "Buy"), ("sell", "Sell"), ("b1", "1"), ("b10", "10"), ("b100", "100"), ("bmax", "Max")]
bx, cur = {}, R_X0 + 2
for key, label in btn_defs:
    w = BTN_W[key]
    bx[key] = cur + w / 2
    cur += w + 3
bsel = V("button selected")


def button_block(key, label, sel_expr, action):
    return [T.setv(bsel, 0), T.if_(sel_expr, T.setv(bsel, 1)),
            T.if_(inside(bx[key], BTN_Y, BTN_W[key] / 2, 8), T.setv(bsel, 1),
                  T.if_(T.eq(clk_ui, 1), T.setv(clk_ui, 0), *action)),
            btn.call(C_BTN[key], bx[key], BTN_Y, label, bsel)]


body = []
body += button_block("buy", "Buy", T.eq(buy_mode, 1), [T.setv(buy_mode, 1)])
body += button_block("sell", "Sell", T.eq(buy_mode, -1), [T.setv(buy_mode, -1)])
body += button_block("b1", "1", T.eq(bulk, 1), [T.setv(bulk, 1)])
body += button_block("b10", "10", T.eq(bulk, 10), [T.setv(bulk, 10)])
body += button_block("b100", "100", T.eq(bulk, 100), [T.setv(bulk, 100)])
body += button_block("bmax", "Max", T.eq(bulk, -1), [T.setv(bulk, -1)])
tile_x0 = SH_X - SH_W / 2
body += for_range(
    sk, SH_ROWS,
    T.setv(t_e, T.add(shop_off, sk)),
    T.if_(T.not_(T.gt(t_e, shop_n)),
          T.setv(sv_, T.item(L_SHOP, t_e)),
          T.setv(locked_v, 0),
          T.if_(T.lt(sv_, 0), T.setv(locked_v, 1)),
          T.setv(sb_, T.math("abs", sv_)),
          T.setv(sy_, T.sub(SH_Y0, T.mul(SH_SP, T.sub(sk, 1)))),
          T.ifelse(T.eq(buy_mode, 1),
                   [T.ifelse(T.eq(bulk, 1),
                             [calc_price.call(sb_), T.setv(n_v, 1)],
                             [T.ifelse(T.eq(bulk, -1),
                                       [max_buy.call(sb_), T.setv(n_v, T.max_(1, t_d)), sum_price.call(sb_, n_v)],
                                       [T.setv(n_v, bulk), sum_price.call(sb_, n_v)])]),
                    T.ifelse(T.lt(cookies, price_v), [T.setv(afford_v, 0)], [T.setv(afford_v, 1)])],
                   [T.setv(n_v, bulk), T.if_(T.eq(bulk, -1), T.setv(n_v, T.item(L_BAMT, sb_))),
                    sell_price.call(sb_, n_v),
                    T.ifelse(T.gt(T.item(L_BAMT, sb_), 0), [T.setv(afford_v, 1)], [T.setv(afford_v, 0)])]),
          T.if_(T.eq(locked_v, 1), T.setv(afford_v, 0)),
          T.effect("brightness", 0),
          T.ifelse(T.eq(afford_v, 1), [T.effect("ghost", 0)], [T.effect("ghost", 40)]),
          T.if_(T.eq(locked_v, 1), T.effect("ghost", 58)),
          T.if_(inside(SH_X, sy_, SH_W / 2, SH_ROW_H / 2), T.effect("brightness", 14)),
          *stamp_at(T.add(C_TILE, T.mod(T.sub(t_e, 1), 4)), SH_X, sy_, 100),
          T.effect("brightness", 0),
          T.costume_to(T.item(L_BICON, sb_)),
          T.if_(T.eq(locked_v, 1), T.effect("brightness", -100)),
          T.size_to(62), T.goto(tile_x0 + 22, sy_), T.pen_stamp(),
          T.effect("brightness", 0),
          T.ifelse(T.eq(locked_v, 1),
                   [draw_text.call("???", tile_x0 + 46, T.add(sy_, 8), 80, 0, "w")],
                   [T.setv(nm_sz, T.min_(80, T.div(1050, T.length(T.item(L_BNAME, sb_))))),
                    draw_text.call(T.item(L_BNAME, sb_), tile_x0 + 46, T.add(sy_, 8), nm_sz, 0, "w"),
                    fmt.call(price_v),
                    *stamp_at(C_MONEY, tile_x0 + 49, T.sub(sy_, 9), 100),
                    T.ifelse(T.eq(afford_v, 1),
                             [draw_text.call(fmt_out, tile_x0 + 56, T.sub(sy_, 9), 68, 0, "g")],
                             [draw_text.call(fmt_out, tile_x0 + 56, T.sub(sy_, 9), 68, 0, "r")]),
                    T.if_(T.gt(T.item(L_BAMT, sb_), 0),
                          draw_text.call(T.item(L_BAMT, sb_), tile_x0 + SH_W - 6, T.sub(sy_, 3), 150, 2, "W"))]),
          T.effect("ghost", 0),
          T.if_(inside(SH_X, sy_, SH_W / 2, SH_ROW_H / 2),
                T.setv(hk, 2), T.setv(hi, T.mul(sb_, T.sub(1, T.mul(2, locked_v)))), T.setv(hy, sy_),
                T.if_(T.and_(T.eq(clk_ui, 1), T.eq(locked_v, 0)), T.setv(clk_ui, 0), buy_b.call(sb_)))),
)
# barra de desplazamiento de la tienda (flechas, carril y deslizador)
TR_TOP, TR_BOT = SH_Y0 + 18, SH_Y0 - 5 * SH_SP - 18
sh_max = V("store max scroll")
body += [
    T.setv(sh_max, T.max_(0, T.sub(shop_n, SH_ROWS))),
    *stamp_at(C_TRACK, SB_X, (TR_TOP + TR_BOT) / 2, 100, 0),
    *stamp_at(C_ARR_UP, SB_X, TR_TOP + 9, 34, 0), *stamp_at(C_ARR_DN, SB_X, TR_BOT - 9, 34, 0),
    T.if_(T.gt(sh_max, 0),
          *stamp_at(C_THUMB, SB_X, T.sub(TR_TOP - 12, T.mul(T.div(shop_off, sh_max), (TR_TOP - TR_BOT) - 24)), 100, 0)),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(SB_X, TR_TOP + 9, 8, 9)),
          T.if_(T.gt(shop_off, 0), T.chg(shop_off, -1)), T.setv(clk_ui, 0)),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(SB_X, TR_BOT - 9, 8, 9)),
          T.if_(T.lt(shop_off, sh_max), T.chg(shop_off, 1)), T.setv(clk_ui, 0)),
    T.if_(T.and_(T.eq(clk_ui, 1), inside(SB_X, (TR_TOP + TR_BOT) / 2, 8, (TR_TOP - TR_BOT) / 2)),
          T.setv(shop_off, T.min_(sh_max, T.max_(0, T.round_(T.mul(T.div(T.sub(TR_TOP, my), TR_TOP - TR_BOT), sh_max))))),
          T.setv(clk_ui, 0)),
]
T.body(draw_shop, *body)

# --- drawLeft: banda del contador, leche, sombra, anillo de cursores y mejoras activas -------
draw_left = T.defproc("drawLeft", [])
ca, sa_, ring_r = V("cursor angle"), V("cursor sin"), V("cursor radius")
ring_n_ = V("cursor count")
ck_dist, ck_size = V("cookie distance"), V("cookie size", 100)
CK_S = 100 / 256                       # escala de la galleta (256 px reales -> 100 unidades)
body = [
    T.effect("ghost", 0),
    *stamp_at(C_BAND, LEFT_CX, 117, 100, 0),
    fmt.call(cookies),
    T.setv(t_d, T.min_(150, T.div(1300, T.length(fmt_out)))),
    draw_text.call(fmt_out, LEFT_CX, 127, t_d, 1, "W"),
    T.ifelse(T.eq(T.math("floor", cookies), 1),
             [draw_text.call("cookie", LEFT_CX, 108, 92, 1, "W")],
             [draw_text.call("cookies", LEFT_CX, 108, 92, 1, "W")]),
    fmt1.call(cps_full),
    T.setv(t_d, T.min_(70, T.div(1500, T.length(T.join("per second : ", fmt_out))))),
    draw_text.call(T.join("per second : ", fmt_out), LEFT_CX, 94, t_d, 1, "w"),
    T.if_(T.gt(milk, 0),
          T.setv(t_a, T.math("floor", milk)),
          T.if_(T.gt(t_a, N_MILK - 1), T.setv(t_a, N_MILK - 1)),
          T.setv(t_b, T.mul(T.min_(1, milk), 126)),
          *stamp_at(T.add(C_MILK0, t_a), LEFT_CX, T.sub(T.add(-180, t_b), T.mul(1.5, T.math("sin", T.mul(T.timer(), 40)))), 100, 4)),
    *stamp_at(C_SHADOW, LEFT_CX, CK_Y - 8, 100, 55),
    # galleta grande (dibujada con el lapiz para que los cuadros de ayuda queden por encima)
    T.setv(ck_dist, T.math("sqrt", T.add(T.mul(T.sub(mx, LEFT_CX), T.sub(mx, LEFT_CX)),
                                          T.mul(T.sub(my, CK_Y), T.sub(my, CK_Y))))),
    T.setv(t_a, 100),
    T.if_(T.and_(T.lt(ck_dist, 50), T.eq(ov_open, 0)),
          T.ifelse(T.mousedown(), [T.setv(t_a, 98)], [T.setv(t_a, 105)])),
    T.setv(ck_size, T.add(ck_size, T.mul(T.sub(t_a, ck_size), 0.45))),
    *stamp_at(C_COOKIE, LEFT_CX, CK_Y, ck_size, 0),
    T.if_(T.and_(T.lt(ck_dist, 50), T.eq(clk_ui, 1)), T.setv(clk_ui, 0), T.bcast("cookie click")),
    T.setv(ring_n_, T.item(L_BAMT, 1)),
    T.if_(T.gt(ring_n_, 250), T.setv(ring_n_, 250)),
    T.costume_to(C_CURSOR), T.size_to(100), T.effect("ghost", 0),
    *for_range(
        r_i, ring_n_,
        T.setv(t_a, T.sub(r_i, 1)),
        T.setv(ring_r, T.add(140, T.mul(16, T.math("floor", T.div(t_a, 50))))),
        T.setv(ca, T.sub(T.add(T.mul(7.2, r_i), T.mul(3.6, T.add(T.math("floor", T.div(t_a, 50)), 1))),
                         T.mul(T.timer(), 3))),
        T.goto(T.add(LEFT_CX, T.mul(CK_S, T.sub(T.mul(16, T.math("cos", ca)), T.mul(ring_r, T.math("sin", ca))))),
               T.add(CK_Y, T.mul(CK_S, T.sub(0, T.add(T.mul(16, T.math("sin", ca)), T.mul(ring_r, T.math("cos", ca))))))),
        T.direction_to(T.add(90, ca)),
        T.pen_stamp()),
    T.direction_to(90),
    T.setv(t_a, 76),
    T.if_(T.gt(frenzy_t, 0),
          fmt1.call(T.math("ceiling", frenzy_t)),
          draw_text.call(T.join("Frenzy x7 : ", T.join(fmt_out, "s")), LEFT_CX, t_a, 66, 1, "y"),
          T.chg(t_a, -13)),
    T.if_(T.gt(click_t, 0),
          fmt1.call(T.math("ceiling", click_t)),
          draw_text.call(T.join("Click frenzy x777 : ", T.join(fmt_out, "s")), LEFT_CX, t_a, 62, 1, "y"),
          T.chg(t_a, -13)),
    T.if_(T.gt(bb_t, 0),
          fmt1.call(T.math("ceiling", bb_t)),
          draw_text.call(T.join(T.item(L_BNAME, bb_idx), T.join(" x", T.join(T.round_(bb_pow), T.join(" : ", T.join(fmt_out, "s"))))),
                         LEFT_CX, t_a, 62, 1, "y"),
          T.chg(t_a, -13)),
    *stamp_at(C_PILL, LEFT_CX, -166, 100, 0),
    draw_text.call("Your bakery", LEFT_CX, -166, 88, 1, "W"),
]
T.body(draw_left, *body)

# --- particulas "+N" al hacer clic ------------------------------------------------------
draw_particles = T.defproc("drawParticles", [])
pk = V("particle index")
T.body(
    draw_particles,
    T.setv(pk, T.lsize(L_PT)),
    T.until(T.lt(pk, 1),
            T.replace(L_PT, pk, T.add(T.item(L_PT, pk), dt)),
            T.ifelse(T.gt(T.item(L_PT, pk), 1.4),
                     [T.delitem(L_PX, pk), T.delitem(L_PY, pk), T.delitem(L_PT, pk), T.delitem(L_PTXT, pk)],
                     [T.effect("ghost", T.mul(T.div(T.item(L_PT, pk), 1.4), 100)),
                      draw_text.call(T.item(L_PTXT, pk), T.item(L_PX, pk), T.add(T.item(L_PY, pk), T.mul(T.item(L_PT, pk), 40)),
                                     120, 1, "W")]),
            T.chg(pk, -1)),
    T.effect("ghost", 0),
)

# --- avisos (galleta dorada) y logros ---------------------------------------------------
draw_notices = T.defproc("drawNotices", [])
NY = -88
T.body(
    draw_notices,
    T.effect("ghost", 0),
    T.if_(T.and_(T.gt(notice_kind, 0), T.lt(T.timer(), notice_until)),
          T.ifelse(T.eq(notice_kind, 1),
                   [draw_text.call("Frenzy!", LEFT_CX, NY, 130, 1, "Y"),
                    draw_text.call("Cookie production x7 for a while!", LEFT_CX, NY - 17, 62, 1, "y")],
                   [T.ifelse(T.eq(notice_kind, 2),
                             [fmt.call(notice_gain),
                              draw_text.call("Lucky!", LEFT_CX, NY, 130, 1, "Y"),
                              draw_text.call(T.join("+", T.join(fmt_out, " cookies!")), LEFT_CX, NY - 17, 66, 1, "y")],
                             [T.ifelse(T.eq(notice_kind, 3),
                                       [draw_text.call("Click frenzy!", LEFT_CX, NY, 110, 1, "Y"),
                                        draw_text.call("Clicking power x777 for a while!", LEFT_CX, NY - 17, 62, 1, "y")],
                                       [draw_text.call("Building special!", LEFT_CX, NY, 100, 1, "Y"),
                                        draw_text.call(T.join(T.item(L_BNAME, bb_idx), " production boosted!"),
                                                       LEFT_CX, NY - 17, 62, 1, "y")])])])),
    T.if_(T.lt(T.timer(), toast_until),
          *stamp_at(C_TOAST, LEFT_CX, -130),
          *stamp_at(toast_icon, LEFT_CX - MILK_W / 2 + 18, -130, 44),
          draw_text.call("Achievement unlocked", LEFT_CX - MILK_W / 2 + 38, -122, 56, 0, "y"),
          T.setv(nm_sz, T.min_(70, T.div(900, T.length(toast_text)))),
          draw_text.call(toast_text, LEFT_CX - MILK_W / 2 + 38, -137, nm_sz, 0, "w")),
)

# --- overlay de logros ------------------------------------------------------------------
draw_overlay = T.defproc("drawOverlay", [])
ok_, ox, oy, oi = V("ov slot"), V("ov x"), V("ov y"), V("ov index")
OV_COLS, OV_ROWS, OV_SP = 11, 12, 25.5
OV_X0, OV_Y0 = OV_CX - OV_COLS * OV_SP / 2 + OV_SP / 2, 138
OV_L = OV_CX - OV_W / 2 + 8
T.body(
    draw_overlay,
    *stamp_at(C_OVER, OV_CX, 0, 100, 0),
    draw_text.call(T.join("Achievements : ", T.join(ach_count, T.join(" / ", T.join(NA, T.join("   Milk : ", T.join(T.round_(T.mul(milk, 100)), "%")))))),
                   OV_L, 168, 76, 0, "w"),
    draw_btn("wide", OV_CX, -168, "Close", 0),
    T.if_(T.and_(T.eq(clk, 1), inside(OV_CX, -168, BTN_W["wide"] / 2, 8)), T.setv(ov_open, 0), T.setv(clk, 0)),
    *stamp_at(C_ARR_UP, OV_CX + 100, 170, 40, 0), *stamp_at(C_ARR_DN, OV_CX + 120, 170, 40, 0),
    T.if_(T.and_(T.eq(clk, 1), inside(OV_CX + 100, 170, 9, 9)), T.if_(T.gt(ov_off, 0), T.chg(ov_off, -1)), T.setv(clk, 0)),
    T.if_(T.and_(T.eq(clk, 1), inside(OV_CX + 120, 170, 9, 9)),
          T.if_(T.lt(ov_off, T.max_(0, T.sub(T.math("ceiling", T.div(NA, OV_COLS)), OV_ROWS))), T.chg(ov_off, 1)),
          T.setv(clk, 0)),
    *for_range(
        ok_, OV_COLS * OV_ROWS,
        T.setv(oi, T.add(T.mul(ov_off, OV_COLS), ok_)),
        T.if_(T.not_(T.gt(oi, NA)),
              T.setv(ox, T.add(OV_X0, T.mul(OV_SP, T.mod(T.sub(ok_, 1), OV_COLS)))),
              T.setv(oy, T.sub(OV_Y0, T.mul(OV_SP, T.math("floor", T.div(T.sub(ok_, 1), OV_COLS))))),
              T.ifelse(T.eq(T.item(L_AWON, oi), 1),
                       [*stamp_at(T.item(L_AICON, oi), ox, oy, 46, 0), T.costume_to(C_FRAME_ON)],
                       [*stamp_at(C_CRATE_BG, ox, oy, 42, 0),
                        *stamp_at(T.item(L_AICON, oi), ox, oy, 46, 80), T.effect("ghost", 0),
                        T.costume_to(C_FRAME_OFF)]),
              T.size_to(42), T.goto(ox, oy), T.pen_stamp(),
              T.if_(inside(ox, oy, OV_SP / 2, OV_SP / 2), T.setv(hk, 3), T.setv(hi, oi), T.setv(hy, oy)))),
)

# --- panel de estadisticas ---------------------------------------------------------------
draw_stats = T.defproc("drawStats", [])
st_y = V("stats y")
STAT_L, STAT_R = OV_L, OV_CX + OV_W / 2 - 10


def stat_line(label, calls):
    return [draw_text.call(label, STAT_L, st_y, 74, 0, "w"), *calls, T.chg(st_y, -15)]


def sv(expr):
    return draw_text.call(expr, STAT_R, st_y, 74, 2, "y")


T.body(
    draw_stats,
    *stamp_at(C_OVER, OV_CX, 0, 100, 0),
    draw_text.call("Stats", OV_L, 166, 110, 0, "W"),
    draw_btn("wide", OV_CX, -168, "Close", 0),
    T.if_(T.and_(T.eq(clk, 1), inside(OV_CX, -168, BTN_W["wide"] / 2, 8)), T.setv(ov_open, 0), T.setv(clk, 0)),
    compute_mouse.call(),
    T.setv(st_y, 136),
    *stat_line("Cookies in bank", [fmt.call(cookies), sv(fmt_out)]),
    *stat_line("Cookies baked (all time)", [fmt.call(baked), sv(fmt_out)]),
    *stat_line("Cookies per second", [fmt1.call(cps_full), sv(fmt_out)]),
    *stat_line("Cookies per click", [fmt1.call(mouse_cps), sv(fmt_out)]),
    *stat_line("Hand-made cookies", [fmt.call(handmade), sv(fmt_out)]),
    *stat_line("Cookie clicks", [fmt.call(clicks), sv(fmt_out)]),
    *stat_line("Golden cookies clicked", [sv(gclicks)]),
    *stat_line("Buildings owned", [fmt.call(build_total), sv(fmt_out)]),
    *stat_line("Upgrades owned", [sv(T.join(up_bought, T.join(" / ", NU)))]),
    *stat_line("Achievements", [sv(T.join(ach_count, T.join(" / ", NA)))]),
    *stat_line("Milk", [sv(T.join(T.round_(T.mul(milk, 100)), "%"))]),
    *stat_line("Golden cookie frequency", [sv(T.join("x", gold_freq))]),
)

# --- tooltip ----------------------------------------------------------------------------
draw_tip = T.defproc("drawTooltip", [])
tl1, tl2, tl3 = V("tip line 1"), V("tip line 2"), V("tip line 3")
tip_each, tip_tot, tip_pct, tip_ns = V("tip each"), V("tip total"), V("tip percent"), V("tip name size")
TIP_CX = TIP_RX - TIP_W / 2
TIP_L = TIP_RX - TIP_W + 9
TS = 60                                                   # tamano del texto de las descripciones
tip_body = [
    T.effect("ghost", 0),
    T.setv(tip_top, T.add(T.min_(T.max_(hy, -180 + TIP_H / 2), 180 - TIP_H / 2), TIP_H / 2)),
    *stamp_at(C_TIP, TIP_CX, T.sub(tip_top, TIP_H / 2)),
    # --- mejora
    T.if_(T.eq(hk, 1),
          *stamp_at(T.item(L_UICON, hi), TIP_L + 17, T.sub(tip_top, 25), 56),
          T.setv(tip_ns, T.min_(80, T.div(2300, T.length(T.item(L_UNAME, hi))))),
          draw_text.call(T.item(L_UNAME, hi), TIP_L + 40, T.sub(tip_top, 15), tip_ns, 0, "w"),
          fmt.call(T.item(L_UPRICE, hi)),
          T.ifelse(T.lt(cookies, T.item(L_UPRICE, hi)),
                   [draw_text.call(fmt_out, TIP_RX - 9, T.sub(tip_top, 33), 72, 2, "r")],
                   [draw_text.call(fmt_out, TIP_RX - 9, T.sub(tip_top, 33), 72, 2, "g")]),
          draw_text.call("[Upgrade]", TIP_L + 40, T.sub(tip_top, 33), 58, 0, "y"),
          draw_text.call(T.item(L_UD[0], hi), TIP_L, T.sub(tip_top, 55), TS, 0, "w"),
          draw_text.call(T.item(L_UD[1], hi), TIP_L, T.sub(tip_top, 68), TS, 0, "w"),
          draw_text.call(T.item(L_UD[2], hi), TIP_L, T.sub(tip_top, 81), TS, 0, "w")),
    # --- edificio
    T.if_(T.eq(hk, 2),
          T.setv(tip_each, T.mul(T.item(L_BEACH, hi), T.mul(gmult, T.mul(cat_mult, buff_mult)))),
          T.setv(tip_tot, T.mul(tip_each, T.item(L_BAMT, hi))),
          T.setv(tip_pct, 0),
          T.if_(T.gt(cps_full, 0), T.setv(tip_pct, T.round_(T.mul(T.div(tip_tot, cps_full), 100)))),
          *stamp_at(T.item(L_BICON, hi), TIP_L + 17, T.sub(tip_top, 25), 56),
          draw_text.call(T.item(L_BNAME, hi), TIP_L + 40, T.sub(tip_top, 15), 80, 0, "w"),
          calc_price.call(hi), fmt.call(price_v),
          T.ifelse(T.lt(cookies, price_v),
                   [draw_text.call(fmt_out, TIP_RX - 9, T.sub(tip_top, 33), 72, 2, "r")],
                   [draw_text.call(fmt_out, TIP_RX - 9, T.sub(tip_top, 33), 72, 2, "g")]),
          draw_text.call(T.join("owned : ", T.item(L_BAMT, hi)), TIP_L + 40, T.sub(tip_top, 33), 58, 0, "y"),
          fmt1.call(tip_each),
          T.setv(tl1, T.join("each ", T.join(T.item(L_BSING, hi), T.join(" produces ", T.join(fmt_out, " cookies per second"))))),
          draw_text.call(tl1, TIP_L, T.sub(tip_top, 55), TS, 0, "w"),
          T.if_(T.gt(T.item(L_BAMT, hi), 0),
                fmt1.call(tip_tot),
                T.setv(tl2, T.join(T.item(L_BAMT, hi), T.join(" ", T.join(T.item(L_BPLUR, hi), T.join(" producing ", T.join(fmt_out, " cookies per second")))))),
                draw_text.call(tl2, TIP_L, T.sub(tip_top, 68), TS, 0, "w"),
                draw_text.call(T.join("(", T.join(tip_pct, "% of total CpS)")), TIP_L, T.sub(tip_top, 81), TS, 0, "w"),
                fmt.call(T.item(L_BTOT, hi)),
                draw_text.call(T.join(fmt_out, " cookies produced so far"), TIP_L, T.sub(tip_top, 94), TS, 0, "w"))),
    # --- logro
    T.if_(T.eq(hk, 3),
          T.setv(tl1, T.item(L_AD[0], hi)), T.setv(tl2, T.item(L_AD[1], hi)),
          T.setv(t_a, T.item(L_ATYPE, hi)),
          T.if_(T.or_(T.eq(t_a, G.A_BANK), T.or_(T.eq(t_a, G.A_CPS), T.eq(t_a, G.A_MAKE))),
                fmt.call(T.item(L_AB, hi)),
                T.setv(tl2, ""),
                T.if_(T.eq(t_a, G.A_BANK), T.setv(tl1, T.join("Bake ", T.join(fmt_out, " cookies in one ascension.")))),
                T.if_(T.eq(t_a, G.A_CPS), T.setv(tl1, T.join("Bake ", T.join(fmt_out, " cookies per second.")))),
                T.if_(T.eq(t_a, G.A_MAKE),
                      T.setv(tl1, T.join("Make ", T.join(fmt_out, T.join(" just from ", T.join(T.item(L_BPLUR, T.item(L_AA, hi)), "."))))))),
          T.ifelse(T.eq(T.item(L_AWON, hi), 1),
                   [*stamp_at(T.item(L_AICON, hi), TIP_L + 17, T.sub(tip_top, 25), 56),
                    T.setv(tip_ns, T.min_(80, T.div(2300, T.length(T.item(L_ANAME, hi))))),
                    draw_text.call(T.item(L_ANAME, hi), TIP_L + 40, T.sub(tip_top, 15), tip_ns, 0, "w"),
                    draw_text.call("[Achievement]", TIP_L + 40, T.sub(tip_top, 33), 58, 0, "y"),
                    draw_text.call(tl1, TIP_L, T.sub(tip_top, 55), TS, 0, "w"),
                    draw_text.call(tl2, TIP_L, T.sub(tip_top, 68), TS, 0, "w")],
                   [*stamp_at(C_UNKNOWN, TIP_L + 17, T.sub(tip_top, 25), 56),
                    draw_text.call("???", TIP_L + 40, T.sub(tip_top, 15), 80, 0, "w"),
                    draw_text.call("[Locked]", TIP_L + 40, T.sub(tip_top, 33), 58, 0, "r"),
                    draw_text.call(tl1, TIP_L, T.sub(tip_top, 55), TS, 0, "w"),
                    draw_text.call(tl2, TIP_L, T.sub(tip_top, 68), TS, 0, "w")])),
]
T.body(draw_tip, *tip_body)

# --- render -------------------------------------------------------------------------------
render = T.defproc("render", [])
T.body(
    render,
    T.show(), T.pen_clear(), T.clear_effects(),
    T.setv(hk, 0), T.setv(hi, 0),
    T.setv(mx, T.mousex()), T.setv(my, T.mousey()),
    T.setv(clk_ui, clk),
    T.if_(T.gt(ov_open, 0), T.setv(clk_ui, 0)),
    build_store.call(),
    draw_ticker.call(),
    draw_left.call(),
    draw_center.call(),
    draw_up.call(),
    draw_shop.call(),
    draw_particles.call(),
    draw_notices.call(),
    T.if_(T.eq(ov_open, 1), draw_overlay.call()),
    T.if_(T.eq(ov_open, 2), draw_stats.call()),
    T.if_(T.gt(hk, 0), draw_tip.call()),
    T.hide(),
)

# ======================================================================================
# Bucle principal y eventos
# ======================================================================================
init = [
    T.setv(cookies, 0), T.setv(baked, 0), T.setv(handmade, 0), T.setv(clicks, 0), T.setv(gclicks, 0),
    T.setv(ach_count, 0), T.setv(up_bought, 0), T.setv(milk, 0),
    T.setv(buff_mult, 1), T.setv(click_mult, 1), T.setv(frenzy_t, 0), T.setv(click_t, 0), T.setv(bb_t, 0),
    T.setv(buy_mode, 1), T.setv(bulk, 1), T.setv(shop_off, 0), T.setv(up_off, 0), T.setv(cen_off, 0),
    T.setv(ov_open, 0), T.setv(ov_off, 0), T.setv(was_down, 0), T.setv(clk, 0), T.setv(dirty_up, 1),
    T.setv(toast_until, 0), T.setv(notice_until, 0), T.setv(notice_kind, 0), T.setv(need_recalc, 0),
    T.setv(chk_t, 0), T.setv(tick_cur, 0), T.setv(tick_clicks, 0), T.setv(tick_t0, 0),
    *[T.delall(l) for l in (L_BAMT, L_BTOT, L_BTIER, L_BJOB, L_BBUFF, L_BEACH, L_USTATE, L_AWON, L_PX, L_PY, L_PT, L_PTXT)],
    T.repeat(N, T.addto(L_BAMT, 0), T.addto(L_BTOT, 0), T.addto(L_BTIER, 0), T.addto(L_BJOB, 0),
             T.addto(L_BBUFF, 1), T.addto(L_BEACH, 0)),
    T.repeat(NU, T.addto(L_USTATE, 0)),
    T.repeat(NA, T.addto(L_AWON, 0)),
    T.rotstyle("all around"),
    recalc.call(), check.call(),
    T.reset_timer(), T.setv(last_t, 0),
]
reset_all = T.defproc("resetGame", [])
T.body(reset_all, *init)
production_loop = for_range(
    r_i, N,
    T.lchg(L_BTOT, r_i, T.mul(T.mul(T.mul(T.item(L_BEACH, r_i), T.item(L_BAMT, r_i)),
                                    T.mul(T.mul(gmult, cat_mult), buff_mult)), dt)))
tick = T.defproc("tick", [])
T.body(
    tick,
    T.setv(dt, T.sub(T.timer(), last_t)),
        T.setv(last_t, T.timer()),
        T.if_(T.gt(dt, 0.25), T.setv(dt, 0.25)),
        # buffs
        T.if_(T.gt(frenzy_t, 0), T.chg(frenzy_t, T.sub(0, dt))),
        T.ifelse(T.gt(frenzy_t, 0), [T.setv(buff_mult, 7)], [T.setv(frenzy_t, 0), T.setv(buff_mult, 1)]),
        T.if_(T.gt(click_t, 0), T.chg(click_t, T.sub(0, dt))),
        T.ifelse(T.gt(click_t, 0), [T.setv(click_mult, 777)], [T.setv(click_t, 0), T.setv(click_mult, 1)]),
        T.if_(T.gt(bb_t, 0),
              T.chg(bb_t, T.sub(0, dt)),
              T.if_(T.not_(T.gt(bb_t, 0)),
                    T.setv(bb_t, 0), T.replace(L_BBUFF, bb_idx, 1), recalc.call())),
        # produccion
        T.setv(cps_full, T.mul(cps, buff_mult)),
        T.chg(cookies, T.mul(cps_full, dt)),
        T.chg(baked, T.mul(cps_full, dt)),
        *production_loop,
        # comprobaciones periodicas (mejoras y logros)
        T.chg(chk_t, dt),
        T.if_(T.gt(chk_t, 0.25), T.setv(chk_t, 0), check.call()),
        # flanco de pulsacion del raton
        T.setv(clk, 0),
        T.ifelse(T.mousedown(),
                 [T.if_(T.eq(was_down, 0), T.setv(was_down, 1), T.setv(clk, 1))],
                 [T.setv(was_down, 0)]),
)
h = T.whenflag()
T.script(h, reset_all.call(), T.forever(tick.call(), render.call()))

# clic en la galleta (lo difunde el sprite "Big cookie")
h = T.whenbcast("cookie click")
T.script(
    h,
    compute_mouse.call(),
    T.chg(cookies, mouse_cps), T.chg(baked, mouse_cps), T.chg(handmade, mouse_cps), T.chg(clicks, 1),
    fmt.call(mouse_cps),
    T.addto(L_PX, T.add(T.mousex(), T.rnd(-14, 14))), T.addto(L_PY, T.sub(T.mousey(), 8)),
    T.addto(L_PT, 0), T.addto(L_PTXT, T.join("+", fmt_out)),
    T.if_(T.gt(T.lsize(L_PT), 14), T.delitem(L_PX, 1), T.delitem(L_PY, 1), T.delitem(L_PT, 1), T.delitem(L_PTXT, 1)),
    T.play(T.join("click", T.rnd(1, 7))),
)

# logros que dependen de eventos de la galleta dorada y gancho de pruebas
h = T.whenbcast("win early bird")
T.script(h, win.call(ACH_IDX["Early bird"]))
h = T.whenbcast("win tabloid")
T.script(h, win.call(ACH_IDX["Tabloid addiction"]))
h = T.whenbcast("win fading luck")
T.script(h, win.call(ACH_IDX["Fading luck"]))
h = T.whenbcast("recalc")
T.script(h, recalc.call(), check.call(), recalc.call())
h = T.whenbcast("test buy")
T.script(h, buy_b.call(hi))
h = T.whenbcast("recalc only")
T.script(h, recalc.call(), compute_mouse.call())

# desplazamiento con el teclado
for key, delta in (("up arrow", -1), ("down arrow", 1)):
    h = T.whenkey(key)
    T.script(
        h,
        T.ifelse(T.gt(ov_open, 0),
                 [T.setv(ov_off, T.min_(T.max_(0, T.add(ov_off, delta)),
                                        T.max_(0, T.sub(T.math("ceiling", T.div(NA, 12)), 12))))],
                 [T.ifelse(T.gt(T.mousex(), R_X0),
                           [T.setv(shop_off, T.min_(T.max_(0, T.add(shop_off, delta)), T.max_(0, T.sub(shop_n, SH_ROWS))))],
                           [T.if_(T.gt(T.mousex(), CEN_L),
                                  T.setv(cen_off, T.min_(T.max_(0, T.add(cen_off, delta)), T.max_(0, T.sub(T.sub(N, 1), CROWS)))))])]),
    )

# ======================================================================================
# Sprite "Golden cookie": Frenzy, Lucky, Click frenzy y Building special
# ======================================================================================
gold = Target(P, "Golden cookie")
gold.visible = False
gold.costumes = [P.costume("goldCookie", load("goldCookie.png"), 2)]
gold.sounds = [P.sound("shimmerClick", os.path.join(SND, "shimmerClick.mp3")),
               P.sound("chime", os.path.join(SND, "chime.mp3"))]
g_clicked, g_t0, g_dur, g_frac = V("golden clicked"), V("golden t0"), V("golden duration now"), V("golden fraction")
g_n, g_k, g_eff, g_cand, g_pick, g_r = V("golden choices"), V("golden k"), V("golden effect"), V("golden candidates"), V("golden pick"), V("golden roll")
g_click_opt, g_build_opt, g_i, g_exclude = V("golden click opt"), V("golden building opt"), V("golden i"), V("golden exclude")
g_time = V("golden wait")
EFF_FRENZY, EFF_LUCKY, EFF_CLICK, EFF_BUILD = 1, 2, 3, 4

# efecto elegido: frenzy, lucky, (click frenzy 10 %), (building special 25 % con >= 10 edificios en total)
G_ = gold
g_amt = lambda i: gold.item(L_BAMT, i)


def g_for(var, n, *body):
    return [G_.setv(var, 1), G_.repeat(n, *body, G_.chg(var, 1))]


pick_effect = [
    G_.setv(g_click_opt, 0), G_.setv(g_build_opt, 0),
    G_.if_(G_.lt(G_.rnd(1, 100), 11), G_.setv(g_click_opt, 1)),
    G_.if_(G_.and_(G_.not_(G_.lt(build_total, 10)), G_.lt(G_.rnd(1, 100), 26)), G_.setv(g_build_opt, 1)),
    G_.setv(g_n, G_.add(G_.add(2, g_click_opt), g_build_opt)),
    G_.setv(g_exclude, 0),
    G_.if_(G_.lt(G_.rnd(1, 100), 81), G_.setv(g_exclude, 1)),
    G_.setv(g_eff, gold_last),
    G_.until(G_.or_(G_.eq(g_exclude, 0), G_.ne(g_eff, gold_last)),
             G_.setv(g_k, G_.rnd(1, g_n)),
             G_.setv(g_eff, g_k),
             G_.if_(G_.eq(g_k, 3), G_.ifelse(G_.eq(g_click_opt, 1), [G_.setv(g_eff, EFF_CLICK)], [G_.setv(g_eff, EFF_BUILD)])),
             G_.if_(G_.eq(g_k, 4), G_.setv(g_eff, EFF_BUILD))),
    G_.setv(gold_last, g_eff),
]
apply_effect = [
    G_.setv(notice_until, G_.add(G_.timer(), 6)),
    G_.setv(notice_kind, g_eff),
    G_.if_(G_.eq(g_eff, EFF_FRENZY), G_.setv(frenzy_t, G_.math("ceiling", G_.mul(77, eff_dur)))),
    G_.if_(G_.eq(g_eff, EFF_LUCKY),
           G_.setv(notice_gain, G_.mul(cookies, 0.15)),
           G_.if_(G_.gt(notice_gain, G_.mul(cps_full, 900)), G_.setv(notice_gain, G_.mul(cps_full, 900))),
           G_.chg(notice_gain, 13),
           G_.chg(cookies, notice_gain), G_.chg(baked, notice_gain)),
    G_.if_(G_.eq(g_eff, EFF_CLICK), G_.setv(click_t, G_.math("ceiling", G_.mul(13, eff_dur)))),
    G_.if_(G_.eq(g_eff, EFF_BUILD),
           G_.setv(g_cand, 0),
           *g_for(g_i, N, G_.if_(G_.not_(G_.lt(g_amt(g_i), 10)), G_.chg(g_cand, 1))),
           G_.setv(g_pick, G_.rnd(1, g_cand)),
           G_.setv(g_cand, 0),
           *g_for(g_i, N, G_.if_(G_.not_(G_.lt(g_amt(g_i), 10)),
                                 G_.chg(g_cand, 1),
                                 G_.if_(G_.eq(g_cand, g_pick), G_.setv(bb_idx, g_i)))),
           G_.setv(bb_pow, G_.add(G_.div(g_amt(bb_idx), 10), 1)),
           G_.setv(bb_t, G_.math("ceiling", G_.mul(30, eff_dur))),
           G_.replace(L_BBUFF, bb_idx, bb_pow),
           G_.bcast("recalc")),
]
h = gold.whenflag()
gold.script(
    h, gold.hide(), gold.size_to(120), gold.setv(gold_last, 0),
    gold.forever(
        gold.setv(g_time, gold.div(gold.rnd(*((1, 2) if FAST else (300, 900))), gold_freq)),
        gold.wait(g_time),
        gold.goto(gold.rnd(-215, 30), gold.rnd(-120, 130)),
        gold.setv(g_clicked, 0),
        gold.setv(g_dur, gold.mul(13, gold_dur)),
        gold.effect("ghost", 100), gold.show(),
        gold.setv(g_t0, gold.timer()),
        gold.until(gold.or_(gold.eq(g_clicked, 1), gold.not_(gold.lt(gold.sub(gold.timer(), g_t0), g_dur))),
                   gold.setv(g_frac, gold.div(gold.sub(gold.timer(), g_t0), g_dur)),
                   gold.effect("ghost", gold.mul(100, gold.mul(gold.mul(gold.math("abs", gold.sub(gold.mul(2, g_frac), 1)),
                                                                        gold.math("abs", gold.sub(gold.mul(2, g_frac), 1))),
                                                              gold.mul(gold.math("abs", gold.sub(gold.mul(2, g_frac), 1)),
                                                                       gold.math("abs", gold.sub(gold.mul(2, g_frac), 1)))))),
                   gold.size_to(gold.add(120, gold.mul(6, gold.math("sin", gold.mul(gold.timer(), 200))))),
                   gold.direction_to(gold.add(90, gold.mul(12, gold.math("sin", gold.mul(gold.timer(), 60)))))),
        gold.if_(gold.eq(g_clicked, 1),
                 gold.play("shimmerClick"),
                 gold.chg(gclicks, 1),
                 gold.if_(gold.lt(gold.mul(g_frac, g_dur), 1), gold.bcast("win early bird")),
                 gold.if_(gold.lt(gold.sub(g_dur, gold.mul(g_frac, g_dur)), 1), gold.bcast("win fading luck")),
                 *pick_effect, *apply_effect),
        gold.hide(),
    ),
)
h = gold.whenclicked()
gold.script(h, gold.setv(g_clicked, 1))

# ======================================================================================
# Ensamblado
# ======================================================================================
targets = [stage.to_json(0), ui.to_json(1), gold.to_json(2)]
P.write(OUT, targets)
nblocks = sum(len(t["blocks"]) for t in targets)
print(f"{OUT}: {os.path.getsize(OUT) / 1024:.0f} KB, {nblocks} bloques, {len(P.assets)} recursos, "
      f"{NU} mejoras, {NA} logros, {len(ui.costumes)} disfraces en 'Texto'")
