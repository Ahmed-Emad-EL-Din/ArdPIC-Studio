import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const here = fileURLToPath(new URL("./", import.meta.url));
const APPROVED_FIRMWARE =
  "742dacffec6e9a609b6789384dde1671d7c52393fbe6237caa4c6204076c3384";
const APPROVED_MANIFEST =
  "2cb017c0848ffb53e600d36c092a9fbbf52684a00e00501db9ab83c229a08658";
const MAX_COMPONENT_BYTES = 8 * 1024 * 1024;
const FIRMWARE = [
  [
    "uno",
    "Arduino Uno firmware",
    join(here, "firmware", "uno", "ProgramPic.ino.hex"),
  ],
  [
    "nano",
    "Arduino Nano firmware",
    join(here, "firmware", "nano", "ProgramPic.ino.hex"),
  ],
];
const digest = (data) => createHash("sha256").update(data).digest("hex");
// Checkouts on Windows (core.autocrlf) can rewrite LF to CRLF in text files.
// Pinned hashes refer to the canonical LF bytes, so also try the LF-normalized form.
const digestText = (data) =>
  digest(Buffer.from(String(data).replace(/\r\n/g, "\n")));
const matchesDigest = (data, expected) =>
  digest(data) === expected || digestText(data) === expected;
const item = (id, label, status, detail, fix = null) => ({
  id,
  label,
  status,
  detail,
  fix,
});

// Lists COM-port devices and their Windows driver error codes. Returns null off Windows.
export async function serialDevices() {
  if (process.platform !== "win32") return null;
  const powershell = join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const script =
    "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | Select-Object Name, ConfigManagerErrorCode | ConvertTo-Json -Compress";
  const { stdout } = await execute(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    { timeout: 15000, windowsHide: true, maxBuffer: 1 << 20 },
  );
  const text = stdout.trim();
  if (!text) return [];
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [data];
}

