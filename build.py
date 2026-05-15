#!/usr/bin/env python3
"""Inline app.js into template.html, producing the deployable single-file
index.html. Run this whenever you edit app.js or template.html.

Usage:
    python3 build.py
"""
from pathlib import Path

work = Path(__file__).parent
html = (work / "template.html").read_text()
js = (work / "app.js").read_text()

placeholder = "/* JAVASCRIPT_GOES_HERE */"
if placeholder not in html:
    raise SystemExit("Placeholder not found in template.html")

merged = html.replace(placeholder, js)
out = work / "index.html"
out.write_text(merged)
print(f"Wrote {out} ({len(merged):,} bytes)")
