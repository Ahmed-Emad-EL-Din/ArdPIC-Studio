import test from "node:test";
import assert from "node:assert/strict";
import { classifySerialDevices } from "../desktop/setup.mjs";

const wch = (name, code, pid = "7523") => ({
  Name: name,
  ConfigManagerErrorCode: code,
  PNPDeviceID: `USB\\VID_1A86&PID_${pid}\\5&1A2B3C4D&0&1`,
  HardwareID: [`USB\\VID_1A86&PID_${pid}`, "USB\\VID_1A86"],
});
const other = (name, code = 0) => ({
  Name: name,
  ConfigManagerErrorCode: code,
  PNPDeviceID: "FTDIBUS\\VID_0403&PID_6001\\ABCDEF",
});

test("unavailable device list reports information, not failure", () => {
  assert.equal(classifySerialDevices(null).status, "info");
});

test("no devices at all reports information and mentions the CH340 driver", () => {
  const result = classifySerialDevices([]);
  assert.equal(result.status, "info");
  assert.match(result.detail, /CH341SER/);
});

test("a healthy CH340 on a COM port reports ok with its port", () => {
  const result = classifySerialDevices([wch("USB-SERIAL CH340 (COM7)", 0)]);
  assert.equal(result.status, "ok");
  assert.equal(result.faulty, false);
  assert.match(result.detail, /CH340 on COM7 \(VID_1A86\)/);
});

test("a CH340K with driver error 28 (not installed) is a warning with WCH guidance", () => {
  const result = classifySerialDevices([wch("USB-SERIAL CH340", 28)]);
  assert.equal(result.status, "warning");
  assert.equal(result.faulty, true);
  assert.match(result.detail, /VID_1A86/);
  assert.match(result.detail, /code 28/);
  assert.match(result.detail, /CH341SER/);
});

test("a CH9102 with driver error 10 (cannot start) is a warning naming the family", () => {
  const result = classifySerialDevices([
    wch("USB-Enhanced-SERIAL CH9102 (COM4)", 10, "55D4"),
  ]);
  assert.equal(result.status, "warning");
  assert.match(result.detail, /CH9102/);
  assert.match(result.detail, /code 10/);
  assert.match(result.detail, /COM4/);
});

test("a WCH device with no driver error but no COM port still warns", () => {
  const result = classifySerialDevices([wch("USB-SERIAL CH340", 0)]);
  assert.equal(result.status, "warning");
  assert.equal(result.faulty, false);
  assert.match(result.detail, /has not assigned a COM port/);
});

test("a faulty non-WCH device keeps the generic driver message", () => {
  const result = classifySerialDevices([other("USB Serial Port (COM3)", 31)]);
  assert.equal(result.status, "warning");
  assert.equal(result.faulty, true);
  assert.match(result.detail, /code 31/);
  assert.doesNotMatch(result.detail, /CH341SER/);
});

test("a fault on the WCH device wins over healthy generic ports", () => {
  const result = classifySerialDevices([
    other("USB Serial Port (COM3)", 0),
    wch("USB-SERIAL CH340", 28),
  ]);
  assert.equal(result.status, "warning");
  assert.equal(result.faulty, true);
  assert.match(result.detail, /CH341SER/);
});

test("healthy generic ports are reported with their names", () => {
  const result = classifySerialDevices([
    other("USB Serial Port (COM3)", 0),
    other("USB Serial Port (COM9)", 0),
  ]);
  assert.equal(result.status, "ok");
  assert.match(result.detail, /COM3/);
  assert.match(result.detail, /COM9/);
});

test("junk records are ignored instead of throwing", () => {
  const result = classifySerialDevices([null, 42, { Name: 123 }, wch("USB-SERIAL CH340 (COM2)", 0)]);
  assert.equal(result.status, "ok");
  assert.match(result.detail, /COM2/);
});

test("a single CH341 (5523) is recognized by family name", () => {
  const result = classifySerialDevices([wch("USB-Serial CH341A (COM11)", 0, "5523")]);
  assert.equal(result.status, "ok");
  assert.match(result.detail, /CH341 on COM11/);
});
