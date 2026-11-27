import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdtemp,
  mkdir,
  rm,
  open,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { validateHex } from "../src/lib/hex.mjs";
import {
  prepareWrite,
  compareBackups,
  requestProfile,
  requireDetected,
  requireFirmware,
  verifyReadback,
} from "./safety.mjs";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("./", import.meta.url));
const digest = (data) => createHash("sha256").update(data).digest("hex");
// Checkouts on Windows (core.autocrlf) can rewrite LF to CRLF in text files.
// Pinned hashes refer to the canonical bytes, so also try the LF-normalized form.
const digestText = (data) =>
  digest(Buffer.from(String(data).replace(/\r\n/g, "\n")));
const matchesDigest = (data, expected) =>
  digest(data) === expected || digestText(data) === expected;
const approvedFirmware =
  "742dacffec6e9a609b6789384dde1671d7c52393fbe6237caa4c6204076c3384";

export async function physicalPorts() {
  if (process.platform !== "win32")
    throw new Error("This native adapter requires Windows x64.");
  const powershell = join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const { stdout } = await execute(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[System.IO.Ports.SerialPort]::GetPortNames()",
    ],
    { timeout: 10000, windowsHide: true, maxBuffer: 32768 },
  );
  return [
    ...new Set(stdout.split(/\s+/).filter((p) => /^COM[1-9]\d{0,2}$/.test(p))),
  ].sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
}
async function command(tool, args, cwd = root, timeout = 30000) {
  const manifest = JSON.parse(
    await readFile(join(root, "binary-checksums.json"), "utf8"),
  );
  for (const file of tool === "avrdude.exe"
    ? [tool, "libusb0.dll", "avrdude.conf"]
    : [tool]) {
    if (!matchesDigest(await readFile(join(root, "bin", file)), manifest[file]))
      throw new Error(
        "Bundled tool integrity check failed. Reinstall a trusted build.",
      );
  }
  try {
    const { stdout, stderr } = await execute(join(root, "bin", tool), args, {
      cwd,
      timeout,
      windowsHide: true,
      shell: false,
      maxBuffer: 1024 * 1024,
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        TEMP: tmpdir(),
        TMP: tmpdir(),
        PATH: join(process.env.SystemRoot || "C:\\Windows", "System32"),
      },
    });
    return `${stdout}\n${stderr}`;
  } catch (e) {
    const detail = String(e.stderr || e.stdout || "")
      .trim()
      .split("\n")
      .slice(-4)
      .join(" ")
      .slice(0, 400);
    throw new Error(
      e.killed
        ? "Hardware operation timed out. State is unknown. Isolate the supplies, inspect the wiring, and reconnect."
        : `Hardware command failed. ${detail || "Check the port, USB driver, and programmer firmware."}`,
    );
  }
}

