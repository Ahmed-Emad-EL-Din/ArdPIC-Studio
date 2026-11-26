import {
  BOARDS,
  DEVICES,
  encodeHex,
  parseHex,
  validateHex,
} from "../src/lib/hex.mjs";

export function requestProfile(request) {
  if (!request || request.verifiedSetup !== true)
    throw new Error("The electrical setup has not been confirmed.");
  const board = BOARDS.find((b) => b.id === request.board);
  const device = DEVICES.find((d) => d.name === request.target);
  if (!board || !device)
    throw new Error("Unknown board or device. Operation locked.");
  if (
    typeof request.port !== "string" ||
    !/^COM[1-9]\d{0,2}$/.test(request.port)
  )
    throw new Error("Select a discovered physical COM port.");
  return { board, device, port: request.port };
}
export function requireFirmware(output, device) {
  if (!/^ProgramPIC 1\.8\.horo\r?$/m.test(output))
    throw new Error(
      "Unexpected firmware version. The Ho-Ro 1.8 circuit requires ProgramPIC 1.8.horo.",
    );
  if (!new RegExp(`\\b${device.name}\\b`, "i").test(output))
    throw new Error(
      "The connected firmware does not advertise this device profile.",
    );
}
export function requireDetected(output, device) {
  requireFirmware(output, device);
  const detected = output.match(
    /^Device (pic\w+), program memory: (\d+) words, data memory: (\d+) bytes\.\r?$/im,
  );
  if (
    !detected ||
    detected[1].toUpperCase() !== device.name ||
    Number(detected[2]) !== device.words ||
    Number(detected[3]) !== device.eeprom
  )
    throw new Error(
      "Autodetected device identity or memory geometry does not match. No write authorized.",
    );
}
const readWord = (bytes, word) => {
  const lo = bytes.get(word * 2),
    hi = bytes.get(word * 2 + 1);
  if (lo === undefined || hi === undefined)
    throw new Error("Incomplete memory backup. Refusing to erase the target.");
  return lo | (hi << 8);
};
const putWord = (bytes, addr, value) => {
  bytes.set(addr * 2, value & 255);
  bytes.set(addr * 2 + 1, value >> 8);
};

export function prepareWrite(backupText, input, target) {
  const device = DEVICES.find((d) => d.name === target);
  if (!device) throw new Error("Unknown target.");
  const previous = parseHex(backupText).bytes,
    image = validateHex(input, target).bytes;
  validateBackup(previous, device);
  const output = new Map(image),
    expected = new Map();
  const config = readWord(previous, 0x2007);
  const protectMasks = {
    PIC16F84A: 0x3ff0,
    PIC16F628A: 0x2100,
    PIC16F648A: 0x2100,
    PIC12F675: 0x0180,
    PIC16F877A: 0x2100,
  };
  const mask = protectMasks[target];
  if ((config & mask) !== mask)
    throw new Error(
      "Code or EEPROM protection is enabled. A reliable backup is impossible; erase is blocked.",
    );
  for (let word = 0; word < device.words; word++) {
    const old = readWord(previous, word);
    if (old > 0x3fff)
      throw new Error(
        "Invalid 14-bit memory readback. Check the interface before retrying.",
      );
    if (word >= device.words - device.reserved) {
      if (target === "PIC12F675" && (old & 0x3f00) !== 0x3400)
        throw new Error(
          "Factory oscillator calibration is not intact. Erase is blocked.",
        );
      putWord(expected, word, old);
    } else
      putWord(
        expected,
        word,
        image.has(word * 2) ? readWord(image, word) : 0x3fff,
      );
  }
  // Unspecified EEPROM, user IDs, configuration, and factory calibration survive a program update.
  for (let word = 0x2100; word < 0x2100 + device.eeprom; word++) {
    const old = readWord(previous, word);
    if (old > 255)
      throw new Error("Invalid EEPROM backup data. Erase is blocked.");
    const value = image.has(word * 2) ? readWord(image, word) : old;
    if (value !== 255) putWord(output, word, value);
    putWord(expected, word, value);
  }
  for (const word of [0x2000, 0x2001, 0x2002, 0x2003, 0x2007]) {
    const value = readWord(previous, word);
    if (value > 0x3fff)
      throw new Error("Unrecognized configuration word in backup.");
    if (value !== 0x3fff) putWord(output, word, value);
    putWord(expected, word, value);
  }
  return { prepared: encodeHex(output), expected, size: image.size };
}
export function verifyReadback(expected, text) {
  const actual = parseHex(text).bytes;
  for (const [addr, value] of expected)
    if (actual.get(addr) !== value)
      throw new Error(
        `Readback mismatch at byte 0x${addr.toString(16)}. The target is not verified. Isolate power and retain the backup.`,
      );
  return true;
}

export function validateBackup(bytes, device) {
  for (const at of bytes.keys()) {
    const word = at >>> 1;
    if (
      !(word < device.words ||
        (word >= 0x2100 && word < 0x2100 + device.eeprom) ||
        (word >= 0x2000 && word <= 0x2005) ||
        word === 0x2007)
    )
      throw new Error("Unexpected address in the target backup. Erase blocked.");
  }
  for (let word = 0; word < device.words; word++) {
    if (readWord(bytes, word) > 0x3fff)
      throw new Error("Invalid 14-bit program word in the target backup.");
  }
  for (let word = 0x2100; word < 0x2100 + device.eeprom; word++) {
    if (readWord(bytes, word) > 255)
      throw new Error("Invalid EEPROM word in the target backup.");
  }
  for (const word of [0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2007]) {
    if (readWord(bytes, word) > 0x3fff)
      throw new Error("Invalid configuration word in the target backup.");
  }
}

export function compareBackups(first, second, device) {
  const left = parseHex(first).bytes;
  const right = parseHex(second).bytes;
  validateBackup(left, device);
  validateBackup(right, device);
  if (left.size !== right.size)
    throw new Error("Two target backups disagree. Erase blocked; inspect power and connections.");
  for (const [at, byte] of left) {
    if (right.get(at) !== byte)
      throw new Error(`Target readback is unstable at 0x${at.toString(16)}. Erase blocked; inspect power and connections.`);
  }
}
