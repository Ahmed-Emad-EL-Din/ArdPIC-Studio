"""Build the portable Windows app using the pinned official Electron runtime."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = '45.5.0'
RUNTIME = f'electron-v{VERSION}-win32-x64.zip'
EXPECTED = '20155c8b8aa5b1f575f3757bdf21490e0bac2f19a65a26ce9ba99bcf9f2c69bd'
cache = ROOT / '.research/runtime'
cache.mkdir(parents=True, exist_ok=True)
archive = cache / RUNTIME
if not archive.exists():
    urllib.request.urlretrieve(f'https://github.com/electron/electron/releases/download/v{VERSION}/{RUNTIME}', archive)
assert hashlib.sha256(archive.read_bytes()).hexdigest() == EXPECTED, 'Runtime checksum mismatch'
for name, sha in json.loads((ROOT / 'desktop/binary-checksums.json').read_text()).items():
    assert hashlib.sha256((ROOT / 'desktop/bin' / name).read_bytes()).hexdigest() == sha, f'{name}: checksum mismatch'
for board in ['uno', 'nano']:
    image = ROOT / f'desktop/firmware/{board}/ProgramPic.ino.hex'
    assert hashlib.sha256(image.read_bytes()).hexdigest() == '742dacffec6e9a609b6789384dde1671d7c52393fbe6237caa4c6204076c3384'
subprocess.run(['npm', 'run', 'build'], check=True, cwd=ROOT, shell=(__import__('os').name == 'nt'))

with tempfile.TemporaryDirectory(prefix='ardpic-package-') as tmp:
    package = Path(tmp) / 'ArdPIC Studio'
    runtime = package / 'runtime'
    with zipfile.ZipFile(archive) as z:
        z.extractall(runtime)
    app = runtime / 'resources/app'
    app.mkdir(parents=True)
    (runtime / 'resources/default_app.asar').unlink(missing_ok=True)
    (app / 'package.json').write_text(json.dumps({'name': 'ardpic-studio', 'version': '1.0.0', 'main': 'desktop/main.cjs', 'author': 'Ahmed Emad El-Din Hussein', 'description': 'Arduino-powered PIC programming workbench'}))
    shutil.copytree(ROOT / 'desktop', app / 'desktop', ignore=shutil.ignore_patterns('*.elf', '*.eep', '*.bin', '*.with_bootloader.hex', 'ArdPIC Studio.exe', '*.o', '.gitignore'))
    (app / 'src/lib').mkdir(parents=True)
    shutil.copy2(ROOT / 'src/lib/hex.mjs', app / 'src/lib/hex.mjs')
    (app / 'dist').mkdir()
    # A single-file renderer has a hash-based CSP; it never needs a network connection.
    import re, base64
    html = (ROOT / 'dist/index.html').read_text()
    scripts = re.findall(r'<script\b[^>]*>(.*?)</script>', html, re.S)
    sources = ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() + "'" for s in scripts)
    csp = f"default-src 'none'; script-src {sources}; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
    html = html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="' + csp + '">', 1)
    (app / 'dist/index.html').write_text(html)
    shutil.copy2(ROOT / 'public/favicon.svg', app / 'dist/favicon.svg')
    shutil.copy2(ROOT / 'desktop/ArdPIC Studio.exe', package / 'ArdPIC Studio.exe')
    shutil.copytree(ROOT / 'docs', package / 'Documentation')
    shutil.copy2(ROOT / 'README.md', package / 'README.md')
    shutil.copy2(ROOT / 'plain.md', package / 'Implementation-checklist.md')
    (package / 'READ ME FIRST.txt').write_text('ArdPIC Studio 1.0.0\nMade By: Ahmed Emad El-Din Hussein\n\nExtract the entire folder, then run ArdPIC Studio.exe.\nNo separate Arduino IDE or CLI is required.\n\nUnsigned engineering build. Do not approve production use before completing Documentation/acceptance.md.\nOnly use the matching Ho-Ro 1.8.horo circuit. The original rweather shield has different pins and polarity.\nThe application does not measure VDD or VPP. No physical board was tested during this build.\n\nSources and notices are in runtime/resources/app/desktop/vendor and licenses.\n')
    output = ROOT / 'public/downloads/ArdPIC-Studio-Windows-x64.zip'
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for file in sorted(package.rglob('*')):
            if file.is_file(): z.write(file, file.relative_to(Path(tmp)))
    (output.parent / 'SHA256SUMS.txt').write_text(hashlib.sha256(output.read_bytes()).hexdigest() + '  ' + output.name + '\n')
    (ROOT / 'dist/downloads').mkdir(exist_ok=True)
    shutil.copy2(output, ROOT / 'dist/downloads' / output.name)
    shutil.copy2(output.parent / 'SHA256SUMS.txt', ROOT / 'dist/downloads/SHA256SUMS.txt')
    print(f'Created {output.relative_to(ROOT)} ({output.stat().st_size / 1024**2:.1f} MiB)')