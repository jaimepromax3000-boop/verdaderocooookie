"""Mini DSL en Python para escribir bloques de Scratch 3 (project.json) y empaquetar un .sb3."""
import hashlib
import io
import json
import wave
import subprocess
import tempfile
import os
import zipfile

from PIL import Image


class Rep(str):
    """Id de un bloque reportero/booleano."""


class Var:
    def __init__(self, name):
        self.name, self.id = name, "var_" + name


class Lst:
    def __init__(self, name):
        self.name, self.id = name, "lst_" + name


def val(x, kind="n"):
    """Codifica un valor como entrada de bloque. kind: n (numero) o s (texto)."""
    code = 4 if kind == "n" else 10
    if isinstance(x, Rep):
        return [3, str(x), [code, "0" if kind == "n" else ""]]
    if isinstance(x, Var):
        return [3, [12, x.name, x.id], [code, "0" if kind == "n" else ""]]
    if isinstance(x, bool):
        x = int(x)
    if isinstance(x, float):
        x = repr(x)
    return [1, [code, str(x)]]


def bool_in(x):
    return [2, str(x)]


class Project:
    """Estado global compartido: variables/listas globales, recursos, difusiones."""

    def __init__(self):
        self.vars, self.lists, self.broadcasts = {}, {}, []
        self.assets = {}

    def var(self, name, initial=0):
        self.vars[name] = initial
        return Var(name)

    def lst(self, name, items):
        self.lists[name] = items
        return Lst(name)

    def bcast(self, name):
        if name not in self.broadcasts:
            self.broadcasts.append(name)
        return name

    # ---- recursos
    def add_asset(self, data, ext):
        md5 = hashlib.md5(data).hexdigest()
        self.assets[f"{md5}.{ext}"] = data
        return md5

    def costume(self, name, im, res=2, center=None):
        b = io.BytesIO()
        im.save(b, "PNG", optimize=True)
        md5 = self.add_asset(b.getvalue(), "png")
        cx, cy = center if center else (im.width / 2, im.height / 2)
        return {"name": name, "bitmapResolution": res, "dataFormat": "png", "assetId": md5,
                "md5ext": f"{md5}.png", "rotationCenterX": cx, "rotationCenterY": cy}

    def sound(self, name, path):
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, "s.wav")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ar", "22050", "-ac", "1",
                            "-c:a", "pcm_s16le", wav], check=True)
            data = open(wav, "rb").read()
        with wave.open(io.BytesIO(data)) as w:
            frames, rate = w.getnframes(), w.getframerate()
        md5 = self.add_asset(data, "wav")
        return {"name": name, "assetId": md5, "dataFormat": "wav", "rate": rate, "sampleCount": frames,
                "md5ext": f"{md5}.wav"}

    def write(self, path, targets, extensions=("pen",)):
        project = {"targets": targets, "monitors": [], "extensions": list(extensions),
                   "meta": {"semver": "3.0.0", "vm": "0.2.0", "agent": "cookie-clicker-sb3-builder"}}
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("project.json", json.dumps(project, separators=(",", ":")))
            for name, data in self.assets.items():
                z.writestr(name, data)


class Proc:
    def __init__(self, target, name, args, warp):
        self.t, self.name, self.args, self.warp = target, name, args, warp
        self.code = name + "".join(" %s" for _ in args)
        self.ids = [f"{name}_arg_{a}" for a in args]

    def mutation(self):
        return {"tagName": "mutation", "children": [], "proccode": self.code,
                "argumentids": json.dumps(self.ids), "argumentnames": json.dumps(self.args),
                "argumentdefaults": json.dumps([""] * len(self.args)),
                "warp": "true" if self.warp else "false"}

    def a(self, name):
        return Rep(self.t.blk("argument_reporter_string_number", fields={"VALUE": [name, None]}))

    def call(self, *vals):
        mut = self.mutation()
        mut.pop("argumentnames")
        mut.pop("argumentdefaults")
        inputs = {i: val(v, "s") for i, v in zip(self.ids, vals)}
        return self.t.blk("procedures_call", inputs, mutation=mut)


