"""Clasifica las mejoras y logros reales del juego (sb3/game_data.json) en familias con efecto
implementable en Scratch, y los devuelve como tablas listas para volcar en listas del proyecto."""
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "game_data.json")))

OBJS = D["objs"]                                   # ids 0..19 (en Scratch: indices 1..20)
N = len(OBJS)
BIDX = {o["name"]: i + 1 for i, o in enumerate(OBJS)}
UPS = D["ups"]
BYNAME = {u["name"]: u for u in UPS}
UNLOCK_AT = {x["name"]: x for x in D["unlockAt"]}
TIERS = {str(k): v for k, v in D["tiers"].items()}

# tipos de mejora (uType)
T_TIER, T_CURSOR2, T_FINGER, T_MOUSE, T_JOB, T_KITTEN, T_COOKIE, T_GOLD, T_BINGO = range(1, 10)
# tipos de desbloqueo (uUT)
U_AMOUNT, U_JOB, U_COOKIES, U_HANDMADE, U_MILK, U_GOLDEN, U_BINGO = range(1, 8)

FINGERS = ["Thousand fingers", "Million fingers", "Billion fingers", "Trillion fingers", "Quadrillion fingers",
           "Quintillion fingers", "Sextillion fingers", "Septillion fingers", "Octillion fingers",
           "Nonillion fingers", "Decillion fingers", "Undecillion fingers"]
FINGER_FACTOR = [0, 5, 10, 20, 20, 20, 20, 20, 20, 20, 20, 20]       # el primero suma 0.1
FINGER_UNLOCK = [25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550]
CURSOR2 = [("Reinforced index finger", 1), ("Carpal tunnel prevention cream", 1), ("Ambidextrous", 10)]
MICE = ["Plastic mouse", "Iron mouse", "Titanium mouse", "Adamantium mouse", "Unobtainium mouse", "Eludium mouse",
        "Wishalloy mouse", "Fantasteel mouse", "Nevercrack mouse", "Armythril mouse", "Technobsidian mouse",
        "Plasmarble mouse", "Miraculite mouse", "Aetherice mouse", "Omniplast mouse"]
MOUSE_UNLOCK = [10 ** 3, 10 ** 5, 10 ** 7, 10 ** 9, 10 ** 11, 10 ** 13, 10 ** 15, 10 ** 17, 10 ** 19, 10 ** 21,
                10 ** 23, 10 ** 25, 10 ** 27, 10 ** 29, 10 ** 31]
KITTENS = [("Kitten helpers", 0.1, 0.5), ("Kitten workers", 0.125, 1), ("Kitten engineers", 0.15, 2),
           ("Kitten overseers", 0.175, 3), ("Kitten managers", 0.2, 4), ("Kitten accountants", 0.2, 5),
           ("Kitten specialists", 0.2, 6), ("Kitten experts", 0.2, 7), ("Kitten consultants", 0.2, 8),
           ("Kitten assistants to the regional manager", 0.175, 9), ("Kitten marketeers", 0.15, 10),
           ("Kitten analysts", 0.125, 11), ("Kitten executives", 0.115, 12), ("Kitten admins", 0.11, 13),
           ("Kitten strategists", 0.105, 14)]
GOLD_UPS = [("Lucky day", 1, 7), ("Serendipity", 1, 27), ("Get lucky", 2, 77)]


def ascii_(s):
    s = (s or "").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = s.replace("…", "...").replace("–", "-").replace("—", "-")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip()


def wrap(s, width=38, lines=3):
    words, out, cur = ascii_(s).split(" "), [], ""
    for w in words:
        if len(cur) + len(w) + (1 if cur else 0) > width:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w) if cur else w
    if cur:
        out.append(cur)
    if len(out) > lines:
        out = out[:lines]
        out[-1] = out[-1][:width - 2].rstrip() + ".."
    return out + [""] * (lines - len(out))


def icon_key(ic):
    return (ic[0], ic[1])


