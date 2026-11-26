export const DEVICES = [
  {
    name: "PIC16F84A",
    words: 1024,
    eeprom: 64,
    pins: 18,
    ram: 68,
    id: "0x0560",
    reserved: 0,
  },
  {
    name: "PIC16F628A",
    words: 2048,
    eeprom: 128,
    pins: 18,
    ram: 224,
    id: "0x1060",
    reserved: 0,
  },
  {
    name: "PIC16F648A",
    words: 4096,
    eeprom: 256,
    pins: 18,
    ram: 256,
    id: "0x1100",
    reserved: 0,
  },
  {
    name: "PIC12F675",
    words: 1024,
    eeprom: 128,
    pins: 8,
    ram: 64,
    id: "0x0FC0",
    reserved: 1,
  },
  {
    name: "PIC16F877A",
    words: 8192,
    eeprom: 256,
    pins: 40,
    ram: 368,
    id: "0x0E20",
    reserved: 0,
  },
];
export const BOARDS = [
  {
    id: "uno",
    name: "Arduino Uno",
    description: "Uno R3 / ATmega328P",
    fqbn: "arduino:avr:uno",
    baud: 115200,
  },
  {
    id: "nano",
    name: "Arduino Nano",
    description: "Classic Nano / ATmega328P",
    fqbn: "arduino:avr:nano:cpu=atmega328",
    baud: 115200,
  },
  {
    id: "nano-old",
    name: "Arduino Nano (old bootloader)",
    description: "Classic Nano / old bootloader",
    fqbn: "arduino:avr:nano:cpu=atmega328old",
    baud: 57600,
  },
];
export const SAMPLE_HEX = ":080000000000000000000028D0\n:00000001FF\n";
export const MAX_HEX_SIZE = 1024 * 1024;

export function parseHex(text) {
  if (typeof text !== "string" || !text || text.length > MAX_HEX_SIZE)
    throw new Error("Choose a non-empty HEX file smaller than 1 MiB.");
  const bytes = new Map();
  let base = 0,
    eof = false,
    records = 0;
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const fail = (message) => {
      throw new Error(`Line ${i + 1}: ${message}`);
    };
    if (!line) {
      if (eof || i === lines.length - 1) continue;
      fail("blank lines are not allowed inside a HEX image.");
    }
    if (eof) fail("unexpected content after the end-of-file record.");
    if (!/^:(?:[0-9a-fA-F]{2}){5,260}$/.test(line))
      fail("not a valid Intel HEX record.");
    const b = line
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16));
    const [len, hi, lo, type] = b;
    const address = hi * 256 + lo;
    if (len + 5 !== b.length) fail("record length does not match its data.");
    if (b.reduce((sum, n) => sum + n, 0) % 256 !== 0)
      fail("checksum mismatch. The file may be damaged.");
    if (type === 0) {
      if (!len || len & 1 || address & 1)
        fail("PIC data must contain aligned 16-bit words.");
      if (
        (base & 1) !== 0 ||
        address + len > 65536 ||
        base + address + len > 0x100000000
      )
        fail("address overflow.");
      for (let j = 0; j < len; j++) {
        const at = base + address + j;
        if (bytes.has(at)) fail("overlapping memory records are not allowed.");
        bytes.set(at, b[4 + j]);
      }
      records++;
    } else if (type === 1) {
      if (len !== 0 || address !== 0) fail("invalid end-of-file record.");
      eof = true;
    } else if (type === 2 || type === 4) {
      if (len !== 2 || address !== 0) fail("invalid address extension.");
      base = (b[4] * 256 + b[5]) * (type === 2 ? 16 : 65536);
    } else fail("unsupported record type for a PIC firmware image.");
  }
  if (!eof) throw new Error("Missing Intel HEX end-of-file record.");
  if (!bytes.size) throw new Error("This HEX file contains no program data.");
  return { bytes, records, size: bytes.size };
}

export function validateHex(text, target) {
  const device = DEVICES.find((d) => d.name === target);
  if (!device)
    throw new Error("Unknown target. No memory profile is available.");
  const parsed = parseHex(text);
  for (const [at, value] of parsed.bytes) {
    const word = Math.floor(at / 2);
    const program = word < device.words - device.reserved;
    const data = word >= 0x2100 && word < 0x2100 + device.eeprom;
    if (!program && !data)
      throw new Error(
        `Address 0x${word.toString(16).toUpperCase()} is reserved or outside ${target} memory. Configuration and calibration writes are locked.`,
      );
    if (at & 1 && ((program && value > 0x3f) || (data && value !== 0)))
      throw new Error(
        `Invalid ${data ? "EEPROM" : "14-bit program"} word at 0x${word.toString(16)}.`,
      );
  }
  return parsed;
}

export function encodeHex(bytes) {
  if (!(bytes instanceof Map) || !bytes.size)
    throw new Error("No memory words to encode.");
  const sorted = [...bytes.keys()].sort((a, b) => a - b);
  for (const address of sorted) {
    const value = bytes.get(address);
    if (
      !Number.isInteger(address) ||
      address < 0 ||
      address > 0xffff ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 255 ||
      !bytes.has(address ^ 1)
    )
      throw new Error("Cannot encode an incomplete or out-of-range PIC memory word.");
  }
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    const addr = sorted[i],
      buf = [];
    while (
      i < sorted.length &&
      sorted[i] === addr + buf.length &&
      buf.length < 16
    )
      buf.push(bytes.get(sorted[i++]));
    const record = [buf.length, Math.floor(addr / 256), addr % 256, 0, ...buf];
    record.push(-record.reduce((s, n) => s + n, 0) & 255);
    out.push(
      ":" +
        record
          .map((n) => n.toString(16).toUpperCase().padStart(2, "0"))
          .join(""),
    );
  }
  return out.join("\n") + "\n:00000001FF\n";
}