class Target:
    def __init__(self, project, name, stage=False):
        self.p, self.name, self.stage = project, name, stage
        self.blocks = {}
        self.n = 0
        self.costumes, self.sounds = [], []
        self.pos = (0, 0)
        self.size = 100
        self.visible = True
        self.tops = 0
        self.direction = 90

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
        flat = []
        for i in ids:
            if isinstance(i, (list, tuple)):
                flat.extend(i)
            elif i is not None:
                flat.append(i)
        for a, b in zip(flat, flat[1:]):
            self.blocks[a]["next"] = b
        return flat[0] if flat else None

    def hat(self, op, fields=None, inputs=None):
        i = self.blk(op, inputs, fields)
        b = self.blocks[i]
        b["topLevel"] = True
        b["x"], b["y"] = 20, 20 + 600 * self.tops
        self.tops += 1
        return i

    def script(self, hat, *body):
        return self.stack(hat, *body)

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
        d["x"], d["y"] = 20, 20 + 600 * self.tops
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

    def ge(self, a, b): return self.not_(self.lt(a, b))
    def le(self, a, b): return self.not_(self.gt(a, b))
    def ne(self, a, b): return self.not_(self.eq(a, b))

    def and_(self, *xs):
        r = xs[0]
        for x in xs[1:]:
            r = Rep(self.blk("operator_and", {"OPERAND1": bool_in(r), "OPERAND2": bool_in(x)}))
        return r

    def or_(self, *xs):
        r = xs[0]
        for x in xs[1:]:
            r = Rep(self.blk("operator_or", {"OPERAND1": bool_in(r), "OPERAND2": bool_in(x)}))
        return r

    def not_(self, a):
        return Rep(self.blk("operator_not", {"OPERAND": bool_in(a)}))

    def math(self, fn, a):
        return Rep(self.blk("operator_mathop", {"NUM": val(a)}, {"OPERATOR": [fn, None]}))

    def round_(self, a): return Rep(self.blk("operator_round", {"NUM": val(a)}))
    def letter(self, i, s): return Rep(self.blk("operator_letter_of", {"LETTER": val(i), "STRING": val(s, "s")}))
    def length(self, s): return Rep(self.blk("operator_length", {"STRING": val(s, "s")}))

    def num(self, a):
        """Fuerza tipo numero (suma 0)."""
        return self.add(a, 0)

    def min_(self, a, b):
        return self.sub(self.add(a, b), self.max_(a, b))

    def max_(self, a, b):
        # max(a,b) = (a + b + |a - b|) / 2
        return self.div(self.add(self.add(a, b), self.math("abs", self.sub(a, b))), 2)

    def pow_(self, base, e):
        return self.math("e ^", self.mul(e, self.math("ln", base)))

    # ---- datos
    def setv(self, v, x):
        kind = "n" if isinstance(x, (int, float)) and not isinstance(x, bool) else "s"
        return self.blk("data_setvariableto", {"VALUE": val(x, kind)}, {"VARIABLE": [v.name, v.id]})

    def chg(self, v, x):
        return self.blk("data_changevariableby", {"VALUE": val(x)}, {"VARIABLE": [v.name, v.id]})

    def item(self, l, i):
        return Rep(self.blk("data_itemoflist", {"INDEX": val(i)}, {"LIST": [l.name, l.id]}))

    def lsize(self, l):
        return Rep(self.blk("data_lengthoflist", fields={"LIST": [l.name, l.id]}))

    def addto(self, l, x):
        kind = "n" if isinstance(x, (int, float)) and not isinstance(x, bool) else "s"
        return self.blk("data_addtolist", {"ITEM": val(x, kind)}, {"LIST": [l.name, l.id]})

    def delall(self, l):
        return self.blk("data_deletealloflist", fields={"LIST": [l.name, l.id]})

    def replace(self, l, i, x):
        kind = "n" if isinstance(x, (int, float)) and not isinstance(x, bool) else "s"
        return self.blk("data_replaceitemoflist", {"INDEX": val(i), "ITEM": val(x, kind)},
                        {"LIST": [l.name, l.id]})

    def delitem(self, l, i):
        return self.blk("data_deleteoflist", {"INDEX": val(i)}, {"LIST": [l.name, l.id]})

    def lchg(self, l, i, delta):
        return self.replace(l, i, self.add(self.item(l, i), delta))

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
        a = a if isinstance(a, (list, tuple)) else [a]
        b = b if isinstance(b, (list, tuple)) else [b]
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
        self.p.bcast(name)
        return self.hat("event_whenbroadcastreceived", {"BROADCAST_OPTION": [name, "bc_" + name]})

    def bcast(self, name):
        self.p.bcast(name)
        return self.blk("event_broadcast", {"BROADCAST_INPUT": [1, [11, name, "bc_" + name]]})

    # ---- apariencia / movimiento
    def costume_to(self, name):
        if isinstance(name, (Rep, Var, int, float)) and not isinstance(name, bool):
            m = self.blk("looks_costume", fields={"COSTUME": ["", None]}, shadow=True)
            if isinstance(name, (int, float)):
                return self.blk("looks_switchcostumeto", {"COSTUME": [3, self.add(name, 0), m]})
            if isinstance(name, Var):
                return self.blk("looks_switchcostumeto", {"COSTUME": [3, [12, name.name, name.id], m]})
            return self.blk("looks_switchcostumeto", {"COSTUME": [3, str(name), m]})
        m = self.blk("looks_costume", fields={"COSTUME": [name, None]}, shadow=True)
        return self.blk("looks_switchcostumeto", {"COSTUME": [1, m]})

    def costume_number(self):
        return Rep(self.blk("looks_costumenumbername", fields={"NUMBER_NAME": ["number", None]}))

    def show(self): return self.blk("looks_show")
    def hide(self): return self.blk("looks_hide")
    def size_to(self, v): return self.blk("looks_setsizeto", {"SIZE": val(v)})

    def effect(self, name, v):
        return self.blk("looks_seteffectto", {"VALUE": val(v)}, {"EFFECT": [name, None]})

    def effect_chg(self, name, v):
        return self.blk("looks_changeeffectby", {"CHANGE": val(v)}, {"EFFECT": [name, None]})

    def clear_effects(self): return self.blk("looks_cleargraphiceffects")
    def goto(self, x, y): return self.blk("motion_gotoxy", {"X": val(x), "Y": val(y)})
    def direction_to(self, v): return self.blk("motion_pointindirection", {"DIRECTION": val(v)})
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
        m = self.blk("sound_sounds_menu", fields={"SOUND_MENU": ["" if isinstance(name, Rep) else name, None]},
                     shadow=True)
        if isinstance(name, Rep):
            return self.blk("sound_play", {"SOUND_MENU": [3, str(name), m]})
        return self.blk("sound_play", {"SOUND_MENU": [1, m]})

    # ---- salida
    def _clone(self, bid):
        b = self.blocks[bid]
        self.n += 1
        nid = f"{self.name[:3].lower()}c{self.n}"
        nb = json.loads(json.dumps(b))
        nb["next"], nb["parent"], nb["topLevel"] = None, None, False
        self.blocks[nid] = nb
        for v in nb["inputs"].values():
            for k in range(1, len(v)):
                ref = v[k]
                if isinstance(ref, str) and ref in self.blocks:
                    v[k] = self._clone(ref)
        return nid

    def _dedupe(self):
        """Un reportero solo puede estar en una entrada: clona los usados mas de una vez."""
        uses = {}
        for bid, b in list(self.blocks.items()):
            for name, v in b["inputs"].items():
                for k in range(1, len(v)):
                    ref = v[k]
                    if isinstance(ref, str) and ref in self.blocks:
                        uses.setdefault(ref, []).append((bid, name, k))
        for ref, lst in uses.items():
            for bid, name, k in lst[1:]:
                self.blocks[bid]["inputs"][name][k] = self._clone(ref)

    def finalize(self):
        self._dedupe()
        # quita bloques huerfanos (creados pero no usados)
        while True:
            for bid, b in self.blocks.items():
                b["parent"] = None
            for bid, b in self.blocks.items():
                if b["next"]:
                    self.blocks[b["next"]]["parent"] = bid
                for v in b["inputs"].values():
                    for ref in v[1:]:
                        if isinstance(ref, str) and ref in self.blocks:
                            self.blocks[ref]["parent"] = bid
            orphans = [i for i, b in self.blocks.items() if b["parent"] is None and not b["topLevel"]]
            if not orphans:
                break
            for i in orphans:
                del self.blocks[i]
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
            d.update({"variables": {f"var_{k}": [k, v] for k, v in self.p.vars.items()},
                      "lists": {f"lst_{k}": [k, v] for k, v in self.p.lists.items()},
                      "broadcasts": {f"bc_{k}": k for k in self.p.broadcasts},
                      "tempo": 60, "videoTransparency": 50, "videoState": "on",
                      "textToSpeechLanguage": None})
        else:
            d.update({"visible": self.visible, "x": self.pos[0], "y": self.pos[1], "size": self.size,
                      "direction": self.direction, "draggable": False, "rotationStyle": "all around"})
        return d
