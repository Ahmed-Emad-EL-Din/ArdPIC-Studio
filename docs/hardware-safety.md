# Hardware safety contract

The browser never opens a physical port. Its explicitly selected virtual programmer uses memory only. No simulation result authorizes a real operation. A native desktop bridge owns all hardware commands and revalidates inputs independently of the UI.

The native profile is exclusively ProgramPIC 1.8.horo with the **Ho-Ro 1.8 circuit** (D2 VDD, D3 VPP, D4 clock, D5 data). The original rweather circuit has different pins and inverted VPP control. Never combine its shield with this sketch. Do not connect high programming voltage to Arduino GPIO. The topology graphic is not a wiring diagram.

Host profiles: classic 5 V ATmega328P Uno and Nano, including the Nano old bootloader option. Never substitute Uno R4, Nano Every, or a 3.3 V board. Device profiles are bounded by the pinned upstream geometry: PIC16F84A, PIC16F628A, PIC16F648A, PIC12F675, and PIC16F877A. The last two need a target-specific adapter and orientation check. Inclusion is software support, not physical qualification.

Firmware loading must be an explicit, confirmed operation, with VPP disconnected and the target removed. It uses only the packaged, hash-checked source and allowlisted board profiles. Upload verification and an exact firmware handshake must succeed independently.

Before target programming, the operator confirms the board, correctly wired interface, socket orientation, isolated supply, and datasheet-appropriate measured VDD/VPP. The application cannot measure voltages. Raw serial commands are not exposed. Only device IDs that can be autodetected are allowed. Unknown or mismatched targets fail closed; no SETDEVICE fallback. Any changed board, mode, port, or target invalidates the connection. Each write requires fresh identity checks, a new confirmation, a valid target-bounded HEX file, and a readback comparison. Calibration override is prohibited. Configuration, factory calibration, and device-ID writes are deliberately unsupported in this conservative first release.

Erase is destructive even for a partial HEX image. A pre-erase backup is required; a protected device cannot be reliably backed up. Reject protected devices and require an independent, known-good backup for live use. Do not disconnect power during programming. A transport failure is not success: disconnect, inspect the hardware, and re-identify it before retrying.

Two independent, complete readback snapshots of program, EEPROM and configuration memory must agree before erase. This protects against intermittent transport faults but cannot prove an electrically safe circuit or detect a same-model target swapped between commands. The operator remains responsible for a separately stored, independently verified copy of valuable device contents. A programming failure reports the saved backup's path when one exists.

Hardware qualification and Windows signing remain release gates. See `docs/acceptance.md` for the bench checklist. No claim of zero hardware risk is made.