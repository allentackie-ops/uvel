#!/usr/bin/env python3
"""Create an Apple Distribution cert + App Store profile; write credentials.json."""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import jwt
import requests

BUNDLE_ID = "com.uvel.dressandshop"
PROFILE_NAME = "Uvel App Store"
ASC = "https://api.appstoreconnect.apple.com/v1"


class AppleApiError(RuntimeError):
    def __init__(self, status: int, path: str, body: object):
        super().__init__(f"Apple API {path} -> {status}: {body}")
        self.status = status
        self.body = body


def die(msg: str, extra: object | None = None) -> None:
    print(msg, file=sys.stderr)
    if extra is not None:
        print(json.dumps(extra, indent=2) if not isinstance(extra, str) else extra, file=sys.stderr)
    raise SystemExit(1)


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.check_call(cmd)


def token() -> str:
    key_id = os.environ["ASC_KEY_ID"].strip()
    issuer = os.environ["ASC_ISSUER_ID"].strip()
    p8 = os.environ["ASC_API_KEY"].replace("\\n", "\n").strip()
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        p8,
        algorithm="ES256",
        headers={"alg": "ES256", "kid": key_id, "typ": "JWT"},
    )


def api(method: str, path: str, jwt_token: str, **kwargs):
    r = requests.request(
        method,
        f"{ASC}{path}" if path.startswith("/") else path,
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
        raise AppleApiError(r.status_code, f"{method} {path}", body)
    if r.status_code == 204 or not r.content:
        return None
    return r.json()


def main() -> None:
    password = os.environ.get("CERT_PASSWORD", "uvel2026")
    certs = Path("certs")
    certs.mkdir(exist_ok=True)
    key_path = certs / "dist.key"
    csr_path = certs / "dist.csr"
    cer_path = certs / "dist.cer"
    pem_path = certs / "dist.pem"
    p12_path = certs / "dist.p12"
    profile_path = certs / "profile.mobileprovision"

    run(["openssl", "genrsa", "-out", str(key_path), "2048"])
    run(
        [
            "openssl",
            "req",
            "-new",
            "-key",
            str(key_path),
            "-out",
            str(csr_path),
            "-subj",
            "/CN=Uvel Distribution/O=Uvel/C=GH",
        ]
    )
    csr = csr_path.read_text()
    jwt_token = token()

    def create_cert():
        return api(
            "POST",
            "/certificates",
            jwt_token,
            json={
                "data": {
                    "type": "certificates",
                    "attributes": {
                        "csrContent": csr,
                        "certificateType": "DISTRIBUTION",
                    },
                }
            },
        )

    try:
        created = create_cert()
    except AppleApiError as exc:
        print(exc)
        if exc.status != 409:
            die("Certificate create failed", exc.body)
        print("Distribution cert slot full — revoking leftover CI certs, then retrying once")
        existing_certs = api("GET", "/certificates?limit=200", jwt_token)
        for item in (existing_certs or {}).get("data", []):
            ctype = (item.get("attributes") or {}).get("certificateType") or ""
            if ctype not in {"DISTRIBUTION", "IOS_DISTRIBUTION"}:
                continue
            cid = item["id"]
            print("Revoking leftover", ctype, cid)
            api("DELETE", f"/certificates/{cid}", jwt_token)
        created = create_cert()

    cert_id = created["data"]["id"]
    der_b64 = created["data"]["attributes"]["certificateContent"]
    print("Created distribution certificate", cert_id)
    cer_path.write_bytes(base64.b64decode(der_b64))
    run(["openssl", "x509", "-inform", "DER", "-in", str(cer_path), "-out", str(pem_path)])
    # macOS `security import` (EAS) cannot read OpenSSL 3 default PBES2 p12s.
    p12_cmd = [
        "openssl",
        "pkcs12",
        "-export",
        "-inkey",
        str(key_path),
        "-in",
        str(pem_path),
        "-out",
        str(p12_path),
        "-passout",
        f"pass:{password}",
        "-name",
        "Uvel Distribution",
        "-legacy",
    ]
    try:
        run(p12_cmd)
    except subprocess.CalledProcessError:
        run(
            [
                "openssl",
                "pkcs12",
                "-export",
                "-inkey",
                str(key_path),
                "-in",
                str(pem_path),
                "-out",
                str(p12_path),
                "-passout",
                f"pass:{password}",
                "-name",
                "Uvel Distribution",
                "-certpbe",
                "PBE-SHA1-3DES",
                "-keypbe",
                "PBE-SHA1-3DES",
                "-macalg",
                "sha1",
            ]
        )

    bundles = api(
        "GET",
        f"/bundleIds?filter[identifier]={BUNDLE_ID}&limit=5",
        jwt_token,
    )
    if not bundles or not bundles.get("data"):
        die(f"No App ID {BUNDLE_ID} on this team. Register it in the Apple Developer portal.")
    bundle_res_id = bundles["data"][0]["id"]
    print("Bundle id resource", bundle_res_id)

    try:
        api(
            "POST",
            "/bundleIdCapabilities",
            jwt_token,
            json={
                "data": {
                    "type": "bundleIdCapabilities",
                    "attributes": {"capabilityType": "PUSH_NOTIFICATIONS"},
                    "relationships": {
                        "bundleId": {"data": {"type": "bundleIds", "id": bundle_res_id}}
                    },
                }
            },
        )
        print("Enabled Push Notifications on", BUNDLE_ID)
    except AppleApiError as exc:
        if exc.status in {409, 422}:
            print("Push Notifications already on", BUNDLE_ID)
        else:
            die("Couldn’t enable Push Notifications", exc.body)

    existing = api("GET", f"/profiles?filter[name]={requests.utils.quote(PROFILE_NAME)}&limit=20", jwt_token)
    for prof in (existing or {}).get("data", []):
        if prof.get("attributes", {}).get("name") == PROFILE_NAME:
            api("DELETE", f"/profiles/{prof['id']}", jwt_token)
            print("Deleted old profile", prof["id"])

    profile = api(
        "POST",
        "/profiles",
        jwt_token,
        json={
            "data": {
                "type": "profiles",
                "attributes": {
                    "name": PROFILE_NAME,
                    "profileType": "IOS_APP_STORE",
                },
                "relationships": {
                    "bundleId": {"data": {"type": "bundleIds", "id": bundle_res_id}},
                    "certificates": {"data": [{"type": "certificates", "id": cert_id}]},
                },
            }
        },
    )
    profile_b64 = profile["data"]["attributes"]["profileContent"]
    profile_path.write_bytes(base64.b64decode(profile_b64))
    print("Wrote", profile_path)

    cred = {
        "ios": {
            "provisioningProfilePath": str(profile_path),
            "distributionCertificate": {
                "path": str(p12_path),
                "password": password,
            },
        }
    }
    Path("credentials.json").write_text(json.dumps(cred, indent=2) + "\n")
    print("Wrote credentials.json")


if __name__ == "__main__":
    try:
        main()
    except AppleApiError as exc:
        die(str(exc), exc.body)
