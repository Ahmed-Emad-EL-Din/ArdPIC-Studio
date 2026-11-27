import { useEffect, useRef, useState } from "react";
import {
  BOARDS,
  DEVICES,
  MAX_HEX_SIZE,
  SAMPLE_HEX,
  validateHex,
} from "./hex.mjs";
import type {
  DialogName,
  Firmware,
  LogEntry,
  LogLevel,
  Page,
  Preferences,
} from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let fallbackLogId = 0;
const nextLogId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `log-${Date.now().toString(36)}-${++fallbackLogId}`;
const entry = (level: LogLevel, message: string): LogEntry => ({
  id: nextLogId(),
  time: new Date().toISOString(),
  level,
  message,
});
const initialLogs = () => [
  entry("system", "ArdPIC Studio v1.0.0 initialized."),
  entry("success", "Safety interlocks enabled. Hardware writes are protected."),
  entry("info", "Waiting for a programmer connection..."),
];
const defaultPrefs: Preferences = {
  theme: "light",
  timestamps: true,
  autoScroll: true,
  reducedMotion: false,
};
function getPrefs(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem("ardpic.preferences") || "{}");
    return {
      theme: p.theme === "dark" ? "dark" : "light",
      timestamps: p.timestamps !== false,
      autoScroll: p.autoScroll !== false,
      reducedMotion: p.reducedMotion === true,
    };
  } catch {
    return defaultPrefs;
  }
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-GB", { hour12: false });

