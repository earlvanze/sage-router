#!/usr/bin/env python3
"""Check local runtime override files against canonical Sage Router sources."""

import argparse
import filecmp
import json
import shutil
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CYBER_GATEWAY_ROOT = Path("/mnt/c/Users/digit/Dropbox/Projects/cyber-gateway")
DEFAULT_CODEX_PROXY_PATH = Path("/mnt/c/Users/digit/codex-sage-router-proxy.py")
REQUIRED_MARKERS = {
    "cyber_gateway_router_override": [
        "def strip_model_prefix_tool_placeholder_noise(text: str):",
        "if not labels and '/' in stripped and stripped.rsplit('/', 1)[1] and re.fullmatch(PARTIAL_MODEL_PREFIX_LABEL_RE, stripped):",
        "def sanitize_provider_visible_text(text, provider_name, model):",
    ],
    "codex_responses_proxy_mount": [
        "def strip_model_prefix_tool_placeholder_noise(text):",
        'if not labels and "/" in stripped and stripped.rsplit("/", 1)[1] and re.fullmatch(PARTIAL_MODEL_PREFIX_LABEL_RE, stripped):',
        "def sanitize_visible_output(text):",
    ],
}


def backup_path(path):
    return path.with_name(f"{path.name}.bak-parity-{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}")


def file_contains_markers(path, markers):
    try:
        text = Path(path).read_text(errors="replace")
    except OSError:
        return False, list(markers)
    missing = [marker for marker in markers if marker not in text]
    return not missing, missing


def compare_file(name, source, target, sync=False, strict=False):
    source = Path(source)
    target = Path(target)
    result = {
        "name": name,
        "source": str(source),
        "target": str(target),
        "status": "unknown",
        "backup": None,
        "exactMatch": False,
        "missingMarkers": [],
    }
    if not source.exists():
        result["status"] = "source_missing"
        return result
    if not target.exists():
        result["status"] = "target_missing"
        return result
    if filecmp.cmp(source, target, shallow=False):
        result["status"] = "in_sync"
        result["exactMatch"] = True
        return result
    markers = REQUIRED_MARKERS.get(name) or []
    if markers and not strict and not sync:
        marker_ok, missing = file_contains_markers(target, markers)
        result["missingMarkers"] = missing
        if marker_ok:
            result["status"] = "custom_with_required_markers"
            return result
    if not sync:
        result["status"] = "mismatch"
        if markers:
            result["missingMarkers"] = file_contains_markers(target, markers)[1]
        return result
    backup = backup_path(target)
    shutil.copy2(target, backup)
    shutil.copy2(source, target)
    result["backup"] = str(backup)
    result["status"] = "synced" if filecmp.cmp(source, target, shallow=False) else "sync_failed"
    result["exactMatch"] = result["status"] == "synced"
    return result


def build_checks(cyber_gateway_root=DEFAULT_CYBER_GATEWAY_ROOT, codex_proxy_path=DEFAULT_CODEX_PROXY_PATH):
    cyber_gateway_root = Path(cyber_gateway_root)
    return [
        {
            "name": "cyber_gateway_router_override",
            "source": ROOT / "router.py",
            "target": cyber_gateway_root / "overrides" / "sage-router" / "router.py",
        },
        {
            "name": "codex_responses_proxy_mount",
            "source": ROOT / "scripts" / "codex_sage_router_proxy.py",
            "target": Path(codex_proxy_path),
        },
    ]


def check_parity(cyber_gateway_root=DEFAULT_CYBER_GATEWAY_ROOT, codex_proxy_path=DEFAULT_CODEX_PROXY_PATH, sync=False, strict=False):
    results = [
        compare_file(check["name"], check["source"], check["target"], sync=sync, strict=strict)
        for check in build_checks(cyber_gateway_root, codex_proxy_path)
    ]
    checked = [item for item in results if item["status"] not in {"target_missing"}]
    failures = [
        item for item in results
        if item["status"] in {"source_missing", "mismatch", "sync_failed"}
    ]
    return {
        "ok": not failures,
        "checked": len(checked),
        "results": results,
    }


def text_report(payload):
    lines = ["Sage Router runtime override parity"]
    for item in payload["results"]:
        status = item["status"]
        lines.append(f"- {item['name']}: {status}")
        lines.append(f"  source: {item['source']}")
        lines.append(f"  target: {item['target']}")
        if item.get("missingMarkers"):
            lines.append("  missing markers:")
            for marker in item["missingMarkers"]:
                lines.append(f"    - {marker}")
        if item.get("backup"):
            lines.append(f"  backup: {item['backup']}")
    if payload["checked"] == 0:
        lines.append("No local runtime override targets were found; nothing to compare on this host.")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cyber-gateway-root", default=str(DEFAULT_CYBER_GATEWAY_ROOT))
    parser.add_argument("--codex-proxy-path", default=str(DEFAULT_CODEX_PROXY_PATH))
    parser.add_argument("--sync", action="store_true", help="backup and replace mismatched existing targets")
    parser.add_argument("--strict", action="store_true", help="fail unless existing targets are byte-for-byte identical")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args()

    payload = check_parity(
        cyber_gateway_root=args.cyber_gateway_root,
        codex_proxy_path=args.codex_proxy_path,
        sync=args.sync,
        strict=args.strict,
    )
    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(text_report(payload))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
