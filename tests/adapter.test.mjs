import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHardwareService } from "../desktop/hardware.mjs";
test("an unavailable backup destination prevents every erase command", async (t) => {
  const { api, calls, backupDir } = await fixture(t);
  await rm(backupDir, { recursive: true });
  await writeFile(backupDir, "This path is a file, not a backup directory.");
  await api.connect(req);
  await assert.rejects(api.program(req));
  assert.ok(calls.every(c => !c.args.includes("--erase")));
});
import { SAMPLE_HEX, encodeHex, parseHex } from "../src/lib/hex.mjs";

const req = {
  board: "uno",
  port: "COM7",
  target: "PIC16F84A",
  verifiedSetup: true,
  text: SAMPLE_HEX,
  name: "safe-loop.hex",
};
const version = "ProgramPIC 1.8.horo\n",
  info =
    version +
    "Device pic16f84a, program memory: 1024 words, data memory: 64 bytes.\n";
async function fixture(t, options = {}) {
  const backupDir = await mkdtemp(join(tmpdir(), "ardpic-adapter-test-"));
  t.after(() => rm(backupDir, { recursive: true, force: true }));
  const calls = [],
    memory = new Map();
  for (let w = 0; w < 1024; w++) {
    memory.set(w * 2, 255);
    memory.set(w * 2 + 1, 63);
  }
  for (let w = 0; w < 64; w++) {
    memory.set(0x4200 + w * 2, 255);
    memory.set(0x4201 + w * 2, 0);
  }
  for (let w = 0; w < 8; w++) {
    if (w === 6) continue;
    memory.set(0x4000 + w * 2, 255);
    memory.set(0x4001 + w * 2, 63);
  }
  if (options.protected) memory.set(0x400e, 15);
  let prompts = 0;
  const api = createHardwareService({
    backupDir,
    discover: async () => (options.missing ? [] : ["COM7"]),
    confirm: async () => ++prompts !== options.cancelAt,
    run: async (tool, args, cwd) => {
      calls.push({ tool, args });
      if (args.includes("--list-devices"))
        return (
          (options.badVersion ? "ProgramPIC 1.0\n" : version) +
          "Supported devices:\npic16f84a* pic16f628a*"
        );
      if (args.includes("--detect"))
        return options.wrongTarget
          ? info.replace("pic16f84a", "pic16f628a")
          : info;
      if (args.includes("--burn")) {
        for (const [addr, b] of parseHex(
          await readFile(join(cwd, "validated.hex"), "utf8"),
        ).bytes)
          memory.set(addr, b);
        if (options.mismatch) memory.set(0, 68);
        await writeFile(join(cwd, "readback.hex"), encodeHex(memory));
        return info;
      }
      if (args.includes("--output-hexfile")) {
        const output = args[args.indexOf("--output-hexfile") + 1];
        const snapshot = new Map(memory);
        if (options.unstable && output === "backup-check.hex")
          snapshot.set(0, 0x12);
        await writeFile(join(cwd, output), encodeHex(snapshot));
        return info;
      }
      return "OK";
    },
  });
  return { api, calls, backupDir };
}
test("native transaction saves a durable backup, burns with an exact target, and checks readback", async (t) => {
  const { api, calls, backupDir } = await fixture(t);
  await api.connect(req);
  assert.match(await api.program(req), /Full target readback passed/);
  assert.equal((await readdir(backupDir)).length, 1);
  const burn = calls.find((c) => c.args.includes("--burn"));
  assert.ok(burn.args.includes("pic16f84a"));
  assert.ok(!burn.args.includes("--force-calibration"));
  assert.ok(
    calls.findIndex((c) => c.args.includes("backup.hex")) < calls.indexOf(burn),
  );
});
for (const [name, options] of [
  ["wrong target", { wrongTarget: true }],
  ["protected memory", { protected: true }],
  ["cancel preflight", { cancelAt: 1 }],
  ["cancel erase", { cancelAt: 2 }],
  ["unstable readback before erase", { unstable: true }],
])
  test(`no erase after ${name}`, async (t) => {
    const { api, calls } = await fixture(t, options);
    await api.connect(req);
    await assert.rejects(api.program(req));
    assert.ok(calls.every((c) => !c.args.includes("--erase")));
  });
