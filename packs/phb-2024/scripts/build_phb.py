#!/usr/bin/env python3
"""
Parse the Chinese 2024 Player's Handbook from DND5eChm/DND5e_chm (`玩家手册2024/`)
into src/generated/phb.json, which src/index.ts turns into a rule pack.

The output is a community translation of Wizards of the Coast's copyrighted text:
it is generated on your machine, git-ignored, and must never be committed or
hosted publicly. Mechanics live in the committed TypeScript; this file only
extracts names, numbers and prose.

Usage:  python3 scripts/build_phb.py [--refresh]
"""
import argparse, concurrent.futures, datetime, html, json, os, re, sys, urllib.parse, urllib.request

REPO = "DND5eChm/DND5e_chm"
ROOT = "玩家手册2024/"
RAW = f"https://raw.githubusercontent.com/{REPO}/main/"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(HERE, "..", "src", "generated", "phb.json")

# ───────────────────────── fetching ─────────────────────────


def api(path):
    with urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/{path}") as r:
        return json.load(r)


def fetch_all(refresh):
    os.makedirs(CACHE, exist_ok=True)
    meta_path = os.path.join(CACHE, "_meta.json")
    if refresh or not os.path.exists(meta_path):
        commit = api("commits/main")["sha"]
        tree = api(f"git/trees/{commit}?recursive=1")["tree"]
        files = [x["path"] for x in tree if x["path"].startswith(ROOT) and x["path"].endswith(".htm")]
        json.dump({"commit": commit, "files": files}, open(meta_path, "w", encoding="utf-8"), ensure_ascii=False)
    meta = json.load(open(meta_path, encoding="utf-8"))

    def get(p):
        out = os.path.join(CACHE, p.replace("/", "_"))
        if refresh or not os.path.exists(out):
            with urllib.request.urlopen(RAW.replace("main", meta["commit"]) + urllib.parse.quote(p)) as r:
                open(out, "wb").write(r.read())

    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        list(ex.map(get, meta["files"]))
    print(f"{len(meta['files'])} pages @ {meta['commit'][:8]}", file=sys.stderr)
    return meta


def page(rel):
    data = open(os.path.join(CACHE, (ROOT + rel).replace("/", "_")), "rb").read()
    for enc in ("utf-8", "gb18030"):
        try:
            s = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    i = s.lower().find("<body")
    return s[i:] if i >= 0 else s


# ───────────────────────── text helpers ─────────────────────────

CJK = r"　-〿㐀-鿿＀-￯"


def text(fragment):
    """HTML fragment -> plain text; paragraphs separated by \\n, list items prefixed with •."""
    s = re.sub(r"<!--.*?-->", "", fragment, flags=re.S)
    s = re.sub(r"\s*\n\s*", " ", s)
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "\n• ", s, flags=re.I)
    s = re.sub(r"</(p|div|tr|h\d|blockquote|ul|ol|table)>", "\n", s, flags=re.I)
    s = re.sub(r"<(p|div|h\d|blockquote|table)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"</t[dh]>", " ｜ ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(rf"(?<=[{CJK}])[ \t]+(?=[{CJK}])", "", s)
    lines = []
    for line in s.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip().strip("｜").strip()
        line = re.sub(r"(?:\s*｜\s*)+$", "", line)
        if line and line != "•":
            lines.append(line)
    return "\n".join(lines)


def flat(fragment):
    return re.sub(r"\s+", " ", text(fragment).replace("\n", " ")).strip()


def split_name(s):
    """'精灵血系Elven Lineage' / '警报术｜Alarm' / '强酸 Acid (25GP)' -> (zh, en)."""
    s = re.sub(r"\s+", " ", s).strip().rstrip("。.：:")
    note = re.search(r"\s*([（(][^）)]*[）)])$", s)
    if note and re.search(r"[A-Za-z]", s[: note.start()]):
        zh, en = split_name(s[: note.start()])
        return (zh + note.group(1), en) if en else (s, None)
    m = re.match(r"^(.*?[^\x00-\x7f])\s*[｜|]?\s*([A-Za-z][^㐀-鿿]*)$", s)
    if not m:
        return s, None
    return m.group(1).strip(" ｜|"), m.group(2).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("'", "")).strip("-")


