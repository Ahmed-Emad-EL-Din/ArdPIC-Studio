# Hardware and release acceptance

These are deliberate manual release gates. Do not check an item without recording the tester, date, board revision, exact MCU part/revision, instrument, measured result, and exported session log. A simulation is not a substitute.

## Platform

- [ ] Start the extracted portable build on clean supported Windows x64 installations, including a standard non-administrator account and a directory containing spaces and non-ASCII characters.
- [ ] Check the launcher icon, file properties, runtime loading, native confirmation defaults, local fonts, local schematic, and keyboard accessibility.
- [ ] Test board discovery, missing drivers, busy serial ports, COM10+, USB removal, reconnect, and a different board reusing the same COM number.
- [ ] Verify Windows file permissions, backup directory durability, read-only storage and disk-full errors before erase.

## Electrical inspection

- [ ] Match the actual PCB to the included Ho-Ro 1.8 schematic and verify VPP switch polarity. Do not attach a rweather shield to this firmware.
- [ ] With no power, inspect continuity, isolation, common ground, socket orientation, mapping of each target pin, and protection against backfeeding and shorts.
- [ ] With no target fitted, use calibrated instruments and a current-limited supply to check all power rails in idle, bootloader, reset, read, write, and timeout states.
- [ ] Confirm the exact VDD/VPP levels, sequence, rise times, and timing requirements from the current device-specific Microchip programming specification. Do not assume one voltage fits every PIC.
- [ ] Verify physical VPP removal independently of software. A desktop indicator cannot measure voltage or guarantee a transistor has switched off.

## Firmware matrix

- [ ] Uno R3 / ATmega328P firmware upload, AVR flash readback, exact version response, and idle pin state.
- [ ] Classic Nano / ATmega328P, current bootloader, including USB reset behavior.
- [ ] Classic Nano old bootloader at 57600 baud; in all profiles the running ProgramPIC protocol remains 115200 baud.
- [ ] Reject a mismatched MCU signature, wrong board revision, incompatible sketch, or unsupported bootloader without overriding the signature.

## Target matrix

- [ ] PIC16F84A: erased, known nonblank, protected, wrong-device, interrupted-write, and recovery cases.
- [ ] PIC16F628A and PIC16F648A: independent ID, configuration, protected flash/EEPROM, and full memory verification cases.
- [ ] PIC12F675: correct 8-pin adapter, preserved RETLW OSCCAL, bandgap bits, CP and CPD; reject missing factory calibration.
- [ ] PIC16F877A: suitable 40-pin adapter, VDD-first entry, EEPROM preservation, and full 8K-word readback.
- [ ] Compare backups and final images with a separate trusted commercial programmer, not just a second read from the same circuit.
- [ ] Test every supported host/target combination on sacrificial devices, including marginal power, bad orientation prevention, and memory boundaries.
- [ ] Verify no target erase at all after any failed prerequisite, declined confirmation, failed backup, or device mismatch.
- [ ] Deliberately exercise USB loss and timeout on a sacrificial fixture. Confirm the actual safe electrical state. Never test faults with valuable equipment connected.

## Publication

- [ ] Independently review the native adapter, protocol changes, memory geometry, protection masks, and licensing/source distribution.
- [ ] Verify all included runtime and dependency versions against current vendor support and advisories at release time.
- [ ] Run Windows integration and accessibility tests at 100%, 150%, and 200% DPI, including Narrator and high-contrast modes.
- [ ] Code-sign and timestamp the final Windows distribution with the publisher's trusted certificate and rescan the signed artifact.
- [ ] Publish the final checksum, corresponding source and licenses, verified compatibility matrix, known limitations, and support contact.

No physical hardware pass, code-signing certificate, or Windows-native acceptance result is claimed by this build.