export function useWorkbench() {
  const [page, setPage] = useState<Page>("Programmer");
  const [dialog, setDialog] = useState<DialogName>(null);
  const [boardId, setBoardId] = useState("uno");
  const [target, setTarget] = useState("PIC16F84A");
  const [port, setPort] = useState("");
  const [ports, setPorts] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [verified, setVerified] = useState(false);
  const [firmware, setFirmware] = useState<Firmware | null>(null);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [serialLines, setSerialLines] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
    key: number;
  } | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(getPrefs);
  const [guideStep, setGuideStep] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [connectionChoice, setConnectionChoice] = useState<
    "virtual" | "hardware"
  >(window.ardpic ? "hardware" : "virtual");
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const virtualMemory = useRef(new Map<number, number>());
  const board = BOARDS.find((b) => b.id === boardId) || BOARDS[0];
  const device = DEVICES.find((d) => d.name === target) || DEVICES[0];
  const virtual = port === "VIRTUAL-01";
  const notify = (message: string, error = false) =>
    setToast({ message, error, key: Date.now() });
  const log = (level: LogLevel, message: string) =>
    setLogs((old) => [...old.slice(-999), entry(level, message)]);
  const serial = (message: string) =>
    setSerialLines((old) => [
      ...old.slice(-199),
      `${formatTime(new Date().toISOString())}  ${message}`,
    ]);

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.dataset.motion = prefs.reducedMotion
      ? "reduced"
      : "normal";
    try {
      localStorage.setItem("ardpic.preferences", JSON.stringify(prefs));
    } catch {
      /* Settings remain session-local when storage is unavailable. */
    }
  }, [prefs]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.error ? 8000 : 4200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!connected || virtual || busy || !window.ardpic) return;
    let active = true,
      checking = false;
    const timer = setInterval(async () => {
      if (checking || lock.current) return;
      checking = true;
      try {
        const found = await window.ardpic!.ports();
        if (active && !lock.current && !found.includes(port))
          throw new Error(
            "Programmer unplugged. Write authorization released.",
          );
      } catch {
        if (active && !lock.current) {
          setConnected(false);
          setVerified(false);
          setPort("");
          setPorts([]);
          void window.ardpic!.disconnect().catch(() => undefined);
          setLogs((old) => [
            ...old.slice(-999),
            entry(
              "warning",
              "Port is no longer available. Hardware writes are locked.",
            ),
          ]);
        }
      } finally {
        checking = false;
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connected, virtual, busy, port]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (lock.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);

  const run = async (
    label: string,
    fn: () => Promise<void>,
    invalidateOnError = true,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setProgress(0);
    try {
      await fn();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message.replace(
              /^Error invoking remote method '[^']+': (?:Error: )?/,
              "",
            )
          : "The operation could not be completed.";
      if (invalidateOnError) {
        setConnected(false);
        setVerified(false);
        void window.ardpic?.disconnect().catch(() => undefined);
      }
      log("error", message);
      notify(message, true);
    } finally {
      lock.current = false;
      setBusy("");
      setProgress(0);
    }
  };
  const go = (next: Page) => {
    if (!lock.current) {
      setDialog(null);
      setPage(next);
      document.querySelector(".main-scroll")?.scrollTo(0, 0);
    }
  };
  const open = (next: DialogName) => {
    if (!lock.current) {
      setToast(null);
      setDialog(next);
    }
  };
  const invalidate = () => {
    if (connected)
      log(
        "info",
        "Connection released. Verify the new hardware configuration before writing.",
      );
    setConnected(false);
    setVerified(false);
    void window.ardpic?.disconnect().catch(() => undefined);
  };
  const chooseBoard = (id: string) => {
    if (!lock.current && BOARDS.some((b) => b.id === id)) {
      invalidate();
      setBoardId(id);
    }
  };
  const choosePort = (value: string) => {
    if (!lock.current) {
      invalidate();
      setPort(value);
      setConnectionChoice(value === "VIRTUAL-01" ? "virtual" : "hardware");
    }
  };
  const chooseTarget = (value: string) => {
    if (
      lock.current ||
      value === target ||
      !DEVICES.some((d) => d.name === value)
    )
      return;
    invalidate();
    setTarget(value);
    setFileError("");
    if (firmware) {
      setFirmware(null);
      setFileError(`Target changed. Reload a HEX file built for ${value}.`);
      log(
        "info",
        "Target profile changed. Previous HEX authorization cleared.",
      );
    }
  };
  const load = (text: string, name: string) => {
    setFirmware(null);
    setVerified(false);
    setFileError("");
    try {
      if (!/\.hex$/i.test(name))
        throw new Error("Choose an Intel HEX file with a .hex extension.");
      const parsed = validateHex(text, target);
      setFirmware({ name, text, size: parsed.size, records: parsed.records });
      log("success", `${name}: ${parsed.size} bytes validated for ${target}.`);
      notify("HEX file validated and ready.");
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid HEX file.";
      setFileError(message);
      log("error", message);
      return false;
    }
  };
  const loadFile = async (file?: File) => {
    if (!file || lock.current) return;
    await run(
      "Validating file",
      async () => {
        setFirmware(null);
        setVerified(false);
        if (file.size > MAX_HEX_SIZE) {
          setFileError("File exceeds the 1 MiB safety limit.");
          log("error", "Oversized HEX file rejected.");
          return;
        }
        load(await file.text(), file.name);
      },
      false,
    );
  };
  const example = () => {
    if (!lock.current) {
      go("Programmer");
      load(SAMPLE_HEX, "safe-loop.hex");
    }
  };
  const refreshPorts = async () => {
    if (!window.ardpic) {
      setConnectionChoice("hardware");
      open("connect");
      return;
    }
    await run(
      "Scanning ports",
      async () => {
        const found = await window.ardpic!.ports();
        setPorts(found);
        if (port && !virtual && !found.includes(port)) {
          invalidate();
          setPort("");
        }
        notify(
          found.length
            ? `${found.length} serial port${found.length > 1 ? "s" : ""} found. Select your board's port.`
            : "No serial ports found. Check the USB cable and driver.",
        );
        log("info", `Port scan: ${found.length} physical ports found.`);
      },
      false,
    );
  };
  const connect = async (useVirtual: boolean, acknowledged: boolean) => {
    const selected = useVirtual ? "VIRTUAL-01" : port;
    await run("Verifying programmer", async () => {
      if (
        !useVirtual &&
        (!window.ardpic ||
          !selected ||
          selected === "VIRTUAL-01" ||
          !acknowledged)
      )
        throw new Error(
          "Select a physical port and confirm the safe connection setup first.",
        );
      setPort(selected);
      setVerified(false);
      let output: string;
      if (useVirtual) {
        await window.ardpic?.disconnect();
        await delay(340);
        setProgress(65);
        await delay(280);
        output = `ProgramPIC 1.8.horo\nVirtual profile: ${board.name}\nTarget profile: ${target}`;
      } else
        output = await window.ardpic!.connect({
          board: boardId,
          port: selected,
          target,
          verifiedSetup: acknowledged,
        });
      setConnected(true);
      setDialog(null);
      serial(`${useVirtual ? "[VIRTUAL] " : ""}${output}`);
      log(
        "success",
        `${useVirtual ? "[Virtual] " : ""}${board.name} verified on ${selected}. ProgramPIC 1.8.horo ready.`,
      );
      notify(
        useVirtual
          ? "Virtual programmer connected. No hardware is in use."
          : "Programmer firmware verified.",
      );
    });
  };
  const disconnect = () => {
    if (!lock.current) {
      invalidate();
      log("info", "Programmer disconnected. Write interlock locked.");
      notify("Programmer disconnected.");
    }
  };
  const requestConnect = () => {
    if (connected) {
      disconnect();
      return;
    }
    setConnectionChoice(
      virtual || (!port && !window.ardpic) ? "virtual" : "hardware",
    );
    open("connect");
  };
  const upload = async (acknowledged: boolean) => {
    if (!port || !acknowledged) return;
    await run("Uploading firmware", async () => {
      setConnected(false);
      setVerified(false);
      if (virtual) {
        for (const n of [18, 45, 72, 94]) {
          await delay(230);
          setProgress(n);
        }
        serial(
          "[VIRTUAL] Firmware image loaded. ProgramPIC 1.8.horo replied to the version query.",
        );
      } else {
        if (!window.ardpic)
          throw new Error(
            "Physical firmware upload requires the desktop application.",
          );
        serial(
          await window.ardpic.upload({
            board: boardId,
            port,
            target,
            verifiedSetup: acknowledged,
          }),
        );
      }
      setConnected(true);
      setDialog(null);
      log(
        "success",
        `${virtual ? "[Virtual] " : ""}ProgramPIC firmware uploaded and verified on ${board.name}.`,
      );
      notify("Firmware verified. Your programmer is ready.");
    });
  };
  const program = async (acknowledged: boolean) => {
    if (!connected || !firmware || !acknowledged) return;
    await run("Programming target", async () => {
      const image = validateHex(firmware.text, target);
      setVerified(false);
      log(
        "info",
        `${virtual ? "[Virtual] " : ""}Starting confirmed programming operation for ${target}.`,
      );
      if (virtual) {
        virtualMemory.current.clear();
        await delay(250);
        setProgress(20);
        for (const [address, value] of image.bytes)
          virtualMemory.current.set(address, value);
        await delay(350);
        setProgress(72);
        for (const [address, value] of image.bytes)
          if (virtualMemory.current.get(address) !== value)
            throw new Error("Virtual readback mismatch.");
        await delay(250);
        setProgress(100);
        serial(
          `[VIRTUAL] ${image.size} bytes written; independent memory readback matched.`,
        );
      } else {
        if (!window.ardpic)
          throw new Error(
            "Physical programming requires the desktop application.",
          );
        const result = await window.ardpic.program({
          board: boardId,
          target,
          port,
          text: firmware.text,
          name: firmware.name,
          verifiedSetup: acknowledged,
        });
        serial(result);
        log("success", result);
      }
      setVerified(true);
      setDialog(null);
      log(
        "success",
        `${virtual ? "[Virtual] " : ""}${target}: ${image.size} bytes programmed. Readback verification passed.`,
      );
      notify(
        virtual
          ? "Virtual target programmed and verified."
          : "Target programming and readback verification passed.",
      );
    });
  };
  const monitor = async () => {
    if (!connected) {
      requestConnect();
      return;
    }
    await run("Reading identity", async () => {
      const reply = virtual
        ? "ProgramPIC 1.8.horo\nSupported profiles: " +
          DEVICES.map((d) => d.name).join(", ")
        : await window.ardpic!.monitor();
      serial(`${virtual ? "[VIRTUAL] " : ""}${reply}`);
      log("info", "Read-only programmer identity query completed.");
    });
  };
  const reset = () => {
    if (!lock.current) {
      invalidate();
      setLogs(initialLogs());
      setPort("");
      setBoardId("uno");
      setTarget("PIC16F84A");
      setFirmware(null);
      setFileError("");
      setSerialLines([]);
      virtualMemory.current.clear();
      go("Programmer");
      notify("New local session created.");
    }
  };
  const exportLogs = () => {
    downloadText(
      `ardpic-session-${new Date().toISOString().slice(0, 10)}.log`,
      logs
        .map(
          (l) => `[${l.time}] ${l.level.toUpperCase().padEnd(7)} ${l.message}`,
        )
        .join("\n"),
    );
    notify("Session log exported.");
  };
  const removeFile = () => {
    if (!lock.current) {
      setFirmware(null);
      setFileError("");
      setVerified(false);
      log("info", "HEX file removed from the workspace.");
    }
  };
  const browse = () => {
    if (!lock.current) {
      go("Programmer");
      fileInput.current?.click();
    }
  };
  return {
    page,
    go,
    dialog,
    open,
    board,
    boardId,
    target,
    device,
    port,
    ports,
    connected,
    verified,
    firmware,
    fileError,
    busy,
    progress,
    logs,
    serialLines,
    toast,
    setToast,
    prefs,
    setPrefs,
    guideStep,
    setGuideStep,
    consoleOpen,
    setConsoleOpen,
    connectionChoice,
    setConnectionChoice,
    fileInput,
    virtual,
    notify,
    log,
    chooseBoard,
    choosePort,
    chooseTarget,
    loadFile,
    example,
    refreshPorts,
    connect,
    disconnect,
    requestConnect,
    upload,
    program,
    monitor,
    reset,
    exportLogs,
    removeFile,
    browse,
    clearLogs: () => {
      setLogs([]);
      setDialog(null);
      notify("Activity log cleared.");
    },
    clearSerial: () => setSerialLines([]),
  };
}
export type Workbench = ReturnType<typeof useWorkbench>;