def cost_of(s):
    m = re.search(r"([\d,]+)\s*(CP|SP|EP|GP|PP)", s or "", re.I)
    return f"{m.group(1).replace(',', '')} {m.group(2).upper()}" if m else None


def weight_of(s):
    m = re.search(r"([\d./]+)\s*磅", s or "")
    if not m:
        return None
    v = m.group(1)
    if "/" in v:
        a, b = v.split("/")
        return round(float(a) / float(b), 3)
    return float(v)


def entries(body, heading=r"<FONT[^>]*color=#800000[^>]*>(.*?)</FONT>"):
    """Split a page at maroon headings: [(heading_html, body_html)]."""
    out = []
    ms = list(re.finditer(heading, body, flags=re.S | re.I))
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(body)
        # start body after the enclosing <b>/<strong> closes
        out.append((m.group(1), body[m.end() : end]))
    return out


def bold_items(fragment):
    """'<b>名Name。</b>text' runs inside a block -> [(zh, en, text)]."""
    fragment = re.sub(r"</?(?:font|em|i|u)\b[^>]*>", "", fragment, flags=re.I)
    parts = re.split(r"<(?:b|strong)\s*>\s*([^<]{1,60}?)[。.]\s*</(?:b|strong)>", fragment, flags=re.I)
    out = []
    for i in range(1, len(parts) - 1, 2):
        zh, en = split_name(parts[i])
        out.append({"zh": zh, "en": en, "text": text(parts[i + 1])})
    return out


def page_options(fragment):
    """Whole-page option lists (Metamagic, Invocations): each <p> opening with a bold "名 Name" heading."""
    fragment = re.sub(r"</?(?:font|em|i|u)\b[^>]*>", "", fragment, flags=re.I)
    out = []
    for para in re.findall(r"<p[^>]*>(.*?)</p>", fragment, flags=re.S | re.I):
        m = re.match(r"\s*<(?:b|strong)\s*>(.*?)</(?:b|strong)>(.*)$", para, flags=re.S | re.I)
        zh, en = split_name(flat(m.group(1))) if m else (None, None)
        if en:
            out.append({"zh": zh, "en": en, "text": text(m.group(2))})
        elif out:
            out[-1]["text"] = (out[-1]["text"] + "\n" + text(para)).strip()
    return out


# ───────────────────────── spells ─────────────────────────


def parse_spells():
    spells = []
    for lv in range(10):
        body = page(f"法术详述/{lv}环.htm")
        for m in re.finditer(r'<H4[^>]*id="?([^">]*)"?[^>]*>(.*?)</H4>(.*?)(?=<H4|</body>|$)', body, flags=re.S | re.I):
            anchor, head, rest = m.groups()
            zh, en = split_name(flat(head))
            if not en:
                en = anchor.replace("_", " ")
            hm = re.search(r"<EM>(.*?)</EM>", rest, flags=re.S | re.I)
            header = flat(hm.group(1)) if hm else ""
            school = re.sub(r"(戏法|[一二三四五六七八九]环)", "", header.split("（")[0]).strip()
            lists = re.findall(r"（(.*?)）", header)
            fields = {}
            for f in ("施法时间", "施法距离", "法术成分", "持续时间"):
                fm = re.search(rf"{f}：\s*</STRONG>(.*?)<BR", rest, flags=re.S | re.I)
                fields[f] = flat(fm.group(1)) if fm else ""
            # body = after the duration line
            dm = re.search(r"持续时间：\s*</STRONG>.*?<BR\s*/?>", rest, flags=re.S | re.I)
            prose = text(rest[dm.end() :] if dm else rest)
            higher = None
            hm2 = re.search(r"(?:^|\n)(升环施法|戏法强化)[。.]\s*(.*?)(?=\n|$)", prose, flags=re.S)
            if hm2:
                higher = hm2.group(2).strip()
            cast = fields["施法时间"]
            spells.append({
                "en": en, "zh": zh, "anchor": anchor, "level": lv, "school": school,
                "lists": [x.strip() for x in re.split(r"[、，,]", lists[0])] if lists else [],
                "castingTime": cast, "ritual": "仪式" in cast, "range": fields["施法距离"],
                "components": fields["法术成分"], "duration": fields["持续时间"],
                "concentration": fields["持续时间"].startswith("专注"),
                "text": prose, "higher": higher,
            })
    return spells


