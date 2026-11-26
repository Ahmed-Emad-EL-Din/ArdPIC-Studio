#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
CXX="${CXX:-x86_64-w64-mingw32-g++}"
WINDRES="${WINDRES:-x86_64-w64-mingw32-windres}"
mkdir -p desktop/bin
"$CXX" -std=c++17 -O2 -Wall -static -s -Wl,--no-insert-timestamp \
  '-DARDPICPROG_VERSION="1.8.horo-studio1"' \
  desktop/vendor/host/main.cpp desktop/vendor/host/hexfile.cpp \
  desktop/vendor/host/serialport.cpp desktop/vendor/host/serialport_win.cpp \
  -o desktop/bin/ardpicprog.exe
(cd desktop && "$WINDRES" launcher.rc -O coff -o launcher-res.o)
"$CXX" -std=c++17 -Os -static -s -municode -mwindows -Wl,--no-insert-timestamp \
  desktop/launcher.cpp desktop/launcher-res.o -o 'desktop/ArdPIC Studio.exe'
rm desktop/launcher-res.o
python3 - <<'PY'
from pathlib import Path
import hashlib,json
p=Path('desktop/bin')
files=['ardpicprog.exe','avrdude.exe','avrdude.conf','libusb0.dll']
Path('desktop/binary-checksums.json').write_text(json.dumps({n:hashlib.sha256((p/n).read_bytes()).hexdigest() for n in files},indent=2)+'\n')
PY
echo 'Compiled the x64 launcher and guarded programmer host.'