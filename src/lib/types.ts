export type Page =
  | "Programmer"
  | "Firmware uploader"
  | "Device library"
  | "Setup"
  | "Serial monitor"
  | "Activity log"
  | "Wiring guide"
  | "Documentation";

export type DialogName =
  | "connect"
  | "settings"
  | "about"
  | "guide"
  | "shortcuts"
  | "program"
  | "upload"
  | "new"
  | "clear"
  | null;

export type LogLevel = "system" | "info" | "success" | "warning" | "error";

export type LogEntry = {
  id: string;
  time: string;
  level: LogLevel;
  message: string;
};

export type Firmware = {
  name: string;
  text: string;
  size: number;
  records: number;
};

export type Preferences = {
  theme: "light" | "dark";
  timestamps: boolean;
  autoScroll: boolean;
  reducedMotion: boolean;
};

export type HardwareRequest = {
  board: string;
  port: string;
  target: string;
  verifiedSetup: boolean;
};

export type SetupStatus = "ok" | "info" | "warning" | "error";

export type SetupItem = {
  id: string;
  label: string;
  status: SetupStatus;
  detail: string;
  fix: string | null;
};

export type SetupReport = {
  checkedAt: string;
  supported: boolean;
  ready: boolean;
  items: SetupItem[];
};

export type NativeBridge = {
  ports: () => Promise<string[]>;
  connect: (request: HardwareRequest) => Promise<string>;
  upload: (request: HardwareRequest) => Promise<string>;
  program: (
    request: HardwareRequest & { text: string; name: string },
  ) => Promise<string>;
  disconnect: () => Promise<void>;
  monitor: () => Promise<string>;
  setupCheck: () => Promise<SetupReport>;
  setupRepair: (id: string) => Promise<SetupReport>;
};

declare global {
  interface Window {
    ardpic?: NativeBridge;
  }
}