# ───────────────────────── feats ─────────────────────────

FEAT_PAGES = {"起源专长": "origin", "通用专长": "general", "战斗风格专长": "fighting-style", "传奇恩惠专长": "epic-boon"}


def parse_feats():
    feats = []
    for fname, cat in FEAT_PAGES.items():
        body = page(f"专长/{fname}.htm")
        for head, rest in entries(body):
            zh, en = split_name(flat(head))
            if not en:
                continue
            im = re.search(r"<(i|em)>(.*?)</\1>", rest, flags=re.S | re.I)
            tagline = flat(im.group(2)) if im else ""
            prereq = re.search(r"先决：(.*?)）", tagline)
            prose_html = rest[im.end() :] if im else rest
            prose = text(prose_html)
            repeatable = "复选Repeatable" in re.sub(r"\s", "", flat(prose_html)) or "复选 Repeatable" in prose
            asi = re.search(r"属性值提升\s*Ability Score Increase[。.](.*?)(?=\n|$)", prose)
            feats.append({
                "en": en, "zh": zh, "category": cat, "prereq": prereq.group(1) if prereq else None,
                "text": prose, "repeatable": repeatable, "asi": asi.group(1).strip() if asi else None,
                "benefits": bold_items(prose_html),
            })
    return feats


# ───────────────────────── backgrounds ─────────────────────────

BACKGROUNDS = ["侍僧", "农民", "向导", "商人", "士兵", "工匠", "抄写员", "智者", "水手", "流浪者", "罪犯", "艺人", "警卫", "贵族", "隐士", "骗子"]


def parse_backgrounds():
    out = []
    for name in BACKGROUNDS:
        body = page(f"角色起源/背景/{name}.htm")
        hm = re.search(r"<h3>(.*?)</h3>", body, flags=re.S | re.I)
        zh, en = split_name(flat(hm.group(1)))
        fields = {}
        for fm in re.finditer(r"<(?:b|strong)>([^<：]+)：</(?:b|strong)>(.*?)(?=<BR|<b>|<strong>|</p>)", body, flags=re.S | re.I):
            fields[fm.group(1).strip()] = flat(fm.group(2))
        paras = re.findall(r"<p>(.*?)</p>", body, flags=re.S | re.I)
        prose = "\n".join(text(p) for p in paras[1:])
        equip = fields.get("装备", "")
        em = re.search(r"（A）(.*?)；?\s*或\s*（B）\s*(.*)$", equip)
        kit, alt = (em.group(1), em.group(2)) if em else (equip, "")
        kit_items = [x.strip() for x in re.split(r"[、，,]", kit) if x.strip()]
        out.append({
            "en": en, "zh": zh, "text": prose,
            "abilities": [x for x in re.split(r"[、，,和与]", fields.get("属性值", "")) if x.strip()],
            "feat": re.sub(r"[（(].*?[）)]", "", fields.get("专长", "")).strip(),
            "featNote": (re.search(r"[（(](.*?)[）)]", fields.get("专长", "")) or [None, None])[1],
            "skills": [x for x in re.split(r"[、，,和与及]", fields.get("技能熟练", "")) if x.strip()],
            "tool": fields.get("工具熟练", ""),
            "kit": kit_items,
            "altGold": int(re.search(r"(\d+)", alt).group(1)) if re.search(r"(\d+)", alt) else 50,
            "equipment": equip,
        })
    return out


# ───────────────────────── species ─────────────────────────

SPECIES = ["人类", "侏儒", "兽人", "半身人", "提夫林", "歌利亚", "矮人", "精灵", "阿斯莫", "龙裔"]


def parse_tables(fragment):
    tables = []
    for tm in re.finditer(r"(?:<STRONG>([^<]*)</STRONG>\s*)?<table[^>]*>(.*?)</table>", fragment, flags=re.S | re.I):
        rows = []
        for rm in re.finditer(r"<tr[^>]*>(.*?)(?=<tr|$)", tm.group(2), flags=re.S | re.I):
            cells = [flat(c) for c in re.findall(r"<t[dh][^>]*>(.*?)(?=<t[dh]|</tr|$)", rm.group(1), flags=re.S | re.I)]
            if any(cells):
                rows.append(cells)
        tables.append({"title": flat(tm.group(1) or ""), "rows": rows})
    return tables