test("readback failure invalidates the session and cannot be reported as success", async (t) => {
  const { api, backupDir } = await fixture(t, { mismatch: true });
  await api.connect(req);
  await assert.rejects(api.program(req), (e) => {
    assert.match(e.message, /Readback mismatch/);
    assert.match(e.message, /Original target backup:/);
    return true;
  });
  assert.equal((await readdir(backupDir)).length, 1);
  await assert.rejects(api.program(req), /authorization/);
});
test("write requires a live, matching, previously verified session", async (t) => {
  const { api, calls } = await fixture(t);
  await assert.rejects(api.program(req));
  await api.connect(req);
  await assert.rejects(api.program({ ...req, target: "PIC16F628A" }), /stale/);
  assert.ok(calls.every((c) => !c.args.includes("--burn")));
});
test("a corrupt image is rejected before applying target voltage", async (t) => {
  const { api, calls } = await fixture(t);
  await api.connect(req);
  await assert.rejects(
    api.program({ ...req, text: SAMPLE_HEX.replace("D0", "00") }),
    /checksum/,
  );
  assert.ok(
    calls.every(
      (c) => !c.args.includes("--detect") && !c.args.includes("--erase"),
    ),
  );
});
test("missing physical port cannot connect or upload", async (t) => {
  const { api, calls } = await fixture(t, { missing: true });
  await assert.rejects(api.connect(req));
  await assert.rejects(api.upload(req));
  assert.equal(calls.length, 0);
});
test("firmware upload is flash-only, uses the right bootloader speed, verifies, and handshakes", async (t) => {
  const { api, calls } = await fixture(t);
  await api.upload({ ...req, board: "nano-old" });
  const upload = calls.find((c) => c.tool === "avrdude.exe");
  assert.ok(upload.args.includes("57600"));
  assert.ok(upload.args.includes("flash:v:ProgramPic.ino.hex:i"));
  assert.ok(!upload.args.includes("-F"));
  assert.ok(!upload.args.includes("-V"));
  assert.ok(!upload.args.some((a) => a.includes("fuse")));
  assert.ok(calls.at(-1).args.includes("--list-devices"));
});
test("incompatible firmware never creates an authorization", async (t) => {
  const { api, calls } = await fixture(t, { badVersion: true });
  await assert.rejects(api.connect(req), /firmware version/);
  await assert.rejects(api.program(req), /authorization/);
  assert.equal(calls.length, 1);
});
test("exclusive operation lock prevents overlapping requests", async (t) => {
  const { api } = await fixture(t);
  const first = api.connect(req);
  await assert.rejects(api.connect(req), /already in progress/);
  await first;
  await api.disconnect();
  await assert.rejects(api.monitor(), /Verify the programmer/);
});
test("required system checks fail before opening a physical programmer", async (t) => {
  const { backupDir } = await fixture(t);
  let discovered = false;
  const api = createHardwareService({
    backupDir,
    confirm: async () => true,
    discover: async () => { discovered = true; return ["COM7"]; },
    preflight: async () => { throw new Error("Bundled programmer tool is damaged."); },
  });
  await assert.rejects(api.connect(req), /damaged/);
  assert.equal(discovered, false);
});
test("preflight is repeated after consent before firmware upload", async (t) => {
  const { backupDir } = await fixture(t);
  let checks = 0, executed = false;
  const api = createHardwareService({
    backupDir,
    confirm: async () => true,
    discover: async () => ["COM7"],
    preflight: async () => { if (++checks === 2) throw new Error("Installation changed."); },
    run: async () => { executed = true; return ""; },
  });
  await assert.rejects(api.upload(req), /Installation changed/);
  assert.equal(executed, false);
});