export function createHardwareService({
  backupDir,
  confirm,
  run = command,
  discover = physicalPorts,
  preflight = async () => {},
}) {
  let busy = false,
    session = null;
  const exclusive = async (fn) => {
    if (busy) throw new Error("A hardware operation is already in progress.");
    busy = true;
    try {
      return await fn();
    } catch (e) {
      session = null;
      throw e;
    } finally {
      busy = false;
    }
  };
  const check = async (req) => {
    const profile = requestProfile(req);
    await preflight();
    if (!(await discover()).includes(profile.port))
      throw new Error("The selected COM port is no longer present.");
    return profile;
  };
  const host = (req, args, cwd = root, timeout = 30000) =>
    run(
      "ardpicprog.exe",
      ["--pic-serial-port", req.port, "--speed", "115200", ...args],
      cwd,
      timeout,
    );
  const identify = async (req, device) => {
    const out = await host(req, ["--list-devices"]);
    requireFirmware(out, device);
    return out;
  };
  const bind = (req) => {
    session = {
      board: req.board,
      target: req.target,
      port: req.port,
      verifiedSetup: true,
    };
  };
  return {
    get busy() {
      return busy;
    },
    ports: discover,
    disconnect: async () => {
      if (busy)
        throw new Error(
          "Wait for the operation to finish before disconnecting.",
        );
      session = null;
    },
    connect: (req) =>
      exclusive(async () => {
        session = null;
        const { device } = await check(req);
        const output = await identify(req, device);
        bind(req);
        return output.trim();
      }),
    monitor: () =>
      exclusive(async () => {
        if (!session) throw new Error("Verify the programmer first.");
        const { device } = await check(session);
        return identify(session, device);
      }),
    upload: (req) =>
      exclusive(async () => {
        session = null;
        const { board, device } = await check(req);
        const folder = join(
          root,
          "firmware",
          board.id === "uno" ? "uno" : "nano",
        );
        if (
          !matchesDigest(
            await readFile(join(folder, "ProgramPic.ino.hex")),
            approvedFirmware,
          )
        )
          throw new Error("Firmware hash mismatch. Upload blocked.");
        if (
          !(await confirm(
            "Replace Arduino firmware?",
            `${board.name} on ${req.port}\n\nRemove the PIC and disconnect external VPP. This replaces the existing Arduino sketch with ProgramPIC 1.8.horo. Only proceed with the matching Ho-Ro interface.`,
            "Upload firmware",
          ))
        )
          throw new Error("Upload cancelled. No write was performed.");
        await check(req);
        await run(
          "avrdude.exe",
          [
            "-C",
            join(root, "bin", "avrdude.conf"),
            "-p",
            "atmega328p",
            "-c",
            "arduino",
            "-P",
            req.port,
            "-b",
            String(board.baud),
            "-D",
            "-U",
            "flash:w:ProgramPic.ino.hex:i",
            "-U",
            "flash:v:ProgramPic.ino.hex:i",
          ],
          folder,
          100000,
        );
        await new Promise((resolve) => setTimeout(resolve, 1700));
        const output = await identify(req, device);
        bind(req);
        return `Arduino flash verified. ${output.trim()}`;
      }),
    program: (req) =>
      exclusive(async () => {
        if (
          !session ||
          ["port", "target", "board"].some((key) => req[key] !== session[key])
        )
          throw new Error(
            "The programmer authorization is missing or stale. Reconnect first.",
          );
        const { device } = await check(req);
        validateHex(req.text, device.name);
        if (
          typeof req.name !== "string" ||
          !/^[^\x00-\x1f\\/]{1,180}\.hex$/i.test(req.name)
        )
          throw new Error("Invalid HEX filename.");
        if (
          !(await confirm(
            "Check the physical setup",
            `${device.name} on ${req.port}\n\nThe next read applies programming voltage. Confirm the matching Ho-Ro circuit, target orientation, and measured VDD/VPP. Do not change the board or PIC during this operation.`,
            "Identify and back up",
          ))
        )
          throw new Error(
            "Preflight cancelled. No hardware write was performed.",
          );
        await identify(req, device);
        requireDetected(
          await host(req, ["--device", "auto", "--detect"]),
          device,
        );
        const temp = await mkdtemp(join(tmpdir(), "ardpic-"));
        let backupPath = null;
        try {
          const cli = ["--device", device.name.toLowerCase()];
          const backupOutput = await host(
            req,
            [...cli, "--output-hexfile", "backup.hex"],
            temp,
            180000,
          );
          requireDetected(backupOutput, device);
          const backup = await readFile(join(temp, "backup.hex"), "utf8");
          const secondOutput = await host(
            req,
            [...cli, "--output-hexfile", "backup-check.hex"],
            temp,
            180000,
          );
          requireDetected(secondOutput, device);
          const secondBackup = await readFile(join(temp, "backup-check.hex"), "utf8");
          compareBackups(backup, secondBackup, device);
          const plan = prepareWrite(backup, req.text, device.name);
          await mkdir(backupDir, { recursive: true });
          const candidatePath = resolve(
            backupDir,
            `${new Date().toISOString().replace(/[:.]/g, "-")}_${req.port}_${device.name}.hex`,
          );
          const durable = await open(candidatePath, "wx", 0o600);
          try {
            await durable.writeFile(backup);
            await durable.sync();
          } finally {
            await durable.close();
          }
          if (digest(await readFile(candidatePath)) !== digest(backup))
            throw new Error(
              "Backup storage verification failed. Erase blocked.",
            );
          backupPath = candidatePath;
          if (
            !(await confirm(
              "Erase and program the target?",
              `${device.name} / ${req.port}\n${req.name}: ${plan.size} validated bytes\n\nBackup saved to ${backupPath}\n\nThis will erase program memory. Unspecified EEPROM, user IDs, configuration and calibration are preserved. Keep the hardware powered and unchanged.`,
              "Erase and program",
            ))
          )
            throw new Error(
              `Write cancelled. Backup retained at ${backupPath}.`,
            );
          await check(req);
          await writeFile(join(temp, "validated.hex"), plan.prepared, {
            flag: "wx",
            mode: 0o600,
          });
          // The hardened host repeats identity checks on the very same handle used to erase and write.
          const result = await host(
            req,
            [
              ...cli,
              "--input-hexfile",
              "validated.hex",
              "--erase",
              "--burn",
              "--output-hexfile",
              "readback.hex",
            ],
            temp,
            300000,
          );
          requireDetected(result, device);
          verifyReadback(
            plan.expected,
            await readFile(join(temp, "readback.hex"), "utf8"),
          );
          return `Full target readback passed. Backup: ${backupPath}`;
        } catch (error) {
          if (backupPath) {
            const cause = error instanceof Error ? error.message : String(error);
            throw new Error(`${cause} Original target backup: ${backupPath}`);
          }
          throw error;
        } finally {
          await rm(temp, { recursive: true, force: true });
        }
      }),
  };
}