def parse_species():
    out = []
    for name in SPECIES:
        body = page(f"角色起源/种族/{name}.htm")
        hm = re.search(r"<h2>(.*?)</h2>", body, flags=re.S | re.I)
        zh, en = split_name(flat(hm.group(1)))
        ti = re.search(r"特质\s*[A-Za-z\s]*Traits?", body)
        intro_html, traits_html = (body[: ti.start()], body[ti.start() :]) if ti else (body, "")
        intro_html = intro_html[hm.end() :]
        # strip the "特质 Traits" heading line
        stats = {}
        for fm in re.finditer(r"([^<>：]+)：</(?:b|strong)>(.*?)(?=<BR|</p>)", traits_html, flags=re.S | re.I):
            stats[fm.group(1).strip()] = flat(fm.group(2))
        after_stats = re.split(r"你有以下特殊特质：", traits_html, maxsplit=1)
        trait_html = after_stats[1] if len(after_stats) > 1 else traits_html
        trait_html_no_tables = re.sub(r"<table.*?</table>", "", trait_html, flags=re.S | re.I)
        speed = re.search(r"(\d+)", stats.get("速度", "30"))
        out.append({
            # the intro ends with the "<name>特质" heading residue
            "en": en, "zh": zh, "text": re.sub(r"\n" + re.escape(zh) + r"$", "", text(intro_html)), "creatureType": stats.get("生物类型"),
            "size": stats.get("体型", ""), "speed": int(speed.group(1)) if speed else 30,
            "traits": bold_items(trait_html_no_tables), "tables": parse_tables(trait_html),
        })
    return out


# ───────────────────────── equipment ─────────────────────────

PROPS = {"灵巧": "finesse", "轻型": "light", "投掷": "thrown", "双手": "two-handed", "多用": "versatile", "弹药": "ammunition",
         "装填": "loading", "重型": "heavy", "触及": "reach", "特殊": "special"}
MASTERY = {"缓速": "slow", "迅击": "nick", "推离": "push", "侵扰": "vex", "削弱": "sap", "失衡": "topple", "擦掠": "graze", "横扫": "cleave"}
DAMAGE = {"钝击": "bludgeoning", "穿刺": "piercing", "挥砍": "slashing"}


def parse_weapons():
    body = page("装备/武器.htm")
    out, cat, kind = [], None, None
    for rm in re.finditer(r"<TR[^>]*>(.*?)</TR>", body, flags=re.S | re.I):
        cells = [flat(c) for c in re.findall(r"<T[DH][^>]*>(.*?)</T[DH]>", rm.group(1), flags=re.S | re.I)]
        if len(cells) == 1:
            h = cells[0]
            cat = "simple" if "简易" in h else "martial" if "军用" in h else cat
            kind = "melee" if "近战" in h else "ranged" if "远程" in h else kind
            continue
        if len(cells) != 6 or not re.search(r"\d", cells[1]):
            continue
        zh, en = split_name(cells[0])
        dm = re.match(r"(\S+)\s*(\S+)", cells[1])
        props, rng, vers = [], None, None
        for p in re.split(r"[，,]", cells[2]):
            p = p.strip()
            key = next((v for k, v in PROPS.items() if p.startswith(k)), None)
            if key:
                props.append(key)
            r = re.search(r"射程\s*([\d/]+)", p)
            if r:
                rng = r.group(1)
            v = re.search(r"多用（(.*?)）", p)
            if v:
                vers = v.group(1)
        out.append({"en": en, "zh": zh, "kind": "weapon", "category": cat, "range": kind, "damage": dm.group(1),
                    "damageType": DAMAGE.get(dm.group(2), dm.group(2)), "properties": props, "propertiesText": cells[2],
                    "rangeText": rng, "versatile": vers, "mastery": MASTERY.get(cells[3]), "weight": weight_of(cells[4]), "cost": cost_of(cells[5])})
    return out


