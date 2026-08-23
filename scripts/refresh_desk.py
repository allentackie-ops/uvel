#!/usr/bin/env python3
"""AI fashion desk: look at the photo, keep only real outfits, write copy from the clothes."""
from __future__ import annotations

import base64
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOOKS = ROOT / "docs" / "looks"
DEST = ROOT / "docs" / "trends.json"
LOOKS.mkdir(parents=True, exist_ok=True)

IDS = [
    "leather-trench",
    "silk-slip",
    "wool-blazer",
    "wide-trousers",
    "vintage-denim",
    "cashmere-crew",
    "cowboy-boots",
    "poet-blouse",
    "suede-jacket",
    "satin-skirt",
    "field-jacket",
    "loafer",
    "herringbone-coat",
    "black-trouser",
    "oxford-shirt",
]

PROMPT = f"""You are the fashion desk for Uvel, a secondhand clothes app.

Look at THIS photo. Reply with JSON only, no markdown:
{{
  "keep": true,
  "title": "4-8 word editorial title of the clothes in the photo",
  "summary": "One or two sentences. Describe only clothes you can see. No invented city, event, or brand unless it is printed on the garment.",
  "source": "TikTok" | "Instagram" | "Snapchat" | "X",
  "shopQuery": "2-4 search words for those garments",
  "garmentIds": ["id"],
  "tag": "one word or short phrase for the platform tag, no hash"
}}

keep=true ONLY if this is a real photograph of one or two people wearing a complete outfit (street, studio, ootd, editorial).

keep=false if: collage, grid, magazine layout, "Mint" or other watermarks over a grid, product flat-lay, face close-up with no outfit, screenshot, meme, concert chaos, or the clothes are not the subject.

source is the platform this look belongs on:
- TikTok: fit-check, GRWM, casual ootd
- Instagram: editorial, street style, show
- Snapchat: flash, story, close night shot
- X: people posting what they wore today

garmentIds: pick 1-3 from {IDS}. Closest real matches only.
"""


def openai_key() -> str:
    k = os.environ.get("OPENAI_API_KEY", "").strip()
    if not k:
        sys.exit("OPENAI_API_KEY missing")
    return k


def vision(path: Path) -> dict | None:
    b64 = base64.b64encode(path.read_bytes()).decode()
    body = {
        "model": "gpt-4o-mini",
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
                    },
                ],
            }
        ],
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {openai_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print("vision fail", path.name, type(e).__name__)
        return None
    raw = data["choices"][0]["message"]["content"]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print("bad json", path.name)
        return None


def post_url(source: str, tag: str, query: str) -> str:
    t = re.sub(r"[^a-z0-9]+", "", (tag or query or "ootd").lower()) or "ootd"
    if source == "Instagram":
        return f"https://www.instagram.com/explore/tags/{t}/"
    if source == "TikTok":
        return f"https://www.tiktok.com/tag/{t}"
    if source == "Snapchat":
        return "https://www.snapchat.com/explore/Fashion"
    q = urllib.request.quote(query or tag or "outfit")
    return f"https://x.com/search?q={q}&f=live"


def slugify(title: str, fallback: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return (s[:40] or fallback)


def main() -> None:
    inbox = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/desk")
    files = sorted(p for p in inbox.glob("*.jpg") if p.stat().st_size > 20_000)
    if not files:
        sys.exit("no candidate jpgs")

    looks = []
    used_src = {"TikTok": 0, "Instagram": 0, "Snapchat": 0, "X": 0}
    for path in files:
        info = vision(path)
        if not info:
            continue
        if not info.get("keep"):
            print("drop", path.name, info.get("title") or info.get("reason"))
            continue
        source = info.get("source")
        if source not in used_src:
            source = "Instagram"
        if used_src[source] >= 3:
            # still keep but we cap later
            pass
        title = str(info.get("title") or "Today’s look").strip()[:72]
        summary = str(info.get("summary") or "").strip()[:220]
        gids = [g for g in info.get("garmentIds") or [] if g in IDS][:3] or ["oxford-shirt"]
        query = str(info.get("shopQuery") or title).strip()[:40]
        sid = slugify(title, path.stem)
        dest = LOOKS / f"{sid}.jpg"
        dest.write_bytes(path.read_bytes())
        used_src[source] += 1
        looks.append(
            {
                "id": sid,
                "slug": sid,
                "title": title,
                "source": source,
                "summary": summary,
                "imageUrl": f"https://raw.githubusercontent.com/allentackie-ops/uvel/main/docs/looks/{sid}.jpg",
                "postUrl": post_url(source, str(info.get("tag") or ""), query),
                "garmentIds": gids,
                "shopQuery": query,
                "heat": f"{source} · today",
            }
        )
        print("keep", source, title)

    # prefer a mix: Instagram first for the hero if we have one
    order = {"Instagram": 0, "TikTok": 1, "X": 2, "Snapchat": 3}
    looks.sort(key=lambda L: (order.get(L["source"], 9), L["title"]))
    if not looks:
        sys.exit("desk kept nothing")
    out = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "looks": looks[:12],
    }
    DEST.write_text(json.dumps(out, indent=2) + "\n")
    print("wrote", DEST, "n=", len(out["looks"]))


if __name__ == "__main__":
    main()
