"""Check the actual portable archive and extract its renderer for a smoke test."""
import hashlib
import json
from pathlib import Path
import struct
import zipfile

ROOT = Path(__file__).resolve().parent.parent
out = ROOT / 'public/downloads/ArdPIC-Studio-Windows-x64.zip'
assert hashlib.sha256(out.read_bytes()).hexdigest() == (out.parent / 'SHA256SUMS.txt').read_text().split()[0]
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    base = 'ArdPIC Studio/'
    app = base + 'runtime/resources/app/'
    native = app + 'desktop/'
    def pe_machine(name):
        b = z.read(name)
        assert b[:2] == b'MZ'
        offset = struct.unpack_from('<I', b, 60)[0]
        assert b[offset:offset + 4] == b'PE\0\0'
        return struct.unpack_from('<H', b, offset + 4)[0]
    for name in [base + 'ArdPIC Studio.exe', base + 'runtime/electron.exe', native + 'bin/ardpicprog.exe']:
        assert pe_machine(name) == 0x8664
    assert pe_machine(native + 'bin/avrdude.exe') == 0x14c
    manifest = json.loads(z.read(native + 'binary-checksums.json'))
    for name, expected in manifest.items():
        assert hashlib.sha256(z.read(native + 'bin/' + name)).hexdigest() == expected
    for board in ['uno', 'nano']:
        assert hashlib.sha256(z.read(native + f'firmware/{board}/ProgramPic.ino.hex')).hexdigest() == '742dacffec6e9a609b6789384dde1671d7c52393fbe6237caa4c6204076c3384'
    assert json.loads(z.read(app + 'package.json'))['main'] == 'desktop/main.cjs'
    for name in ['main.cjs', 'preload.cjs', 'setup.mjs', 'components.json', 'safety.mjs', 'hardware.mjs', 'vendor/ProgramPic/ProgramPic.ino', 'vendor/host/main.cpp', 'vendor/host/serialport.cpp', 'app.ico']:
        assert native + name in z.namelist()
        if name != 'app.ico':
            assert z.read(native + name) == (ROOT / 'desktop' / name).read_bytes(), f'{name}: stale packaged source'
    assert z.read(app + 'src/lib/hex.mjs') == (ROOT / 'src/lib/hex.mjs').read_bytes()
    assert z.read(base + 'Implementation-checklist.md') == (ROOT / 'plain.md').read_bytes()
    assert not any('with_bootloader' in x for x in z.namelist())
    assert not any(x.startswith(app + 'dist/downloads/') for x in z.namelist())
    html = z.read(app + 'dist/index.html')
    assert b'Content-Security-Policy' in html and b"connect-src 'none'" in html
    destination = ROOT / '.research/packaged-renderer'
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'index.html').write_bytes(html)
    (destination / 'favicon.svg').write_bytes(z.read(app + 'dist/favicon.svg'))
    print(f'PASS: {len(z.namelist())} archive entries; x64 PE headers, uploader, exact firmware, native checksums, entry points, source, offline CSP, and ZIP integrity verified.')