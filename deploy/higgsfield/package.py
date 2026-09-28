#!/usr/bin/env python3
"""Package the tested Vite build into an existing Higgsfield website checkout."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path


def package(source: Path, target: Path) -> dict[str, str]:
    """Copy the built app and hosting adapters; return deployed source metadata."""
    app = target / "app"
    if not (app / "src/server.ts").is_file():
        raise ValueError("Target must be a Higgsfield website checkout containing app/src/server.ts.")
    html = (source / "dist/index.html").read_text()
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    styles = re.findall(r'<link[^>]+href="([^"]+[.]css)"', html)
    if len(scripts) != 1 or len(styles) != 1 or not scripts[0].startswith("/colony/"):
        raise ValueError("Run npm run build -- --base=/colony/ before packaging.")
    destination = app / "public/colony"
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source / "dist", destination)
    shutil.copytree(source / "public/data", app / "public/data", dirs_exist_ok=True)
    shutil.copy2(source / "public/favicon.svg", app / "public/favicon.svg")
    templates = source / "deploy/higgsfield"
    shutil.copy2(templates / "root.tsx", app / "src/routes/__root.tsx")
    shutil.copy2(templates / "index.tsx", app / "src/routes/index.tsx")
    commit = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    result = {"source_repository": "https://github.com/Mukhsin0508/observable-colony",
              "source_commit": commit, "script": scripts[0], "stylesheet": styles[0]}
    (app / "src/colony-build.json").write_text(json.dumps(result, indent=2) + "\n")
    (app / "public/version.json").write_text(json.dumps(result, indent=2) + "\n")
    # Keep platform error handling while adding headers to all Worker responses.
    server = app / "src/server.ts"
    code = server.read_text()
    if 'import { applySecurityHeaders }' not in code:
        code = 'import { applySecurityHeaders } from "./lib/security-headers.server";\n' + code
        code = code.replace("return await normalizeCatastrophicSsrResponse(response);",
                            "return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));")
        code = code.replace("return new Response(renderErrorPage(), {\n        status: 500,",
                            "return applySecurityHeaders(new Response(renderErrorPage(), {\n        status: 500,")
        code = code.replace('headers: { "content-type": "text/html; charset=utf-8" },\n      });',
                            'headers: { "content-type": "text/html; charset=utf-8" },\n      }));')
        server.write_text(code)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--target", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(package(args.source.resolve(), args.target.resolve()), indent=2))


if __name__ == "__main__":
    main()
