import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSetupService } from "../desktop/setup.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), "ardpic-setup-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const content = Buffer.from("approved optional component");
  const component = {
    id: "test-component", label: "Test component", file: "component.dat",
    url: "https://example.org/approved/component.dat", sha256: digest(content),
  };
  const service = createSetupService({
    userData: dir, backupDir: join(dir, "backups"), listDevices: async () => [],
    readManifest: async () => Buffer.from(JSON.stringify({ components: [component] })),
    approvedComponents: [component],
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, "error");
      return { ok: true, url: component.url, headers: new Headers(),
        body: (async function* () { yield content; })() };
    },
    ...overrides,
  });
  return { dir, service, content, component };
}
test("approved optional download is streamed, hashed and installed", async (t) => {
  const { dir, service, component, content } = await fixture(t);
  const report = await service.repair("components");
  assert.equal(report.items.find((i) => i.id === "components").status, "ok");
  assert.deepEqual(await readFile(join(dir, "components", component.file)), content);
});
test("rejects an unapproved repair request", async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(service.repair("all"), /Unknown repair/);
});
test("rejects a redirect, wrong digest and oversized response without retaining a partial file", async (t) => {
  for (const failure of ["redirect", "hash", "size", "stream-overflow"]) {
    const { dir, component } = await fixture(t);
    const service = createSetupService({
      userData: dir, backupDir: join(dir, "backups"), listDevices: async () => [],
      readManifest: async () => Buffer.from(JSON.stringify({ components: [component] })),
      approvedComponents: [component],
      fetchImpl: async () => ({ ok: true,
        url: failure === "redirect" ? "https://evil.example/data" : component.url,
        headers: new Headers(failure === "size" ? { "content-length": "99999999" } : {}),
        body: (async function* () {
          yield failure === "stream-overflow"
            ? Buffer.alloc(8 * 1024 * 1024 + 1)
            : Buffer.from("tampered");
        })(),
      }),
    });
    await assert.rejects(service.repair("components"));
    assert.deepEqual(await readdir(join(dir, "components")).catch(() => []), []);
  }
});
test("rejects a malicious manifest before fetching", async (t) => {
  const { dir, component } = await fixture(t);
  let fetched = false;
  const service = createSetupService({
    userData: dir, backupDir: join(dir, "backups"), listDevices: async () => [],
    readManifest: async () => Buffer.from(JSON.stringify({ components: [{ ...component, file: "../escape" }] })),
    approvedComponents: [component], fetchImpl: async () => { fetched = true; throw Error("unexpected"); },
  });
  await assert.rejects(service.repair("components"), /approved release manifest/);
  assert.equal(fetched, false);
});
test("component manifest with CRLF line endings from a Windows checkout is accepted", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ardpic-crlf-manifest-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const raw = await readFile(
    new URL("../desktop/components.json", import.meta.url),
  );
  // Normalize first: on a Windows checkout the file may already be CRLF.
  const lf = Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"));
  const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"));
  const service = createSetupService({
    userData: dir,
    backupDir: join(dir, "backups"),
    listDevices: async () => [],
    readManifest: async () => crlf,
  });
  const report = await service.check();
  assert.equal(report.items.find((i) => i.id === "components").status, "ok");
});
test("default release requires no optional downloads and fails closed on unsupported OS", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ardpic-default-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const service = createSetupService({ userData: dir, backupDir: join(dir, "backups"), listDevices: async () => [] });
  const report = await service.check();
  assert.equal(report.items.find((i) => i.id === "components").status, "ok");
  if (process.platform !== "win32") { assert.equal(report.ready, false); assert.equal(report.supported, false); }
});