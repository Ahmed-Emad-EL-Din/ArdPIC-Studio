# ArdPIC Studio

**Made By: Ahmed Emad El-Din Hussein**

An offline-capable Arduino-to-PIC programming workbench, with a React desktop interface, an isolated Electron hardware adapter, and a separate, memory-backed virtual programmer.

## Windows application

Download `public/downloads/ArdPIC-Studio-Windows-x64.zip` (also served at `/downloads/ArdPIC-Studio-Windows-x64.zip` when the web build is hosted). Verify it against the adjacent `SHA256SUMS.txt`, extract the **complete folder**, and run **ArdPIC Studio.exe**. Do not move the executable away from its `runtime` folder. No Arduino IDE, Node installation, or online package download is needed by the packaged application. A working USB serial driver is still required.

**Release status:** unsigned engineering build, not a hardware-qualified production release. No physical board, voltage measurement, or native Windows installation was available for acceptance testing. The software cannot guarantee electrical safety. Complete `docs/acceptance.md` before publication or connecting valuable hardware.

## Supported profiles

- **Arduino:** Uno R3 and classic Nano ATmega328P, including the old Nano bootloader. No Uno R4, Nano Every, or 3.3 V substitutes.
- **PIC:** PIC16F84A, PIC16F628A, PIC16F648A, PIC12F675, PIC16F877A. These are software profiles, not a claim that every combination has been bench tested.
- **Circuit:** the [Ho-Ro 1.8 schematic](https://github.com/Ho-Ro/ArdPicProg) with ProgramPIC 1.8.horo. The [original rweather ZIF circuit](https://rweather.github.io/ardpicprog/pic14_zif_circuit.html) uses different pins and VPP polarity. They are not interchangeable.

## Workflow

1. Inspect the matching circuit, power rails, and exact adapter using the Wiring guide and device datasheet. A topology illustration is not a pinout.
2. Isolate external VPP and remove the PIC. In Firmware uploader, select the exact Arduino and discovered port. Review and confirm the upload. The bundled image is SHA-256 checked; AVRDUDE checks the ATmega signature and verifies flash. No fuse, bootloader, or signature override is used.
3. Connect the programmer to check its exact reported ProgramPIC version and supported device list. A version handshake is not authentication of unknown firmware or an electrical measurement.
4. With power removed, install the correctly oriented target. Select its MCU profile and a program/EEPROM-only Intel HEX image. Review measured VDD/VPP against that device's specification.
5. Review the destructive operation and type the target name. The native process performs its own required system check, confirmation, version check, target identification, two independent complete backups, comparison of every byte, and protection checks. A second native confirmation displays the durable backup location before erasing. If the two reads disagree, erase is blocked.
6. Wait for the independent full readback comparison. The application never converts a timeout, malformed serial packet or mismatched byte into a successful result. Post-backup failures report its file location for recovery. The Activity log can be exported for a test record.

## HEX contract

Intel HEX data records must use byte addresses, even-length, aligned 16-bit words, and valid checksums. Record types 00, 01, 02, and 04 are supported. Overlaps, missing EOFs, unknown records, address wrap, excess word width, unavailable EEPROM, and out-of-profile addresses are rejected. Maximum source size: 1 MiB.

User-supplied configuration, device-ID, and calibration writes are **intentionally blocked**. Supply a program/EEPROM-only export, not a combined configuration image. Input syntax cannot prove that instructions were compiled for the correct MCU. The operator must know the image's origin and intended target. The native write restores existing user IDs and configuration from the backup, preserves unspecified EEPROM, and uses the upstream calibration-preserving erase behavior. Code-protected devices are rejected, not forcibly erased.

## Virtual session

Select **Virtual port (simulation)**, then **Connect programmer**. Choose **File > Load example HEX** and **Program target**. The example is an eight-byte loop that does not configure GPIO. Virtual writes update local memory and compare all supplied bytes. No USB port is opened. Virtual evidence never authorizes a native write. Setting changes release the previous authorization.

## Interface

The workbench includes File, View, Tools, and Help menus; keyboard shortcuts; drag-and-drop HEX loading; Arduino firmware uploading; a searchable device library; a read-only serial identity monitor; searchable, exportable activity logs; light/dark preferences; a local matching schematic; a guided walkthrough; and an About dialog with author credit and upstream GitHub links. Data stays local. There is no analytics, external font dependency, automatic erase or automatic connection to a serial port. A local system check runs when the desktop application starts and is repeated before each native hardware operation.

The Windows ZIP already contains every programming tool and firmware image. The optional downloader has **no approved downloads in this release**. It cannot replace a corrupt bundled executable or silently install a USB driver. A failed integrity check requires reinstalling from the official archive. Future optional assets require a new explicitly approved, hash-pinned release; only exact HTTPS sources without redirects are accepted and downloads are capped at 8 MiB.

## Development

```sh
npm install
npm run dev
npx tsc --noEmit
node --test tests/*.test.mjs
npx playwright install --with-deps chromium
npx playwright test
npm run build
```

`src/App.tsx` is the app entry point. The production browser app is `dist/index.html`. The browser supports all file validation and simulated workflows; physical writes are restricted to the native adapter.

## Desktop packaging

The reviewed firmware and Windows tools are included in `desktop/`. Build the web renderer and package the portable application with:

```sh
python3 scripts/package-windows.py
```

The packager fetches the official pinned Windows x64 Electron runtime if it is not already cached, verifies its SHA-256 digest, generates local application metadata, applies a hash-based, network-denying CSP, and archives the runtime, native tools, firmware, source, licenses, and documentation. Run from this repository with Python 3, npm, and the included native artifacts. This is a portable distribution, not an NSIS installer.

For a native rebuild use `sh scripts/build-host.sh` with MinGW-w64 x64 and its resource compiler. For firmware rebuilding, use Arduino CLI 1.6.0 and `sh scripts/rebuild-firmware.sh`; the AVR core is pinned to 1.8.6. The Uno and classic Nano produce identical application bytes for this sketch. Only their bootloader upload options differ. Runtime source recompilation is not necessary.

## Project files

- `plain.md`: advance plan and completion checklist.
- `docs/design-research.md`: reviewed technical references and both locally saved UX skills.
- `docs/hardware-safety.md`: electrical limits and authorization model.
- `docs/acceptance.md`: physical qualification and release checklist.
- `docs/third-party.md`: upstream attribution and source versions.
- `desktop/hardware.mjs`: exclusive operation lock, native validation, confirmations, backups, and readback.
- `desktop/safety.mjs`: device identification, protection masks, and preservation policy.
- `src/lib/hex.mjs`: shared HEX validation used on both sides of the native boundary.
- `tests/`: parser, safety, native adapter, browser, and protocol tests.

## Acknowledgments

[Ho-Ro/ArdPicProg](https://github.com/Ho-Ro/ArdPicProg) supplies the firmware, matching schematic, and upstream host implementation. [Ho-Ro/QPICkit](https://github.com/Ho-Ro/QPICkit) provides a desktop workflow reference. Existing project copyrights are retained. The About dialog links to these actual repositories; no personal GitHub account was assumed.