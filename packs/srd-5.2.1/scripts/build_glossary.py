#!/usr/bin/env python3
"""
Build the rules glossary (src/glossary.generated.ts) from CC-BY-4.0 sources:

  * Chinese: DND5eChm/SRD5.2Chm  (玩家手册2024/术语汇编/*.htm)
  * English: SRD 5.2 PDF shipped in the same repository (Rules Glossary pages)

Usage:  python3 scripts/build_glossary.py [--cache DIR]
Requires: pypdf (pip install pypdf). Files are downloaded into the cache once.
"""
import argparse, html, json, os, re, sys, urllib.parse, urllib.request

RAW = "https://raw.githubusercontent.com/DND5eChm/SRD5.2Chm/main/"
FILES = {  # file -> category
    "动作": "action",
    "效应区域": "area",
    "危害": "hazard",
    "态度": "attitude",
    "状态": "condition",
    "其他术语": "term",
}
CONDITION_ZH = {
    "目盲": "blinded", "魅惑": "charmed", "耳聋": "deafened", "力竭": "exhaustion", "恐慌": "frightened",
    "受擒": "grappled", "失能": "incapacitated", "隐形": "invisible", "麻痹": "paralyzed", "石化": "petrified",
    "中毒": "poisoned", "倒地": "prone", "束缚": "restrained", "震慑": "stunned", "昏迷": "unconscious",
}
EN_FIX = {"Defened": "Deafened"}  # typos in the Chinese headings' English part
# too generic to auto-link in prose (still linkable with explicit {{id}} markup)
NO_AUTOLINK = {
    "action", "attack", "magic", "influence", "search", "study", "ready", "utilize", "help", "hide", "adventure", "ally",
    "campaign", "creature", "damage", "healing", "dead", "enemy", "monster", "objects", "target", "spell", "weapon", "skill",
    "speed", "size", "condition", "flying", "darkness", "per-day", "curses", "jumping", "illusions", "possession",
    "teleportation", "encounter", "hazard", "attitude", "line", "cube", "sphere", "burning", "falling", "save", "round-down",
    "player-character", "character-sheet", "simultaneous-effects", "friendly", "hostile", "indifferent", "dodge", "climbing",
    "swimming", "crawling", "hover", "stable",
}
TAG_EN = {"action": "Action", "area": "Area of Effect", "hazard": "Hazard", "attitude": "Attitude", "condition": "Condition"}


def fetch(cache, rel):
    path = os.path.join(cache, rel.replace("/", "_"))
    if not os.path.exists(path):
        url = RAW + urllib.parse.quote(rel)
        print("fetch", url, file=sys.stderr)
        with urllib.request.urlopen(url) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def read_text(path):
    data = open(path, "rb").read()
    for enc in ("utf-8", "gb18030"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            pass
    return data.decode("utf-8", "replace")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def split_heading(h):
    h = re.sub(r"【[^】]*】", "", h).strip()
    m = re.match(r"^([^A-Za-z]+?)\s*([A-Za-z].*)$", h)
    if not m:
        return h, None
    en = EN_FIX.get(m.group(2).strip(), m.group(2).strip())
    return m.group(1).strip(), re.sub(r"\s+", " ", en)


def parse_zh(cache):
    entries = []
    for fname, cat in FILES.items():
        src = read_text(fetch(cache, f"玩家手册2024/术语汇编/{fname}.htm"))
        body = src[src.lower().find("<body") :]
        # an entry runs from <p id="..."> to the next <p id=...>
        parts = re.split(r'(?=<p\s+id=")', body, flags=re.I)
        for part in parts:
            m = re.match(r'<p\s+id="([^"]+)"[^>]*>(.*)', part, re.I | re.S)
            if not m:
                continue
            inner = m.group(2)
            hm = re.search(r"(.*?)(<br\s*/?>|</p>)", inner, re.I | re.S)
            heading = html.unescape(re.sub(r"<[^>]+>", "", hm.group(1) if hm else "")).replace("\n", " ").strip()
            zh, en = split_heading(heading)
            text = inner[hm.end() :] if hm else ""
            if not zh or not en:
                continue
            entries.append({"zh": zh, "en": en, "cat": cat, "raw": text, "tagged": "【" in heading})
    return entries


def ids_for(entries):
    for e in entries:
        if e["cat"] == "condition" and e["zh"] in CONDITION_ZH:
            e["id"] = "condition:" + CONDITION_ZH[e["zh"]]
        else:
            e["id"] = "rule:" + slug(e["en"])
    return {e["zh"]: e["id"] for e in entries}


def clean_zh(raw, names, self_id):
    s = raw
    s = re.sub(r"<tr[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<t[dh][^>]*>", " | ", s, flags=re.I)
    s = re.sub(r"<br\s*/?>|</p>|<p[^>]*>|<li[^>]*>", "\n", s, flags=re.I)

    def link(m):
        inner = html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).strip()
        key = re.sub(r"[“”\"（）()]", "", inner).strip()
        tid = names.get(key)
        return f"{{{{{tid}|{inner}}}}}" if tid and tid != self_id else inner

    s = re.sub(r"<(strong|u|b)>(.*?)</\1>", link, s, flags=re.I | re.S)
    # cross-references: <a href="...#术语">术语</a>
    s = re.sub(r"<(a)\b[^>]*>(.*?)</a>", link, s, flags=re.I | re.S)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    lines = [re.sub(r"[ \t　]+", " ", l).strip(" |") for l in s.split("\n")]
    out, blank = [], False
    for l in lines:
        if not l:
            blank = True
            continue
        out.append(l)
    return "\n".join(out).strip()


