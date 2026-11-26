# ArdPIC Studio: round 2 plan (professional UX, system check, Windows build)

Tasks are checked off after each one is finished and verified.

## A. Audit and planning

- [x] A1. Audit round 1 against professional desktop conventions. Found decorative illustrations, gradient panels, all-caps labels, numbered "STEP 01" markers, arrow glyphs, middle-dot separators, and a hero-style header. These read as generated, not engineered.
- [x] A2. Define the new visual system: neutral surfaces, one accent colour, system UI font, 4 px radius, no ornaments, text status labels instead of colour-only signals.
- [x] A3. Define the new information architecture: menu bar, left navigation, page header, status bar, and task-based cards on each page.

## B. Interface rebuild

- [x] B1. Replace the global stylesheet with a compact design system (buttons, badges, cards, tables, notices, dialogs, menus, status bar, responsive rules, dark theme).
- [x] B2. Rebuild the shell: menu bar, navigation, page headers, status bar, and toast notifications.
- [x] B3. Rebuild the Programmer page as a clear task workflow: programmer, target, summary, activity log. Show the reason a write is blocked.
- [x] B4. Rebuild firmware, device library, serial monitor, activity log, wiring guide, and documentation pages with plain tables and forms.
- [x] B5. Rebuild dialogs with explicit consequences, keyboard focus, and clear confirm and cancel labels.
- [x] B6. Remove the decorative illustrations and the unused hardware art components.

## C. Automatic system check and downloads

- [x] C1. Add a native system check that runs at launch: Windows x64, application runtime, bundled tool checksums, firmware checksums, backup folder writability, USB serial devices and driver errors, optional components.
- [x] C2. Add a Setup page that shows every check with a plain status and the next action.
- [x] C3. Add a verified downloader for any optional component listed in a pinned manifest. HTTPS only, SHA-256 checked before it is kept, written atomically.
- [x] C4. Keep bundled tools unchanged: a damaged tool is reported and must be reinstalled from the official ZIP, never silently replaced.
- [x] C5. Wire the preload bridge and main-process handlers with origin checks and an allowlist of repair actions.

## D. Build and verification

- [x] D1. Update browser tests for the new interface, then run them.
- [x] D2. Run TypeScript, Node unit tests, compiled-host protocol checks, and the production build.
- [x] D3. Compile the Windows launcher and host, package the portable ZIP, and verify PE headers, hashes, and archive integrity.
- [x] D4. Smoke-test the packaged renderer and main process in Electron, and record exactly what could not be run on this Linux host.

## Results

- Node unit tests: 42 passed. Compiled host protocol checks: 9 passed. TypeScript: passes.
- Browser tests: 15 passed. Production build: passes.
- Windows package: ArdPIC-Studio-Windows-x64.zip, verified PE headers, checksums, and firmware hashes.
- Packaged app under Electron (Linux, Xvfb): starts, system check runs, virtual programming cycle passes.

## Acceptance boundary

A real Windows launch, USB driver behaviour, and physical PIC programming are not claimed until they are run on Windows with hardware. Each limit is recorded in `docs/verification.md`.

## Round 3: Core Reliability Audit

This work targets failure containment, not a claim of zero hardware risk.

- [x] R1. Audited parser, native command execution, device identity, backup/erase/readback, firmware upload, setup checks and release artifacts. Found single-read backup, permissive serial packet handling, unbounded redirects/download buffering, missing runtime preflight enforcement, and stale packaged binaries.
- [x] R2. Hardware access now repeats the required system preflight; repair actions and hardware operations cannot overlap. Native request profile/port checks remain mandatory.
- [x] R3. Two complete independent backups must match byte-for-byte before erase; invalid memory geometry fails closed. Post-write failures retain and report the durable backup location.
- [x] R4. HEX parsing rejects blank interior records and unsafe addresses; encoding rejects missing, malformed or out-of-range PIC words.
- [x] R5. Optional downloads have a pinned release manifest, exact approved HTTPS URL without redirects, 8 MiB streaming cap, checksum verification, atomic writes and failure cleanup. Bundled executables and drivers are never self-replaced.
- [x] R6. Added adversarial tests for unstable backups, protected memory, backup storage, required system preflight, malformed serial packets, corrupt and redirected downloads, manifest tampering and invalid HEX. Passed 52 unit tests, 11 compiled-host protocol checks, 15 browser tests, strict TypeScript and Vite build.
- [x] R7. Restored the Windows cross-compiler and pinned tool archives; rebuilt the native Windows launcher and hardened C++ host, packaged and integrity-checked the portable ZIP, and smoke-tested the packaged renderer/main process under Electron on Linux. Real Windows execution and hardware qualification remain unverified.
