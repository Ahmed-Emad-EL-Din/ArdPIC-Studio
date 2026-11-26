# Source provenance and notices

## Hardware

ArdPicProg and ProgramPIC are based on the work of Southern Storm Software, Gregor Schlechtriem, Ho-Ro, and other upstream contributors. Upstream license texts and source headers are preserved in `desktop/vendor/`.

- Source: https://github.com/Ho-Ro/ArdPicProg/tree/420aacef1990a1d0ce348a468ff44a73dcb554e3
- Sketch: `ProgramPic/ProgramPic/ProgramPic.ino`, version 1.8.horo, unchanged.
- Sketch SHA-256: `4acc8cee46c3726839bc6b650ef31979e8a14a47710a3cad4e8cb60faa1b8184`.
- Application-only AVR HEX digest: `742dacffec6e9a609b6789384dde1671d7c52393fbe6237caa4c6204076c3384` for both classic AVR profiles. Bootloader-including binaries are never used.
- Host changes: require exactly ProgramPIC 1.8.horo; remove SETDEVICE fallback; reject incomplete identity, memory geometry, protected targets and force-calibration; re-check all five allowlisted profiles on the write handle; support Windows COM ports above 9. The complete modified host source is distributed with the application.
- Build: Arduino CLI 1.6.0, Arduino AVR Boards 1.8.6, AVR GCC 7.3.0-atmel3.6.1-arduino7.
- Uploader: official Arduino AVRDUDE 6.3.0-arduino17 Windows artifact from https://downloads.arduino.cc/tools/avrdude-6.3.0-arduino17-i686-w64-mingw32.zip. Its archive was checked against the Arduino package index checksum. Only avrdude.exe, avrdude.conf and libusb0.dll are shipped. No kernel driver is installed by the application.
- Source/build project: https://github.com/arduino/avrdude-build-script. Upstream AVRDUDE: https://github.com/avrdudes/avrdude. libusb-win32: https://sourceforge.net/projects/libusb-win32/.
- `desktop/vendor/source/` includes the Arduino AVR core 1.8.6 source, the Arduino17 build recipes and patches at commit `14010f825e58e80332f638bf305d1e2f1f833b69`, the matching-era facchinm/avrdude source revision `a55f779b9fe6f5c6510bdf3bf4bd394218f5a4da`, and the libusb-win32 1.2.6.0 source archive. The original Arduino uploader build recipe clones upstream without a commit pin, so exact binary reproducibility must be independently audited before redistribution.
- The matching schematic is included from the same pinned ArdPicProg revision. QPICkit is a design reference, not a bundled backend. Its PICkit support is not advertised as Arduino compatibility.

Device protection masks were cross-checked against the gputils configuration database generated from Microchip device descriptions: https://gputils.sourceforge.io/html-help/PIC16F84A-conf.html, PIC16F628A-conf.html, PIC16F648A-conf.html, PIC12F675-conf.html, and PIC16F877A-conf.html. Always compare with the current vendor programming specification during bench qualification.

## Desktop and interface

- Official Electron Windows x64 runtime 45.5.0: https://github.com/electron/electron/releases/tag/v45.5.0; verified SHA-256 `20155c8b8aa5b1f575f3757bdf21490e0bac2f19a65a26ce9ba99bcf9f2c69bd`. The original runtime license files remain in the portable distribution.
- React and related client dependencies retain their upstream MIT licenses. Dependency versions are pinned by `package-lock.json`.
- Lucide icons retain their ISC/MIT notices. DM Sans is bundled locally under the SIL Open Font License.
- The workbench's isometric laptop, Arduino, and illustrative DIP package are custom SVG illustrations. They are not wiring diagrams or evidence of connected hardware.
- Design skills are retained as reviewed documentation under `.agents/skills/`. No third-party skill script is run at application runtime.