def build_upgrades():
    """Devuelve la lista de mejoras incluidas, ya ordenada por (precio, orden)."""
    rows = []

    def add(u, typ, a, b, ut, ua, ub, req=None, desc=None):
        rows.append({"name": u["name"], "price": u["price"], "order": u["order"], "icon": u["icon"], "type": typ,
                     "a": a, "b": b, "ut": ut, "ua": ua, "ub": ub, "req": req,
                     "desc": desc if desc is not None else u["desc"]})

    # 1) mejoras por niveles (x2) de cada edificio
    for u in UPS:
        if u["pool"] == "" and isinstance(u["tier"], int) and 1 <= u["tier"] <= 15 and u["b1"] in BIDX:
            if u["name"].startswith("Kitten"):
                continue
            b = BIDX[u["b1"]]
            add(u, T_TIER, b, 0, U_AMOUNT, b, TIERS[str(u["tier"])]["unlock"],
                desc=f"{OBJS[b - 1]['plural'].capitalize()} are twice as efficient.")
    # 2) cursor x2, dedos, ratones
    for name, amount in CURSOR2:
        add(BYNAME[name], T_CURSOR2, 0, 0, U_AMOUNT, 1, amount)
    for k, name in enumerate(FINGERS):
        add(BYNAME[name], T_FINGER, FINGER_FACTOR[k], 0, U_AMOUNT, 1, FINGER_UNLOCK[k])
    for k, name in enumerate(MICE):
        add(BYNAME[name], T_MOUSE, 0, 0, U_HANDMADE, MOUSE_UNLOCK[k], 0)
    # 3) gatitos (leche)
    for name, f, milk in KITTENS:
        add(BYNAME[name], T_KITTEN, f, 0, U_MILK, milk, 0, desc="You gain more CpS the more milk you have.")
    # 4) abuelas con oficio
    for u in UPS:
        m = re.search(r"Grandmas are twice as efficient\. (.+?) gain \+1% CpS per", u["desc"])
        if m and u["pool"] == "":
            plural = m.group(1).lower()
            b = next((i + 1 for i, o in enumerate(OBJS) if o["plural"].lower() == plural), None)
            if b:
                add(u, T_JOB, b, 0, U_JOB, b, 15)
    add(BYNAME["Bingo center/Research facility"], T_BINGO, 0, 0, U_BINGO, 0, 0,
        desc="Grandmas are 4 times as efficient.")
    # 5) galletas doradas
    for name, a, g in GOLD_UPS:
        add(BYNAME[name], T_GOLD, a, 0, U_GOLDEN, g, 0)
    # 6) galletas (+X % de produccion) sin requisitos de ascension
    ck = [u for u in UPS if u["pool"] == "cookie" and u["name"] in UNLOCK_AT and not UNLOCK_AT[u["name"]]["season"]
          and isinstance(u["power"], (int, float))]
    ok, changed = set(), True
    while changed:
        changed = False
        for u in ck:
            req = UNLOCK_AT[u["name"]]["require"]
            if u["name"] not in ok and (not req or req in ok):
                ok.add(u["name"])
                changed = True
    for u in ck:
        if u["name"] in ok:
            add(u, T_COOKIE, u["power"], 0, U_COOKIES, UNLOCK_AT[u["name"]]["cookies"], 0,
                req=UNLOCK_AT[u["name"]]["require"])
    rows.sort(key=lambda r: (r["price"], r["order"]))
    idx = {r["name"]: i + 1 for i, r in enumerate(rows)}
    for r in rows:
        if r["type"] == T_COOKIE and r["req"]:
            r["ub"] = idx[r["req"]]
    return rows


NUM_WORDS = {"": 1, "thousand": 1e3, "million": 1e6, "billion": 1e9, "trillion": 1e12, "quadrillion": 1e15,
             "quintillion": 1e18, "sextillion": 1e21, "septillion": 1e24, "octillion": 1e27, "nonillion": 1e30}


def parse_num(txt, word=""):
    return float(txt.replace(",", "")) * NUM_WORDS[(word or "").lower()]