def parse_armor():
    body = page("装备/护甲.htm")
    out, cat = [], None
    for rm in re.finditer(r"<TR[^>]*>(.*?)</TR>", body, flags=re.S | re.I):
        cells = [flat(c) for c in re.findall(r"<T[DH][^>]*>(.*?)</T[DH]>", rm.group(1), flags=re.S | re.I)]
        if len(cells) == 1:
            h = cells[0]
            cat = "light" if "轻甲" in h else "medium" if "中甲" in h else "heavy" if "重甲" in h else "shield" if "盾" in h else cat
            continue
        if len(cells) != 6 or not re.search(r"\d", cells[1]):
            continue
        zh, en = split_name(cells[0])
        ac = re.search(r"(\d+)", cells[1])
        st = re.search(r"(\d+)", cells[2])
        out.append({"en": en, "zh": zh, "kind": "armor", "category": cat, "ac": int(ac.group(1)), "acText": cells[1],
                    "strength": int(st.group(1)) if st else None, "stealthDisadvantage": "劣势" in cells[3],
                    "weight": weight_of(cells[4]), "cost": cost_of(cells[5])})
    return out


def parse_detail_items(rel, kind):
    out = []
    for head, rest in entries(page(rel)):
        h = flat(head)
        cm = re.search(r"[（(]([^）)]*)[）)]\s*$", h)
        name = re.sub(r"[（(][^）)]*[）)]\s*$", "", h).strip()
        zh, en = split_name(name)
        if not en:
            continue
        zh = re.sub(r"[（(]多种[）)]", "", zh).strip()
        en = re.sub(r"\s*\(Varies\)", "", en).strip()
        body_text = text(rest if kind == "tool" else re.sub(r"<table.*?</table>", "", rest, flags=re.S | re.I))
        vm = re.search(r"变体：(.*?)(?:\n|$)", body_text)
        variants = [{"zh": v.group(1).strip(), "cost": cost_of(v.group(2))} for v in re.finditer(r"([^、（(]+)[（(]([^）)]*)[）)]", vm.group(1))] if vm else []
        out.append({"en": en, "zh": zh, "kind": kind, "cost": cost_of(cm.group(1) if cm else ""), "text": body_text,
                    "weight": weight_of(flat(rest)), "variants": variants, "tables": parse_tables(rest)})
    return out


def parse_masteries():
    out = []
    for head, rest in entries(page("装备/精通词条.htm")):
        zh, en = split_name(flat(head))
        if en:
            out.append({"zh": zh, "en": en, "text": text(rest)})
    return out



# ───────────────────────── classes ─────────────────────────

FEATURE_HEAD = re.compile(r"^(\d+)\s*级\s*[：:]\s*(.*)$")


def features_of(body):
    """'N级：中文名 English' maroon headings -> [{level, zh, en, text, items}] (bodies stop at the next <h2>/<h3>)."""
    out = []
    for head, rest in entries(body):
        # nested <FONT>s can end the heading early and leave body text inside it
        head = re.sub(r"^(?:\s|<br\s*/?>|</?(?:strong|b)>)+", "", head, flags=re.I)
        parts = re.split(r"<br\s*/?>", head, maxsplit=1, flags=re.I)
        if len(parts) == 2:
            head, rest = parts[0], parts[1] + rest
        m = FEATURE_HEAD.match(flat(head))
        if not m:
            continue
        rest = re.split(r"<h[23]\b", rest, maxsplit=1, flags=re.I)[0]
        rest = re.sub(r"^\s*</(?:strong|b)>", "", rest, flags=re.I)
        zh, en = split_name(m.group(2))
        out.append({"level": int(m.group(1)), "zh": zh, "en": en, "text": text(rest), "items": bold_items(rest)})
    return out


def option_sections(body):
    """<h3> sections after the first feature that list '<b>名Name。</b>' options (maneuvers, invocations...)."""
    first = re.search(r"<FONT[^>]*color=#800000[^>]*>\s*(?:<[^>]+>\s*)*\d+\s*级", body, flags=re.I)
    start = first.start() if first else 0
    out = []
    ms = list(re.finditer(r"<h3[^>]*>(.*?)</h3>", body[start:], flags=re.S | re.I))
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(body) - start
        rest = body[start + m.end() : start + end]
        items = bold_items(rest)
        if items:
            zh, en = split_name(flat(m.group(1)))
            out.append({"zh": zh, "en": en, "intro": text(re.split(r"<(?:b|strong)>", rest, maxsplit=1, flags=re.I)[0]), "items": items})
    return out


