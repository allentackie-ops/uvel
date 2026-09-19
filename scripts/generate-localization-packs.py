from __future__ import annotations

import concurrent.futures
import json
import re
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "lib" / "i18n.ts"
OUT = ROOT / ".localization-packs.json"

text = I18N.read_text()
langs = re.findall(r'\{ id: "([^"]+)", label:', text[text.index("export const LANGS"):text.index("const en:")])
en_block = text[text.index("const en: Copy = {"):text.index("};", text.index("const en: Copy = {")) + 2]
entries = dict((key, json.loads(value)) for key, value in re.findall(r'^\s+(\w+): ("(?:[^"\\]|\\.)*"),?$', en_block, re.M))

# Keep English variants authored in source; generate the remaining supported locales.
targets = [locale for locale in langs if locale not in {"en-US", "en-GB"}]
existing = {}
if OUT.exists():
    existing = json.loads(OUT.read_text())

schema = {
    "type": "object",
    "properties": {key: {"type": "string"} for key in entries},
    "required": list(entries),
    "additionalProperties": False,
}

system = """You are a senior mobile-app localization translator. Translate the supplied Uvel app copy into the requested locale. Return one JSON object with exactly the supplied keys. Preserve meaning, tone, punctuation, line breaks, interpolation-like words, and product names. Keep Uvel, Today, Shop, Mirror, Style DNA, First Find, and other branded feature names only when they are brand names; translate ordinary UI terms. Do not add explanations. Use natural UI language for the locale, not literal word-for-word translations. Maintain concise labels and accessibility-friendly phrasing."""


def translate(locale: str):
    client = OpenAI()
    prompt = json.dumps({"locale": locale, "strings": entries}, ensure_ascii=False)
    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"Translate these strings into locale {locale}:\n{prompt}"},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": f"uvel_copy_{locale.replace('-', '_')}",
                "strict": True,
                "schema": schema,
            },
        },
        max_completion_tokens=9000,
    )
    result = json.loads(response.choices[0].message.content)
    if set(result) != set(entries):
        raise ValueError(f"{locale}: incomplete key set")
    return locale, result


def save(pack):
    OUT.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n")

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    pending = {
        pool.submit(translate, locale): locale
        for locale in targets
        if locale not in existing or set(existing[locale]) != set(entries)
    }
    for future in concurrent.futures.as_completed(pending):
        locale, result = future.result()
        existing[locale] = result
        save(existing)
        print(f"generated {locale} ({len(existing)}/{len(targets)})", flush=True)

missing = [locale for locale in targets if locale not in existing]
if missing:
    raise SystemExit(f"Missing locales: {missing}")
print(f"complete: {OUT}", flush=True)

if __name__ == "__main__":
    pass
