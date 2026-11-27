# Single-EXE Installer Plan — ArdPIC Studio

**Goal.** Turn the current portable-folder build into **one Windows x64 installer
(`ArdPIC-Studio-Setup-1.0.0-x64.exe`)** that a user can download, double-click, and get a
fully working application — every requirement bundled, no separate Arduino IDE, no Node
installation, no online component downloads.

**Status.** Plan only. The CI workflow that implements it lives at
`.github/workflows/build-installer.yml`, and the Inno Setup definition at
`installer/ardpic-studio.iss`. Hardware qualification is **still required** before any
release is used to program real chips (`docs/acceptance.md`).

---

## 1. What "single exe with all requirements" means here

| Requirement | Included? | How |
|---|---|---|
| Electron runtime (app shell) | ✅ bundled | Pinned official Electron **45.5.0** Windows x64, SHA-256 `20155c8b8aa5b1f575f3757bdf21490e0bac2f19a65a26ce9ba99bcf9f2c69bd`, downloaded and verified by `scripts/package-windows.py` |
| Renderer (React UI) | ✅ bundled | `npm run build` → single-file `dist/index.html`, plus a hash-based, network-denying CSP injected at package time |
| Native programmer host | ✅ bundled | `desktop/bin/ardpicprog.exe` built from pinned source (`desktop/vendor/host/`) with MinGW-w64 (`scripts/build-host.sh`) |
| AVR uploader (Arduino side) | ✅ bundled | Arduino `avrdude 6.3.0-arduino17` Windows artifact, hash-verified; ships `avrdude.exe`, `avrdude.conf`, `libusb0.dll` only |
| Firmware images | ✅ bundled | Uno + classic Nano `ProgramPic.ino.hex`, SHA-256 `742dacff…` |
| Documentation & licenses | ✅ bundled | `docs/`, `desktop/licenses/`, `desktop/vendor/`, README |
| USB serial driver | ❌ not bundled | By design: no kernel driver is installed. The user needs a working USB-serial driver (e.g. CH340/FTDI depending on board). |
| Hardware testing | ❌ not included | Requires a physical Uno/Nano + target PIC + Ho-Ro 1.8 circuit. Not automatable. |

So the installer is **self-contained for software**, but it is not and cannot be
self-contained for the electrical side.

## 2. Design decisions

1. **Inno Setup as the single-file wrapper.** The repo already produces a vetted portable
   folder (`ArdPIC Studio/` with `runtime/` + top-level `ArdPIC Studio.exe`). Wrapping that
   folder in an Inno Setup installer:
   - needs no changes to the app itself,
   - is reproducible in CI (Inno Setup 6 is preinstalled on GitHub `windows-latest` runners),
   - produces a small installer relative to the payload,
   - supports per-user install (`PrivilegesRequired=lowest`, `%LOCALAPPDATA%\Programs\ArdPIC Studio`) — no admin rights, no system32 writes.
2. **Not NSIS / not electron-builder.** NSIS gives nothing we need beyond Inno here, and
   electron-builder would re-fetch Electron on its own cadence and rewrite the carefully
   pinned packaging flow in `scripts/package-windows.py` (hash verification, CSP injection,
   license bundling). Keep the existing packaging, add a thin installer layer.
3. **Per-user install, offline at runtime.** The installed app never downloads anything:
   `components.json` ships an empty approved-component list, `connect-src 'none'` CSP, and the
   only permitted external opens are the hard-coded upstream documentation URLs.
4. **Unsigned for now, signable later.** No certificate is committed to the repo. The build is
   explicitly labelled "unsigned engineering build". See §7 for the signing path.
5. **Version = 1.0.0.** `scripts/package-windows.py` already writes `1.0.0` into the app
   metadata and the README text; the installer filename and `AppVersion` follow it.

## 3. Build requirements (all machines, local or CI)

| Tool | Version / source | Why |
|---|---|---|
| Node.js | 22 LTS (CI: `actions/setup-node@v4`) | Renderer build, unit tests |
| npm | bundled with Node | `npm ci` (lockfile committed) |
| Python | 3.11+ (CI: `actions/setup-python@v5`) | `scripts/package-windows.py` |
| MSYS2 + MinGW-w64 GCC | `pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-binutils` (CI: preinstalled on `windows-latest`) | `scripts/build-host.sh` → `ardpicprog.exe`, `ArdPIC Studio.exe` (launcher), `windres` for the launcher resource |
| Inno Setup | 6 (CI: preinstalled / `choco install innosetup -y`) | Produces the single `.exe` installer |
| Arduino AVRDUDE artifact | `https://downloads.arduino.cc/tools/avrdude-6.3.0-arduino17-i686-w64-mingw32.zip` | `avrdude.exe`, `avrdude.conf`, `libusb0.dll` |
| GitHub Actions runner | `windows-latest` | Target platform for build + smoke |
| Pillow (optional) | `pip install pillow` | Only to regenerate `desktop/app.ico` (`scripts/make-icon.py`); the committed ICO is used by default |

Local reproduction is identical — the workflow is just these commands in order.

## 4. The pipeline, step by step