def intro_of(body, after):
    """Prose between the summary line and the first <h3>/feature heading."""
    i = body.find(after) + len(after) if after in body else 0
    stop = re.search(r"<h3\b|<FONT[^>]*color=#800000", body[i:], flags=re.I)
    chunk = body[i : i + stop.start()] if stop else body[i:]
    # the core-traits table is parsed separately
    chunk = re.sub(r"<table.*?</table>", "", chunk, flags=re.S | re.I)
    chunk = re.sub(r"<strong>[^<]*核心特质[^<]*</strong>", "", chunk, flags=re.I)
    return text(chunk)


def parse_classes(files):
    out = []
    dirs = sorted({f.split("/")[2] for f in files if f.startswith(ROOT + "角色职业/") and f.count("/") == 3})
    for d in dirs:
        names = sorted(f.split("/")[3][:-4] for f in files if f.startswith(f"{ROOT}角色职业/{d}/"))
        body = page(f"角色职业/{d}/{d}.htm")
        zh, en = split_name(flat(re.search(r"<h1[^>]*>(.*?)</h1>", body, flags=re.S | re.I).group(1)))
        sm = re.search(r"<p class=sum>(.*?)</p>", body, flags=re.S | re.I)
        core = {}
        ct = re.search(r"核心特质.*?<table[^>]*>(.*?)</table>", body, flags=re.S | re.I)
        for row in parse_tables(f"<table>{ct.group(1)}</table>")[0]["rows"] if ct else []:
            if len(row) >= 2:
                core[split_name(row[0])[0]] = row[1]
        level_table = next((tb["rows"] for tb in parse_tables(body) if tb["rows"] and tb["rows"][0][:1] == ["等级"]), [])
        cls = {
            "en": en, "zh": zh, "summary": flat(sm.group(1)) if sm else None,
            "text": intro_of(body, sm.group(0) if sm else ""),
            "core": core,
            "table": level_table,
            "features": features_of(body),
            "options": option_sections(body),
            "subclasses": [], "extras": [],
        }
        for n in names:
            if n == d or n.endswith("法术列表"):
                continue
            sb = page(f"角色职业/{d}/{n}.htm")
            h2 = re.search(r"<h2[^>]*>(.*?)</h2>", sb, flags=re.S | re.I)
            if n.endswith("选项"):  # whole-page option lists: Metamagic, Eldritch Invocations
                items = page_options(sb) if not re.search(r"<h4", sb, flags=re.I) else []
                heads = list(re.finditer(r"<h4[^>]*>(.*?)</h4>", sb, flags=re.S | re.I))
                for i, m in enumerate(heads):
                    end = heads[i + 1].start() if i + 1 < len(heads) else len(sb)
                    z, e = split_name(flat(m.group(1)))
                    items.append({"zh": z, "en": e, "text": text(sb[m.end() : end])})
                hz, he = split_name(flat(h2.group(1))) if h2 else (n, None)
                cls["extras"].append({"zh": hz, "en": he, "intro": "", "items": items})
                continue
            szh, sen = split_name(flat(h2.group(1))) if h2 else (n, None)
            ssm = re.search(r"<p class=sum>(.*?)</p>", sb, flags=re.S | re.I)
            cls["subclasses"].append({
                "en": sen, "zh": szh, "summary": flat(ssm.group(1)) if ssm else None,
                "text": intro_of(sb, ssm.group(0) if ssm else ""),
                "features": features_of(sb), "options": option_sections(sb),
            })
        out.append(cls)
    return out


# ───────────────────────── main ─────────────────────────


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download the pages")
    args = ap.parse_args()
    meta = fetch_all(args.refresh)
    data = {
        "source": {"repo": REPO, "path": ROOT, "commit": meta["commit"], "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")},
        "spells": parse_spells(),
        "feats": parse_feats(),
        "backgrounds": parse_backgrounds(),
        "species": parse_species(),
        "items": parse_weapons() + parse_armor()
        + parse_detail_items("装备/冒险装备.htm", "gear")
        + parse_detail_items("装备/工匠工具.htm", "tool")
        + parse_detail_items("装备/其他工具.htm", "tool"),
        "masteries": parse_masteries(),
        "classes": parse_classes(meta["files"]),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in data.items() if isinstance(v, list)}, file=sys.stderr)


if __name__ == "__main__":
    main()
