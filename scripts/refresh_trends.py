#!/usr/bin/env python3
"""Pull today's fashion desk from public RSS + map onto Uvel pieces."""
from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

FEEDS = [
    ("TikTok", "https://www.whowhatwear.com/rss.xml"),
    ("Instagram", "https://www.vogue.com/feed/rss"),
    ("X", "https://www.highsnobiety.com/rss"),
]

MAP = [
    ("cashmere|camel|quiet luxury|loafers|knit", "bourgeois-chic", ["cashmere-crew", "oxford-shirt", "wide-trousers", "loafer"], "camel cashmere"),
    ("western|suede|cowboy|boot", "western-city", ["suede-jacket", "vintage-denim", "cowboy-boots"], "suede western"),
    ("utility|cargo|field jacket|toggle", "utility-real", ["field-jacket", "cashmere-crew", "vintage-denim"], "field jacket"),
    ("slip|satin|silk|evening", "liquid-evening", ["silk-slip", "satin-skirt", "poet-blouse"], "silk slip"),
    ("layer|blouse|90s|grunge", "layered-max", ["oxford-shirt", "poet-blouse", "wide-trousers"], "layered blouse"),
    ("boho|poet|volume", "boho-26", ["poet-blouse", "satin-skirt", "silk-slip"], "poet blouse"),
    ("blazer|trench|shoulder|napoleon", "napoleon", ["leather-trench", "wool-blazer", "herringbone-coat"], "blazer trench"),
    ("sunday|outfit|street", "sunday-fit", ["cashmere-crew", "oxford-shirt", "loafer"], "oxford loafers"),
]

SOURCE_OF = {
    "bourgeois-chic": "TikTok",
    "layered-max": "TikTok",
    "boho-26": "TikTok",
    "western-city": "Instagram",
    "napoleon": "Instagram",
    "liquid-evening": "Snapchat",
    "utility-real": "X",
    "sunday-fit": "X",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "UvelTrends/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "ignore")


def items(xml: str):
    root = ET.fromstring(xml)
    out = []
    for node in root.iter():
        if node.tag.lower().endswith("item") or node.tag.lower().endswith("entry"):
            title = ""
            link = ""
            summary = ""
            for c in node:
                tag = c.tag.lower()
                if tag.endswith("title") and c.text:
                    title = c.text.strip()
                elif tag.endswith("link"):
                    link = (c.text or c.attrib.get("href") or "").strip()
                elif tag.endswith("description") or tag.endswith("summary"):
                    summary = re.sub("<[^>]+>", "", (c.text or "")).strip()
            if title:
                out.append((title, link, summary[:180]))
    return out[:12]


def main():
    blob: list[tuple[str, str, str, str]] = []
    for source, url in FEEDS:
        try:
            blob.extend((source, *row) for row in items(fetch(url)))
        except Exception as e:
            print("feed fail", url, e)

    hits: dict[str, dict] = {}
    for source, title, link, summary in blob:
        blob_l = f"{title} {summary}".lower()
        for pat, slug, gids, q in MAP:
            if re.search(pat, blob_l) and slug not in hits:
                hits[slug] = {
                    "id": slug,
                    "slug": slug,
                    "title": title.split("|")[0].strip()[:72],
                    "source": SOURCE_OF.get(slug, source),
                    "summary": summary or title,
                    "garmentIds": gids,
                    "shopQuery": q,
                    "heat": f"{SOURCE_OF.get(slug, source)} · today",
                    "postUrl": link or None,
                }

    # keep a stable desk even if RSS is quiet
    seed = json.loads((Path(__file__).resolve().parents[1] / "docs" / "trends.json").read_text())
    by_id = {row["id"]: row for row in seed.get("looks", [])}
    by_id.update(hits)
    looks = list(by_id.values())
    out = {"updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "looks": looks}
    dest = Path(__file__).resolve().parents[1] / "docs" / "trends.json"
    dest.write_text(json.dumps(out, indent=2) + "\n")
    print("wrote", dest, "looks", len(looks))


if __name__ == "__main__":
    main()