def parse_en(cache, entries):
    from pypdf import PdfReader

    reader = PdfReader(fetch(cache, "SRD_CC_v5.2.pdf"))
    raw = "\n".join((reader.pages[i].extract_text() or "") for i in range(175, 191))
    raw = re.sub(r"System Reference Document 5\.2\s*\n\s*\d+\s*\n", "\n", raw)
    start = raw.find("Rules Definitions")
    found = []
    for e in entries:
        title = e["en"]
        # "Attack [Action]": tagged entries must carry their tag, or we'd hit plain list mentions
        tag = r"\s*\[[^\]\n]+\]" if e.get("tagged") else r"(?:\s*\[[^\]\n]+\])?"
        pat = r"\n\s*" + r"\s+".join(map(re.escape, title.split())) + tag + r"\s*\n"
        m = re.search(pat, raw[start:])
        if m:
            found.append((start + m.start(), start + m.end(), e))
    found.sort(key=lambda x: x[0])
    for i, (s0, s1, e) in enumerate(found):
        end = found[i + 1][0] if i + 1 < len(found) else len(raw)
        body = raw[s1:end]
        body = re.sub(r" -\n", "", body)  # hyphenation from the 2-column layout
        body = re.sub(r"(?<=[a-z])-\n(?=[a-z])", "", body)
        body = re.sub(r"\s*\n\s*", " ", body).strip()
        body = re.sub(r"\s+([,.;:])", r"\1", body)
        e["en_text"] = body
    return len(found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(os.path.dirname(__file__), ".cache"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "src", "glossary.generated.ts"))
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)

    entries = parse_zh(a.cache)
    names = ids_for(entries)
    for e in entries:
        names.setdefault(e["en"], e["id"])
    # dedupe (the index page repeats some headings)
    seen, uniq = set(), []
    for e in entries:
        if e["id"] in seen:
            continue
        seen.add(e["id"])
        uniq.append(e)
    entries = uniq
    for e in entries:
        e["zh_text"] = clean_zh(e["raw"], names, e["id"])
    n_en = parse_en(a.cache, entries)

    rules, cond = [], {}
    for e in entries:
        text = {"en": e.get("en_text") or e["en"], "zh": e["zh_text"]}
        if e["id"].startswith("condition:"):
            cond[e["id"]] = text
            continue
        r = {"id": e["id"], "type": "rule", "category": e["cat"], "name": {"en": e["en"], "zh": e["zh"]}, "text": text}
        if e["id"][len("rule:"):] in NO_AUTOLINK:
            r["tags"] = ["no-autolink"]
        rules.append(r)

    header = (
        "// Generated by scripts/build_glossary.py — do not edit by hand.\n"
        "// Chinese: DND5eChm/SRD5.2Chm (CC BY 4.0). English: SRD 5.2 (CC BY 4.0, Wizards of the Coast).\n"
        'import type { RuleEntity } from "@forge/core";\n\n'
    )
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("export const GLOSSARY: RuleEntity[] = " + json.dumps(rules, ensure_ascii=False, indent=1) + ";\n\n")
        f.write("export const CONDITION_TEXT: Record<string, { en: string; zh: string }> = " + json.dumps(cond, ensure_ascii=False, indent=1) + ";\n")
    print(f"{len(rules)} rules, {len(cond)} conditions, english matched {n_en}/{len(entries)}", file=sys.stderr)


if __name__ == "__main__":
    main()
