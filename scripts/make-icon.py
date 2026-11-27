#!/usr/bin/env python3
"""Regenerate desktop/app.ico from the committed 256px brand PNG.

The launcher resource (desktop/launcher.rc) and the Electron window icon
(desktop/main.cjs) both reference desktop/app.ico. The multi-size ICO is
committed, so normal builds do not need Pillow; this script exists so the
icon can be rebuilt deterministically if the brand art changes.

Usage:  python3 scripts/make-icon.py
Requires: pip install pillow
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    ROOT / ".research" / "toolchain" / "icon-256.png",
    ROOT / ".research" / "toolchain" / "icon.png",
]
OUT = ROOT / "desktop" / "app.ico"
SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def main() -> None:
    for source in SOURCES:
        if source.is_file():
            logo = Image.open(source).convert("RGBA")
            logo.save(OUT, format="ICO", sizes=SIZES)
            print(f"Wrote {OUT.relative_to(ROOT)} from {source.relative_to(ROOT)}")
            return
    raise SystemExit("No brand PNG found in .research/toolchain/ (icon-256.png or icon.png).")


if __name__ == "__main__":
    main()
