#!/usr/bin/env python3
"""Export Goethe A1/A2/B1 vocab from the Gut-Lernen web app and emit
firmware/main/gut_lernen/gl_data.c + gl_data.h + gl_words_manifest.txt.

Run once from the sandbox where the web app dev server is reachable:
    python3 firmware/tools/gen_wordlist.py --out firmware
"""

import argparse
import json
import re
import sys
import urllib.request

BASE = "http://127.0.0.1:8001/app/app_17dhaf97kkf/api/vocab/lists"
UA = ("%7B%22user_id%22%3A%221874925066266697%22%2C%22tenant_id%22%3A4401377730"
      "%2C%22app_id%22%3A%22app_17dhaf97kkf%22%7D")
HEADERS = {
    "Accept": "application/json",
    "x-suda-csrf-token": "test",
    "cookie": "suda-csrf-token=test",
    "x-larkgw-suda-webuser": UA,
}

LIST_IDS = {
    "a1": "09c823c5-028e-4e1f-9180-db1ab9049c16",
    "a2": "6e48115f-227a-446d-9829-44778dc4ba07",
    "b1": "cbcb861f-1d33-4001-a4ce-d587658ef355",
}

JUNK_PREFIXES = ("Heute ist", "Berlin,",)
JUNK_EXACT = {"deutsch mexikanisch schwarz"}

MAX_GERMAN = 48
MAX_CN = 60
MAX_EX = 110
MAX_EX_CN = 80


def fetch_words(list_id):
    words = []
    page = 1
    while True:
        url = f"{BASE}/{list_id}/words?page={page}&pageSize=100"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        items = data.get("items", [])
        if not items:
            break
        words.extend(items)
        total = data.get("total", len(words))
        if len(words) >= total:
            break
        page += 1
    return words


def is_junk(german):
    g = german.strip()
    if not g:
        return True
    if g in JUNK_EXACT:
        return True
    if any(g.startswith(p) for p in JUNK_PREFIXES):
        return True
    if re.match(r"^[\d+\-]", g):
        return True
    if " = " in g or "; " in g:
        return True
    return False


def clean_display(german):
    g = german.strip()
    g = g.split("/")[0].strip() if " / " in g else g
    g = g.split(",")[0].strip()
    return g


def tts_text(display):
    t = re.sub(r"\([^)]*\)", "", display).strip()
    t = re.sub(r"\s+", " ", t)
    return t


def dedupe_key(display):
    k = display.lower()
    k = re.sub(r"^(der|die|das|ein|eine|einen)\s+", "", k)
    k = re.sub(r"[^a-zäöüß]", "", k)
    return k


def trunc(s, n):
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def c_escape(s):
    out = s.replace("\\", "\\\\").replace('"', '\\"')
    out = out.replace("\n", " ").replace("\r", " ")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="firmware", help="repo root path")
    args = ap.parse_args()

    levels = []
    for lvl in ("a1", "a2", "b1"):
        words = fetch_words(LIST_IDS[lvl])
        print(f"{lvl}: fetched {len(words)} raw entries")
        levels.append(words)

    seen = set()
    out_levels = []
    for words in levels:
        kept = []
        for w in words:
            if is_junk(w.get("german") or ""):
                continue
            disp = clean_display(w["german"])
            if not disp:
                continue
            key = dedupe_key(disp)
            if not key or key in seen:
                continue
            seen.add(key)
            kept.append({
                "german": trunc(disp, MAX_GERMAN),
                "phonetic": "",
                "chinese": trunc(w.get("chinese") or "", MAX_CN),
                "example": trunc(w.get("example") or "", MAX_EX),
                "example_cn": trunc(w.get("exampleCn") or "", MAX_EX_CN),
            })
        print(f"  kept {len(kept)} after junk-filter + dedupe")
        out_levels.append(kept)

    counts = [len(lv) for lv in out_levels]
    total = sum(counts)
    print(f"TOTAL: {total} (A1 {counts[0]}, A2 {counts[1]}, B1 {counts[2]})")

    a2_first = counts[0]
    b1_first = counts[0] + counts[1]

    names = ["GL_A1", "GL_A2", "GL_B1"]

    data_c = []
    data_c.append('#include "gl_data.h"\n')
    for name, lv in zip(names, out_levels):
        data_c.append(f"static const gl_word_t {name}[] = {{")
        for w in lv:
            data_c.append(
                '    {{.german = "{}", .phonetic = "{}",\n'
                '    .chinese = "{}",\n'
                '    .example = "{}", .example_cn = "{}",}},'.format(
                    c_escape(w["german"]), c_escape(w["phonetic"]),
                    c_escape(w["chinese"]), c_escape(w["example"]),
                    c_escape(w["example_cn"])))
        data_c.append("};\n")
    data_c.append("const gl_word_t *const GL_LEVEL_TABLE[] = {")
    data_c.append("    GL_A1, GL_A2, GL_B1,")
    data_c.append("};\n")
    data_c.append("const uint16_t GL_LEVEL_COUNTS[] = {")
    data_c.append(f"    {counts[0]}, {counts[1]}, {counts[2]},")
    data_c.append("};\n")
    data_c.append(f"const uint16_t GL_WORD_TOTAL = {total};\n")

    with open(f"{args.out}/main/gut_lernen/gl_data.c", "w", encoding="utf-8") as f:
        f.write("\n".join(data_c))

    data_h = f"""#pragma once

#include <stdint.h>

typedef struct {{
    const char *german;
    const char *phonetic;
    const char *chinese;
    const char *example;
    const char *example_cn;
}} gl_word_t;

extern const gl_word_t *const GL_LEVEL_TABLE[3];
extern const uint16_t GL_LEVEL_COUNTS[3];
extern const uint16_t GL_WORD_TOTAL;

/* Flat index helpers: 0 .. A1-1 | A1 .. A1+A2-1 | ... */
#define GL_LEVEL_A1_FIRST (0u)
#define GL_LEVEL_A2_FIRST ({a2_first}u)
#define GL_LEVEL_B1_FIRST ({b1_first}u)
"""
    with open(f"{args.out}/main/gut_lernen/gl_data.h", "w", encoding="utf-8") as f:
        f.write(data_h)

    with open(f"{args.out}/main/gut_lernen/gl_words_manifest.txt", "w",
              encoding="utf-8") as f:
        idx = 0
        for lv in out_levels:
            for w in lv:
                f.write(f"{idx}\t{tts_text(w['german'])}\n")
                idx += 1

    print(f"wrote gl_data.c / gl_data.h / gl_words_manifest.txt under {args.out}/main/gut_lernen/")
    print(f"GL_LEVEL_A2_FIRST={a2_first} GL_LEVEL_B1_FIRST={b1_first}")


if __name__ == "__main__":
    sys.exit(main())
