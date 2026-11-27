"""Prepare the Linux desktop-smoke app tree (.research/desktop-smoke-app).

Mirrors the Windows package layout byte-for-byte where it matters (renderer
with injected CSP, desktop bridge, native tools, firmware), so CI can launch
the exact packaged renderer under Electron on Linux and assert the workbench
renders instead of opening to a blank window. The Electron binary is
downloaded from the pinned official release and verified against that
release's own SHASUMS256.txt.
"""
import hashlib
import json
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
from renderer_csp import embed_csp, check_script_authorized  # noqa: E402

VERSION = '45.5.0'
BASE = f'https://github.com/electron/electron/releases/download/v{VERSION}'
RUNTIME_ZIP = f'electron-v{VERSION}-linux-x64.zip'
RUNTIME_DIR = ROOT / '.research/runtime/linux'
APP = ROOT / '.research/desktop-smoke-app'

def download(url, dest):
    with urllib.request.urlopen(url, timeout=600) as response:
        data = response.read()
    dest.write_bytes(data)
    return data

def sha256_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

if not (ROOT / 'dist/index.html').is_file():
    print('dist/index.html is missing; run `npm run build` first.', file=sys.stderr)
    sys.exit(1)

# --- Electron runtime, verified against the release's SHASUMS256.txt ---
RUNTIME_DIR.parent.mkdir(parents=True, exist_ok=True)
if RUNTIME_DIR.exists():
    shutil.rmtree(RUNTIME_DIR)
RUNTIME_DIR.mkdir(parents=True)
cache = Path('.research/runtime')
cache.mkdir(parents=True, exist_ok=True)
archive = cache / RUNTIME_ZIP
if not archive.exists():
    print(f'Downloading {BASE}/{RUNTIME_ZIP} ...')
    download(f'{BASE}/{RUNTIME_ZIP}', archive)
sums = cache / 'SHASUMS256.txt'
if not sums.exists():
    print(f'Downloading {BASE}/SHASUMS256.txt ...')
    download(f'{BASE}/SHASUMS256.txt', sums)
expected = None
for line in sums.read_text().splitlines():
    digest, _, name = line.partition('  ')
    if name.strip() == RUNTIME_ZIP:
        expected = digest.strip()
        break
assert expected, f'{RUNTIME_ZIP} not found in SHASUMS256.txt'
actual = sha256_file(archive)
assert actual == expected, f'Electron runtime checksum mismatch: {actual} != {expected}'
with zipfile.ZipFile(archive) as z:
    z.extractall(RUNTIME_DIR)
electron = RUNTIME_DIR / 'electron'
assert electron.is_file(), 'Electron binary missing after extraction'
electron.chmod(0o755)
print(f'Electron {VERSION} verified and extracted ({expected[:16]}...)')

# --- App tree, mirroring scripts/package-windows.py ---
if APP.exists():
    shutil.rmtree(APP)
APP.mkdir(parents=True)
(APP / 'package.json').write_text(json.dumps({
    'name': 'ardpic-studio',
    'version': '1.0.0',
    'main': 'desktop/main.cjs',
    'author': 'Ahmed Emad El-Din Hussein',
    'description': 'Arduino-powered PIC programming workbench',
}))
shutil.copytree(
    ROOT / 'desktop', APP / 'desktop',
    ignore=shutil.ignore_patterns('*.elf', '*.eep', '*.bin', '*.with_bootloader.hex',
                                  'ArdPIC Studio.exe', '*.o', '.gitignore'),
)
(APP / 'src/lib').mkdir(parents=True)
shutil.copy2(ROOT / 'src/lib/hex.mjs', APP / 'src/lib/hex.mjs')
(APP / 'dist').mkdir()
paged = embed_csp((ROOT / 'dist/index.html').read_bytes().decode('utf-8'))
check_script_authorized(paged)  # fail here rather than smoke-test a broken page
(APP / 'dist/index.html').write_bytes(paged.encode('utf-8'))
shutil.copy2(ROOT / 'public/favicon.svg', APP / 'dist/favicon.svg')
print(f'Desktop smoke app staged at {APP}')