# tipos de logro (aT)
A_BANK, A_CPS, A_HAVE, A_MAKE, A_HANDMADE, A_GOLDEN, A_UPG, A_MIN, A_GC, A_KITTEN, A_TYPES, A_EVENT, A_GCUR = range(1, 14)


def build_achievements():
    rows = []
    A = {a["name"]: a for a in D["achs"]}

    def add(name, typ, a, b):
        x = A[name]
        rows.append({"name": name, "icon": x["icon"], "type": typ, "a": a, "b": b, "order": x["order"],
                     "desc": x["desc"]})

    done = set()
    for n, t in D["bank"]:
        add(n, A_BANK, 0, t); done.add(n)
    for n, t in D["cps"]:
        add(n, A_CPS, 0, t); done.add(n)
    for i, l in enumerate(D["prodAch"]):
        for n, p in l:
            add(n, A_MAKE, i + 1, p); done.add(n)
    for i, l in enumerate(D["tierAch"]):
        for t, n in l:
            add(n, A_HAVE, i + 1, TIERS[str(t)]["achievUnlock"]); done.add(n)
    for a in D["achs"]:
        n, d = a["name"], a["desc"]
        if n in done or a["pool"] not in ("normal", ""):
            continue
        m = re.match(r"^Have (\d[\d,]*) cursors?\.$", d)
        if m:
            add(n, A_HAVE, 1, int(m.group(1).replace(",", ""))); continue
        m = re.match(r"^Make ([\d,]+)(?: (\w+))? cookies? from clicking\.$", d)
        if m and n not in ("Neverclick", "True Neverclick"):
            add(n, A_HANDMADE, 0, parse_num(m.group(1), m.group(2))); continue
        m = re.match(r"^Click (a|[\d,]+) golden cookies?\.$", d)
        if m:
            add(n, A_GOLDEN, 0, 1 if m.group(1) == "a" else int(m.group(1).replace(",", ""))); continue
        m = re.match(r"^Own ([\d,]+) buildings\.$", d)
        if m:
            add(n, A_GC, 0, int(m.group(1).replace(",", ""))); continue
        m = re.match(r"^Purchase ([\d,]+) upgrades\.$", d)
        if m:
            add(n, A_UPG, int(m.group(1).replace(",", "")), 0); continue
        m = re.match(r"^Own ([\d,]+) upgrades and ([\d,]+) buildings\.$", d)
        if m:
            add(n, A_UPG, int(m.group(1).replace(",", "")), int(m.group(2).replace(",", ""))); continue
        m = re.match(r"^Have at least (\d+) of everything\.$", d)
        if m:
            add(n, A_MIN, 0, int(m.group(1))); continue
        if d.startswith("Have at least 1 of every building"):
            add(n, A_MIN, 0, 1); continue
        m = re.match(r"^Own at least (\d+) grandma types\.$", d)
        if m:
            add(n, A_TYPES, 0, int(m.group(1))); continue
        m = re.match(r"^Own a combined (\d+) grandmas and cursors\.$", d)
        if m:
            add(n, A_GCUR, 0, int(m.group(1))); continue
        m = re.match(r"^Own (\d+) kitten upgrades\.$", d)
        if m:
            add(n, A_KITTEN, 0, int(m.group(1))); continue
        if n in ("Just wrong", "Early bird", "Fading luck", "Tabloid addiction"):
            add(n, A_EVENT, 0, 0); continue
    # 'You win a cookie' (100 billones) es de tipo banco
    if "You win a cookie" in A and all(r["name"] != "You win a cookie" for r in rows):
        add("You win a cookie", A_BANK, 0, 1e14)
    rows.sort(key=lambda r: (r["order"], r["name"]))
    return rows


if __name__ == "__main__":
    ups = build_upgrades()
    import collections
    print(len(ups), "upgrades", collections.Counter(r["type"] for r in ups))
    ach = build_achievements()
    print(len(ach), "achievements", collections.Counter(r["type"] for r in ach))
    cells = {icon_key(r["icon"]) for r in ups + ach}
    print(len(cells), "unique icon cells")
