import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICES,
  MAX_HEX_SIZE,
  SAMPLE_HEX,
  encodeHex,
  parseHex,
  validateHex,
} from "../src/lib/hex.mjs";
import {
  prepareWrite,
  compareBackups,
  requestProfile,
  requireDetected,
  requireFirmware,
  verifyReadback,
} from "../desktop/safety.mjs";

const eof = ":00000001FF";
const record = (address, type, data) => {
  const bytes = [data.length, address >> 8, address & 255, type, ...data];
  bytes.push(-bytes.reduce((a, b) => a + b, 0) & 255);
  return (
    ":" +
    bytes
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
};
const image = (at, data) => record(at, 0, data) + "\n" + eof;
export function blankBackup(device) {
  const memory = new Map();
  const put = (word, value) => {
    memory.set(2 * word, value & 255);
    memory.set(2 * word + 1, value >> 8);
  };
  for (let i = 0; i < device.words; i++)
    put(i, i >= device.words - device.reserved ? 0x3455 : 0x3fff);
  for (let i = 0; i < device.eeprom; i++) put(0x2100 + i, 255);
  for (let i = 0; i < 8; i++) if (i !== 6) put(0x2000 + i, 0x3fff);
  return memory;
}
test("safe-loop example is aligned PIC code and round-trips losslessly", () => {
  const r = validateHex(SAMPLE_HEX, "PIC16F84A");
  assert.equal(r.size, 8);
  assert.equal(r.records, 1);
  assert.deepEqual(parseHex(encodeHex(r.bytes)).bytes, r.bytes);
  assert.equal(
    parseHex("\uFEFF" + SAMPLE_HEX.replaceAll("\n", "\r\n")).size,
    8,
  );
});
test("HEX encoding refuses incomplete, invalid or out-of-range words", () => {
  for (const words of [
    new Map(),
    new Map([[0, 1]]),
    new Map([[0, 256], [1, 0]]),
    new Map([[0, 0], [1, -1]]),
    new Map([[0x10000, 0], [0x10001, 0]]),
  ]) assert.throws(() => encodeHex(words));
});
test("independent backups must match every byte before erasing", () => {
  const original = blankBackup(DEVICES[0]);
  const first = encodeHex(original);
  const altered = new Map(original);
  altered.set(0, 0x11);
  assert.doesNotThrow(() => compareBackups(first, first, DEVICES[0]));
  assert.throws(() => compareBackups(first, encodeHex(altered), DEVICES[0]), /unstable/);
  const extra = new Map(original);
  extra.set(0x400c, 0x60);
  extra.set(0x400d, 0x05);
  assert.throws(() => compareBackups(encodeHex(extra), encodeHex(extra), DEVICES[0]), /Unexpected address/);
});
for (const [name, input] of [
  ["missing EOF", SAMPLE_HEX.split("\n")[0]],
  ["duplicate EOF", SAMPLE_HEX + eof],
  ["no data", eof],
  ["invalid checksum", SAMPLE_HEX.replace("D0", "D1")],
  ["non-hex digits", SAMPLE_HEX.replace("28D0", "x8D0")],
  ["incorrect length", SAMPLE_HEX.replace(":08", ":07")],
  ["odd byte address", image(1, [0, 0])],
  ["incomplete word", image(0, [0])],
  ["unsupported record type", record(0, 5, [0, 0, 0, 0]) + "\n" + SAMPLE_HEX],
  ["overlapping records", record(0, 0, [0, 0]) + "\n" + SAMPLE_HEX],
  ["malformed EOF", record(0, 0, [0, 0]) + "\n" + record(2, 1, [])],
  ["malformed extension", record(1, 4, [0, 0]) + "\n" + SAMPLE_HEX],
  ["64K address wrap", image(0xfffe, [0, 0, 0, 0])],
  ["oversized content", "0".repeat(MAX_HEX_SIZE + 1)],
])
  test(`rejects ${name}`, () => assert.throws(() => parseHex(input)));
test("extended address records cannot bypass device boundaries", () => {
  for (const kind of [2, 4]) {
    assert.equal(
      validateHex(record(0, kind, [0, 0]) + "\n" + SAMPLE_HEX, "PIC16F84A")
        .size,
      8,
    );
    assert.throws(() =>
      validateHex(record(0, kind, [0x80, 0]) + "\n" + SAMPLE_HEX, "PIC16F84A"),
    );
  }
});
for (const d of DEVICES)
  test(`${d.name}: allow last legal word and EEPROM byte, reject protected regions`, () => {
    assert.equal(
      validateHex(image((d.words - d.reserved - 1) * 2, [0xff, 0x3f]), d.name)
        .size,
      2,
    );
    assert.equal(
      validateHex(image((0x2100 + d.eeprom - 1) * 2, [0xff, 0]), d.name).size,
      2,
    );
    for (const addr of [
      (d.words - d.reserved) * 2,
      0x400c,
      0x400e,
      (0x2100 + d.eeprom) * 2,
    ])
      assert.throws(() => validateHex(image(addr, [0, 0]), d.name));
    assert.throws(() => validateHex(image(0, [0, 0x40]), d.name));
    assert.throws(() => validateHex(image(0x4200, [0, 1]), d.name));
  });
test("native validation rejects virtual ports, unapproved boards and missing setup approval", () => {
  const req = {
    board: "uno",
    target: "PIC16F84A",
    port: "COM12",
    verifiedSetup: true,
  };
  assert.equal(requestProfile(req).port, "COM12");
  for (const wrong of [
    { port: "VIRTUAL-01" },
    { port: "COM3 extra" },
    { port: "../device" },
    { port: "COM0" },
    { verifiedSetup: false },
    { verifiedSetup: 1 },
    { board: "uno-r4" },
    { target: "PIC16F84" },
  ])
    assert.throws(() => requestProfile({ ...req, ...wrong }));
});
test("firmware identity and geometry are exact, not substring matches", () => {
  const d = DEVICES[0],
    good =
      "ProgramPIC 1.8.horo\r\nDevice pic16f84a, program memory: 1024 words, data memory: 64 bytes.\r\n";
  requireDetected(good, d);
  for (const bad of [
    good.replace("1.8.horo", "1.8"),
    good.replace("1.8.horo", "1.8.horo-alternate"),
    good.replace("1024", "2048"),
    good.replace("64 bytes", "128 bytes"),
    good.replace("pic16f84a", "pic16f84"),
  ])
    assert.throws(() => requireDetected(bad, d));
  assert.throws(() => requireFirmware("ProgramPIC 1.8.horo\nPIC16F84AB", d));
});
for (const dev of DEVICES)
  test(`${dev.name}: preserves metadata and verifies every program and EEPROM byte`, () => {
    const original = blankBackup(dev);
    original.set(0x4200, 0x6a);
    original.set(0x4000, 0x31);
    const plan = prepareWrite(encodeHex(original), SAMPLE_HEX, dev.name);
    assert.equal(plan.size, 8);
    assert.equal(plan.expected.get(0x4200), 0x6a);
    assert.equal(plan.expected.get(0x4000), 0x31);
    assert.equal(verifyReadback(plan.expected, encodeHex(plan.expected)), true);
    const damaged = new Map(plan.expected);
    damaged.set(1, 0x01);
    assert.throws(
      () => verifyReadback(plan.expected, encodeHex(damaged)),
      /mismatch/,
    );
    original.delete(128);
    assert.throws(() =>
      prepareWrite(encodeHex(original), SAMPLE_HEX, dev.name),
    );
  });
test("protected PIC12F675 code and EEPROM both block erase; OSCCAL must survive", () => {
  const d = DEVICES.find((x) => x.name === "PIC12F675");
  const original = blankBackup(d);
  for (const badConfig of [0x3f7f, 0x3eff]) {
    const cp = new Map(original);
    cp.set(0x400e, badConfig & 255);
    cp.set(0x400f, badConfig >> 8);
    assert.throws(
      () => prepareWrite(encodeHex(cp), SAMPLE_HEX, d.name),
      /protection/,
    );
  }
  original.set(2047, 0x3f);
  assert.throws(
    () => prepareWrite(encodeHex(original), SAMPLE_HEX, d.name),
    /calibration/,
  );
});
