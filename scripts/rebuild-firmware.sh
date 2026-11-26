#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
CLI="${ARDUINO_CLI:-arduino-cli}"
CORE='arduino:avr@1.8.6'
echo '4acc8cee46c3726839bc6b650ef31979e8a14a47710a3cad4e8cb60faa1b8184  desktop/vendor/ProgramPic/ProgramPic.ino' | sha256sum -c -
"$CLI" core install "$CORE"
"$CLI" compile --fqbn arduino:avr:uno --output-dir desktop/firmware/uno desktop/vendor/ProgramPic
"$CLI" compile --fqbn arduino:avr:nano:cpu=atmega328 --output-dir desktop/firmware/nano desktop/vendor/ProgramPic
for profile in uno nano; do
    echo "742dacffec6e9a609b6789384dde1671d7c52393fbe6237caa4c6204076c3384  desktop/firmware/$profile/ProgramPic.ino.hex" | sha256sum -c -
    for suffix in eep elf with_bootloader.bin with_bootloader.hex; do
        rm -f "desktop/firmware/$profile/ProgramPic.ino.$suffix"
    done
done