```
checkout → npm ci → tsc --noEmit → node --test tests/*.test.mjs
→ verify pinned firmware/avrdude.conf SHA-256 against committed values
→ fetch Arduino avrdude artifact → verify avrdude.exe / libusb0.dll / avrdude.conf
  SHA-256 against git-committed desktop/binary-checksums.json
→ scripts/build-host.sh  (MSYS2 MinGW-w64: ardpicprog.exe + launcher + checksum rewrite)
→ python3 scripts/package-windows.py
   (npm run build → fetch+verify Electron 45.5.0 → stage portable folder → ZIP)
→ expand ZIP to build/staging/ArdPIC Studio/
→ ISCC.exe installer/ardpic-studio.iss  (Inno Setup → output/ArdPIC-Studio-Setup-1.0.0-x64.exe)
→ SHA-256 of the installer → upload artifact
→ on tag v*: gh release create with installer + checksum file
```

Verification gates (build **fails**, nothing ships, when any gate trips):

- `tsc --noEmit` clean; all `node --test tests/*.test.mjs` pass.
- Firmware images match `742dacff…` **before** packaging (they are also re-checked inside
  `package-windows.py`).
- Arduino AVRDUDE binaries match the **git-committed** `binary-checksums.json` values — this
  must run **before** `build-host.sh`, because the script rewrites that file from whatever is
  on disk.
- Electron runtime matches its pinned SHA-256 (inside `package-windows.py`).
- Installer is SHA-256-hashed and the hash is uploaded with it.

## 5. Inno Setup definition (`installer/ardpic-studio.iss`)

- `PrivilegesRequired=lowest` → per-user install under `%LOCALAPPDATA%\Programs\ArdPIC Studio`.
- `ArchitecturesInstallIn64BitMode=x64compatible` → 64-bit only, fails cleanly elsewhere.
- Ships the whole staged `ArdPIC Studio/` folder unchanged, including `runtime/` and the
  `READ ME FIRST.txt` with the safety warnings.
- Creates Start Menu shortcut + optional desktop icon; registers an Uninstall entry
  (Programs & Features / Settings → Apps).
- No registry writes beyond the uninstall entry; no drivers; no services; no autorun.

## 6. CI workflow (`.github/workflows/build-installer.yml`)

- **Triggers:** `push` to `main`, tags `v*`, and `workflow_dispatch` (manual runs).
- **Jobs:** a single `build-installer` job on `windows-latest`.
- **Outputs:** artifact `ArdPIC-Studio-Setup-x64` (installer + `.sha256`) on every run;
  on a `v*` tag, a GitHub Release is created automatically and the installer + checksum are
  attached.
- **Secrets:** none required for the unsigned build. (`GITHUB_TOKEN` is provided by Actions.)
- **Caching:** npm cache via `setup-node`; Electron runtime is cached at
  `.research/runtime/` per run only (fresh each run — intentional, it is integrity-checked).
- **Timeouts/cancellation:** `timeout-minutes: 30`, concurrency group per ref with
  cancel-in-progress for non-tag runs.

## 7. Code signing (later, when a certificate exists)

1. Obtain an OV/EV code-signing certificate (OV signs fine but keeps SmartScreen reputation
   pain until downloads accumulate; EV avoids SmartScreen initially).
2. Store as GitHub Actions secrets: `CSC_LINK` (base64 of the .pfx), `CSC_KEY_PASSWORD`.
3. Add a signing step before the installer hash: `signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 "output\ArdPIC-Studio-Setup-*.exe"` (and optionally sign the inner `ArdPIC Studio.exe` and `runtime\*.exe` before Inno packs them).
4. SmartScreen note for users of the unsigned build: Windows will warn "Windows protected
   your PC". This is expected, documented in the README and NOT bypassed.

## 8. Risks and honest limits

- **Unsigned binary** → SmartScreen warnings; reputation builds over downloads/time.
- **AVRDUDE provenance.** The Arduino artifact is what the project already ships and pins;
  `docs/third-party.md` notes upstream pins are not fully reproducible — audit before
  commercial redistribution.
- **No Windows hardware qualification yet.** The project has never been run against a physical
  board (`docs/verification.md`, `docs/acceptance.md`). The installer being "fully working"
  means *the software stack installs and runs*; electrical behavior is out of scope until
  acceptance is completed on real hardware.
- **Kernel/USB driver** is deliberately not bundled; user must have a serial driver for their
  board.
- **GPL obligations.** Bundled licenses are preserved in the package; keep them intact.

## 9. Release checklist (per version)

- [ ] All acceptance items in `docs/acceptance.md` signed off on real hardware (blocking for "working", not for "builds").
- [ ] Version bumped consistently (`installer/ardpic-studio.iss` `MyAppVersion`, README text).
- [ ] CI green on `main`; tag `v1.0.0` pushed.
- [ ] Release created by the workflow; installer + `.sha256` attached; README download section updated to point at the release asset instead of `public/downloads/`.
- [ ] SHA-256 of the published installer re-verified from the release assets, not the build folder.

## 10. Rollback

The installer is self-contained and per-user: uninstall via Settings → Apps → ArdPIC Studio.
No system state persists; backups live in `%APPDATA%\ArdPIC Studio\backups` and are removed
only manually. If a release is bad, delete the release assets and tag; the previous
portable-folder flow (`python3 scripts/package-windows.py`) remains the fallback.