export function createSetupService({
  userData,
  backupDir,
  listDevices = serialDevices,
  fetchImpl = fetch,
  approvedComponents = [],
  readManifest = () => readFile(join(here, "components.json")),
}) {
  const componentDir = join(userData, "components");

  async function manifest() {
    const raw = await readManifest();
    if (!matchesDigest(raw, APPROVED_MANIFEST) && !approvedComponents.length)
      throw new Error("Component manifest has changed. Reinstall the application.");
    const data = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(data.components) || data.components.length !== approvedComponents.length)
      throw new Error("The component manifest contains unapproved downloads.");
    for (const component of data.components) {
      const approved = approvedComponents.find((entry) =>
        ["id", "label", "file", "url", "sha256"].every((key) => entry[key] === component[key]),
      );
      if (!approved || !/^[a-zA-Z0-9._-]{1,100}$/.test(component.file) ||
          component.file === "." || component.file === ".." ||
          !/^https:\/\/[^\s/#?]+\/[^\s]*$/.test(component.url) ||
          !/^[a-f0-9]{64}$/.test(component.sha256))
        throw new Error("An optional component is not in the approved release manifest.");
    }
    return data.components;
  }

  async function installed(component) {
    const meta = await stat(join(componentDir, component.file)).catch(() => null);
    if (!meta?.isFile() || meta.size > MAX_COMPONENT_BYTES) return false;
    const data = await readFile(join(componentDir, component.file)).catch(
      () => null,
    );
    return Boolean(data) && digest(data) === component.sha256;
  }

  async function download(component) {
    const response = await fetchImpl(component.url, {
      redirect: "error",
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok || response.url !== component.url)
      throw new Error(`${component.label}: the approved download source was unavailable.`);
    const length = response.headers?.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_COMPONENT_BYTES))
      throw new Error(`${component.label}: download exceeds the 8 MiB limit.`);
    if (!response.body) throw new Error(`${component.label}: no download body was returned.`);
    await mkdir(componentDir, { recursive: true });
    const temp = join(componentDir, `${randomUUID()}.part`);
    const file = await open(temp, "wx", 0o600);
    let size = 0;
    const hash = createHash("sha256");
    try {
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > MAX_COMPONENT_BYTES)
          throw new Error(`${component.label}: download exceeds the 8 MiB limit.`);
        hash.update(chunk);
        let offset = 0;
        while (offset < chunk.byteLength) {
          const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset);
          if (!bytesWritten) throw new Error("Download could not be written to disk.");
          offset += bytesWritten;
        }
      }
      if (hash.digest("hex") !== component.sha256)
        throw new Error(`${component.label}: checksum mismatch. The download was discarded.`);
      await file.sync();
    } catch (error) {
      await file.close();
      await unlink(temp).catch(() => {});
      throw error;
    }
    await file.close();
    try {
      await rename(temp, join(componentDir, component.file));
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
  }

  async function checkBundled() {
    const items = [];
    const checksums = JSON.parse(
      await readFile(join(here, "binary-checksums.json"), "utf8"),
    );
    for (const [name, expected] of Object.entries(checksums)) {
      const data = await readFile(join(here, "bin", name)).catch(() => null);
      const ok = Boolean(data) && matchesDigest(data, expected);
      items.push(
        ok
          ? item(
              `tool:${name}`,
              `Tool: ${name}`,
              "ok",
              "Present, checksum verified.",
            )
          : item(
              `tool:${name}`,
              `Tool: ${name}`,
              "error",
              "Missing or changed. Reinstall ArdPIC Studio from the official ZIP. Damaged tools are never replaced silently.",
            ),
      );
    }
    for (const [board, label, path] of FIRMWARE) {
      const data = await readFile(path).catch(() => null);
      const ok = Boolean(data) && matchesDigest(data, APPROVED_FIRMWARE);
      items.push(
        ok
          ? item(
              `firmware:${board}`,
              label,
              "ok",
              "Present, approved image verified.",
            )
          : item(
              `firmware:${board}`,
              label,
              "error",
              "Missing or not the approved ProgramPIC 1.8.horo image. Reinstall ArdPIC Studio.",
            ),
      );
    }
    return items;
  }

  async function checkBackups() {
    const probe = join(backupDir, `.write-test-${randomUUID()}`);
    try {
      await mkdir(backupDir, { recursive: true });
      await writeFile(probe, "ok", { flag: "wx" });
      return item("backup", "Backup folder", "ok", `Writable: ${backupDir}`);
    } catch {
      return item(
        "backup",
        "Backup folder",
        "error",
        "Backups cannot be written to this folder. Writing to a PIC is blocked until a backup is possible.",
      );
    } finally {
      await unlink(probe).catch(() => {});
    }
  }

  async function checkSerial() {
    try {
      const devices = await listDevices();
      if (devices === null) {
        return item(
          "serial",
          "USB serial ports",
          "info",
          "Windows device list is unavailable on this system.",
        );
      }
      const faulty = devices.find((d) => d.ConfigManagerErrorCode);
      if (faulty) {
        return item(
          "serial",
          "USB serial driver",
          "warning",
          `${faulty.Name} reports a driver problem (code ${faulty.ConfigManagerErrorCode}). Install the USB serial driver for this board, then check again.`,
        );
      }
      if (!devices.length) {
        return item(
          "serial",
          "USB serial ports",
          "info",
          "No COM port is present. Connect the Arduino with a data-capable USB cable.",
        );
      }
      return item(
        "serial",
        "USB serial ports",
        "ok",
        devices.map((d) => d.Name).join("; "),
      );
    } catch {
      return item(
        "serial",
        "USB serial ports",
        "warning",
        "The Windows device list could not be read. Check the port manually.",
      );
    }
  }

  async function checkComponents() {
    const components = await manifest();
    if (!components.length) {
      return item(
        "components",
        "Optional components",
        "ok",
        "None are required. Everything the programmer needs is bundled.",
      );
    }
    const missing = [];
    for (const component of components)
      if (!(await installed(component))) missing.push(component);
    if (missing.length) {
      return item(
        "components",
        "Optional components",
        "warning",
        `Not installed: ${missing.map((c) => c.label).join(", ")}.`,
        "download",
      );
    }
    return item(
      "components",
      "Optional components",
      "ok",
      "Installed and checksum verified.",
    );
  }

  async function check() {
    const items = [];
    items.push(
      process.platform === "win32" && process.arch === "x64"
        ? item("platform", "Windows 64-bit", "ok", "Windows x64 detected.")
        : item(
            "platform",
            "Windows 64-bit",
            "error",
            "USB programming needs Windows 64-bit. Validation and virtual sessions still work on this system.",
          ),
    );
    items.push(
      item(
        "runtime",
        "Application runtime",
        "ok",
        `Electron ${process.versions.electron}, Node ${process.versions.node}.`,
      ),
    );
    items.push(...(await checkBundled()));
    items.push(await checkBackups());
    items.push(await checkSerial());
    items.push(await checkComponents());
    return {
      checkedAt: new Date().toISOString(),
      supported: process.platform === "win32" && process.arch === "x64",
      ready: items.every((i) => i.status !== "error"),
      items,
    };
  }

  // Only the optional-component manifest can be downloaded. Bundled files are never replaced by the app.
  async function repair(id) {
    if (id !== "components") throw new Error("Unknown repair action.");
    for (const component of await manifest()) {
      if (!(await installed(component))) await download(component);
    }
    return check();
  }

  return { check, repair };
}
