#!/usr/bin/env python3
"""Find or create the App Store Connect app; print the numeric ascAppId."""

from __future__ import annotations

import json
import os
import sys
import time

import jwt
import requests

BUNDLE_ID = "com.uvel.dressandshop"
APP_NAME = "Uvel"
SKU = "uvel-dress-and-shop"
ASC = "https://api.appstoreconnect.apple.com/v1"


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": os.environ["ASC_ISSUER_ID"].strip(),
            "iat": now,
            "exp": now + 1100,
            "aud": "appstoreconnect-v1",
        },
        os.environ["ASC_API_KEY"].replace("\\n", "\n").strip(),
        algorithm="ES256",
        headers={"alg": "ES256", "kid": os.environ["ASC_KEY_ID"].strip(), "typ": "JWT"},
    )


def api(method: str, path: str, jwt_token: str, **kwargs):
    r = requests.request(
        method,
        f"{ASC}{path}",
        headers={
            "Authorization": f"Bearer {jwt_token}",
            "Content-Type": "application/json",
        },
        timeout=60,
        **kwargs,
    )
    if r.status_code >= 400:
        try:
            body = r.json()
        except Exception:
            body = r.text
        print(f"Apple API {method} {path} -> {r.status_code}", file=sys.stderr)
        print(json.dumps(body, indent=2) if not isinstance(body, str) else body, file=sys.stderr)
        raise SystemExit(1)
    if r.status_code == 204 or not r.content:
        return None
    return r.json()


def main() -> None:
    jwt_token = token()
    existing = api(
        "GET",
        f"/apps?filter[bundleId]={BUNDLE_ID}&limit=5",
        jwt_token,
    )
    apps = (existing or {}).get("data") or []
    if apps:
        app_id = apps[0]["id"]
        print(app_id)
        return

    bundles = api(
        "GET",
        f"/bundleIds?filter[identifier]={BUNDLE_ID}&limit=5",
        jwt_token,
    )
    if not bundles or not bundles.get("data"):
        print(f"No App ID {BUNDLE_ID} on this Apple team", file=sys.stderr)
        raise SystemExit(1)
    bundle_res_id = bundles["data"][0]["id"]

    created = api(
        "POST",
        "/apps",
        jwt_token,
        json={
            "data": {
                "type": "apps",
                "attributes": {
                    "name": APP_NAME,
                    "primaryLocale": "en-US",
                    "sku": SKU,
                },
                "relationships": {
                    "bundleId": {
                        "data": {"type": "bundleIds", "id": bundle_res_id}
                    }
                },
            }
        },
    )
    print(created["data"]["id"])


if __name__ == "__main__":
    main()
