# Verification record

## Automated checks completed

- TypeScript strict type-check of the React renderer.
- 42 Node tests for aligned/checksummed Intel HEX, EOF and overlap rejection, all five memory profiles, privileged request validation, protected memory, calibration preservation, backups, unavailable backup storage, cancellation, exclusivity, firmware arguments, stale sessions, and independent readback comparison.
- 15 Playwright browser tests covering a full virtual programming cycle, firmware upload, actual file selection, invalid HEX rejection, menus, filters, log export, guides, settings, author credits, a failing native handshake, target-change invalidation, mobile navigation, and nine viewport widths from 320 to 1920 pixels.
- 9 compiled C++ host protocol checks using a local pseudo-terminal, including a correct version handshake, correct target detection, incompatible firmware, inconsistent IDs, wrong geometry, code protection, and forbidden calibration overrides. None of the negative cases emitted ERASE, WRITE, or SETDEVICE.
- Both classic AVR board profiles compiled from the pinned upstream sketch. Each uses 11,560 bytes of flash and 465 bytes of static RAM. Both application-only HEX images have the same pinned digest.
- MinGW-w64 native host and branded Windows x64 launcher compiled. No administrator-only kernel driver is installed by the application.
- Desktop and mobile screenshots were reviewed; the diagram, controls, console, and navigation adapt to narrow screens. Motion respects OS and application preferences.
- The portable archive was built, its ZIP CRCs and SHA-256 checked, and its packaged x64 launcher, Electron runtime, guarded host, x86 AVR uploader, firmware, source, and native entry points inspected. No bootloader-including HEX image is shipped.
- The exact renderer and native application files extracted from the Windows package were smoke-tested under Electron 45.5.0 on Linux with Xvfb. The offline CSP allowed the local bundle, Node APIs were absent from the renderer, the isolated preload and trusted-frame IPC check worked, physical access on a non-Windows host was rejected, and a complete virtual programming/readback cycle passed.
- The production Vite build and a production npm dependency audit passed. These results are not certification of the Windows binaries or the hardware circuit.

## Independent release gates

Automated adapter tests inject an in-memory command runner. PTY tests exercise real host code, not a real PIC. Neither establishes correct physical voltages, timing, or compatibility. A compiled Windows PE is not proof of a successful native Windows launch. The full electrical matrix, independent programmer comparison, native Windows acceptance, code signing, and publication review remain unverified. See `acceptance.md`.

## Reproduce

```sh
npx tsc --noEmit
node --test tests/*.test.mjs
python3 tests/protocol_smoke.py
npx playwright test
npm run build
python3 scripts/package-windows.py
python3 scripts/verify-package.py
```
## Round 2 (interface rebuild and system check)

- 42 Node tests, 9 compiled host protocol checks, 15 browser tests, TypeScript, and the production build pass.
- The packaged renderer and native bridge were run under Electron 45.5.0 on Linux. The system check reports the non-Windows host as failed, and bundled tool checksums pass.
- Not run here: the Windows executable on Windows, real USB drivers, and physical PIC programming. Those remain release gates in docs/acceptance.md.

## Round 3 (core hardening)

- 52 Node unit tests pass (HEX parser and encoding, target backup stability, write authorization, system checks, optional download constraints). 11 compiled C++ PTY protocol checks pass, including malformed and oversized serial packets that must not result in writes. 15 Playwright tests, strict TypeScript and `npm run build` pass.
- Native hardware calls now repeat the required system check before accessing the port; writes repeat it after confirmation. The application requires two complete and matching independent snapshots before erasing a target. A retained backup path is included in post-backup failure messages.
- Optional component downloads are disabled in the current release manifest because all programming dependencies are bundled. Future downloads require a pinned manifest/allowlist, exact HTTPS source without redirects, a size limit, streaming hash check and atomic file write. No driver or damaged tool is automatically installed or replaced.
- Serial packet framing now rejects odd-length or oversized transfers and incomplete response lines instead of treating them as valid data. The Windows native host was rebuilt with these changes.
- Still unverified: native execution of the Windows `.exe` on Windows, USB electrical characteristics, target-specific timing, actual silicon and manufacturer qualification. Software tests are not proof that real hardware is safe.
