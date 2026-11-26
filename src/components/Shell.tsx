import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Cable,
  CircuitBoard,
  Download,
  FilePlus2,
  FileCode2,
  FolderOpen,
  Info,
  Keyboard,
  Layers3,
  Menu,
  ScrollText,
  Settings2,
  Stethoscope,
  SquareTerminal,
  Upload,
  X,
  CircleHelp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Page, SetupReport } from "../lib/types";
import type { Workbench } from "../lib/useWorkbench";
import { Logo } from "./Controls";

const groups: { title: string; items: [Page, LucideIcon][] }[] = [
  {
    title: "Programming",
    items: [
      ["Programmer", CircuitBoard],
      ["Firmware uploader", Upload],
      ["Device library", Layers3],
    ],
  },
  {
    title: "Diagnostics",
    items: [
      ["Setup", Stethoscope],
      ["Serial monitor", SquareTerminal],
      ["Activity log", ScrollText],
    ],
  },
  {
    title: "Reference",
    items: [
      ["Wiring guide", Cable],
      ["Documentation", BookOpen],
    ],
  },
];

export function Sidebar({
  w,
  drawer,
  hidden,
  close,
}: {
  w: Workbench;
  drawer: boolean;
  hidden: boolean;
  close: () => void;
}) {
  const go = (page: Page) => {
    w.go(page);
    close();
  };
  return (
    <>
      {drawer && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <nav
        className={`nav ${drawer ? "open" : ""}`}
        aria-label="Main navigation"
        inert={hidden}
      >
        <div className="nav-brand">
          <Logo />
          <div>
            <strong>ArdPIC Studio</strong>
            <span>PIC programmer 1.0</span>
          </div>
        </div>
        {groups.map((group) => (
          <div className="nav-group" key={group.title}>
            <span className="nav-title">{group.title}</span>
            {group.items.map(([name, Icon]) => (
              <button
                key={name}
                className="nav-item"
                aria-current={w.page === name ? "page" : undefined}
                onClick={() => go(name)}
                disabled={!!w.busy}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="nav-foot">
          <button
            className="nav-item"
            onClick={() => {
              w.open("settings");
              close();
            }}
          >
            <Settings2 size={16} aria-hidden="true" />
            <span>Settings</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              w.open("about");
              close();
            }}
          >
            <Info size={16} aria-hidden="true" />
            <span>About ArdPIC</span>
          </button>
        </div>
      </nav>
    </>
  );
}

type MenuItem = {
  text: string;
  icon: LucideIcon;
  action: () => void;
  shortcut?: string;
  divider?: boolean;
};

export function MenuBar({
  w,
  toggleNav,
}: {
  w: Workbench;
  toggleNav: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menus: Record<string, MenuItem[]> = {
    File: [
      {
        text: "New session",
        icon: FilePlus2,
        action: () => w.open("new"),
        shortcut: "Ctrl+N",
      },
      {
        text: "Open HEX file...",
        icon: FolderOpen,
        action: w.browse,
        shortcut: "Ctrl+O",
      },
      { text: "Load example HEX", icon: FileCode2, action: w.example },
      {
        text: "Export activity log",
        icon: Download,
        action: w.exportLogs,
        shortcut: "Ctrl+S",
        divider: true,
      },
    ],
    View: [
      {
        text: "Programmer",
        icon: CircuitBoard,
        action: () => w.go("Programmer"),
      },
      {
        text: "Device library",
        icon: Layers3,
        action: () => w.go("Device library"),
      },
      {
        text: w.consoleOpen ? "Hide activity panel" : "Show activity panel",
        icon: SquareTerminal,
        action: () => {
          w.setConsoleOpen(!w.consoleOpen);
          w.go("Programmer");
        },
      },
      {
        text: "Show or hide navigation",
        icon: ScrollText,
        action: toggleNav,
        divider: true,
      },
    ],
    Tools: [
      {
        text: "Firmware uploader",
        icon: Upload,
        action: () => w.go("Firmware uploader"),
      },
      {
        text: "Connection manager",
        icon: Cable,
        action: () => w.open("connect"),
      },
      { text: "System check", icon: Stethoscope, action: () => w.go("Setup") },
      {
        text: "Serial monitor",
        icon: SquareTerminal,
        action: () => w.go("Serial monitor"),
      },
      {
        text: "Settings",
        icon: Settings2,
        action: () => w.open("settings"),
        shortcut: "Ctrl+,",
        divider: true,
      },
    ],
    Help: [
      {
        text: "Quick guide",
        icon: CircleHelp,
        action: () => {
          w.setGuideStep(0);
          w.open("guide");
        },
        shortcut: "F1",
      },
      { text: "Wiring guide", icon: Cable, action: () => w.go("Wiring guide") },
      {
        text: "Keyboard shortcuts",
        icon: Keyboard,
        action: () => w.open("shortcuts"),
      },
      {
        text: "About ArdPIC Studio",
        icon: Info,
        action: () => w.open("about"),
        divider: true,
      },
    ],
  };

  useEffect(() => {
    if (!active) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setActive(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [active]);

  return (
    <header className="menubar" ref={root}>
      <button
        className="btn btn-ghost btn-icon"
        onClick={toggleNav}
        aria-label="Toggle navigation"
        title="Show or hide navigation"
      >
        <Menu size={16} aria-hidden="true" />
      </button>
      <span className="app-name">ArdPIC Studio</span>
      {Object.entries(menus).map(([name, items]) => (
        <div className="menu-wrap" key={name}>
          <button
            className="menu-trigger"
            aria-haspopup="menu"
            aria-expanded={active === name}
            disabled={!!w.busy}
            onClick={() => setActive(active === name ? null : name)}
          >
            {name}
          </button>
          {active === name && (
            <div
              className="menu-pop"
              role="menu"
              aria-label={name}
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const buttons = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                );
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? buttons.length - 1
                      : (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          buttons.length) %
                        buttons.length;
                buttons[next]?.focus();
              }}
            >
              {items.map((item) => (
                <div key={item.text}>
                  {item.divider && <div className="divider" />}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setActive(null);
                      item.action();
                    }}
                  >
                    <item.icon size={15} aria-hidden="true" />
                    <span>{item.text}</span>
                    {item.shortcut && <kbd>{item.shortcut}</kbd>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <span className="menubar-right">Local workspace</span>
    </header>
  );
}

export function StatusBar({
  w,
  report,
}: {
  w: Workbench;
  report: SetupReport | null;
}) {
  const system = !report
    ? "System check running"
    : !report.supported
      ? "Browser preview"
      : report.ready
        ? "System check passed"
        : "System check needs attention";
  return (
    <footer className="statusbar">
      <span>{w.busy || "Ready"}</span>
      <span>
        {w.connected ? `Programmer on ${w.port}` : "No programmer connected"}
      </span>
      <div className="right">
        {w.virtual && <span>Simulation mode</span>}
        <span>Write protection on</span>
        <span>{system}</span>
      </div>
    </footer>
  );
}

const titles: Record<Page, [string, string]> = {
  Programmer: [
    "Programmer",
    "Connect an Arduino programmer, choose a target microcontroller, and program it from a validated Intel HEX file.",
  ],
  "Firmware uploader": [
    "Firmware uploader",
    "Install the ProgramPIC 1.8.horo programmer firmware on an Arduino Uno or Nano.",
  ],
  "Device library": [
    "Device library",
    "Microcontrollers supported by this release and their memory layout.",
  ],
  Setup: [
    "System check",
    "Checks run automatically when the application starts. Resolve any item marked as needing attention.",
  ],
  "Serial monitor": [
    "Serial monitor",
    "Read-only information from the connected programmer.",
  ],
  "Activity log": [
    "Activity log",
    "Events from the current session. Export the log to keep a record of each operation.",
  ],
  "Wiring guide": [
    "Wiring guide",
    "Confirm the circuit and pin assignments before connecting a target.",
  ],
  Documentation: [
    "Documentation",
    "Procedures, limits, and troubleshooting for this release.",
  ],
};

export function PageHeading({ w }: { w: Workbench }) {
  const [title, description] = titles[w.page];
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <button
        className="btn"
        onClick={() => {
          w.setGuideStep(0);
          w.open("guide");
        }}
      >
        <BookOpen size={15} aria-hidden="true" />
        Quick guide
      </button>
    </div>
  );
}

export function Toast({ w }: { w: Workbench }) {
  if (!w.toast) return null;
  return (
    <div
      className={`toast ${w.toast.error ? "error" : ""}`}
      role="status"
      key={w.toast.key}
    >
      <span>{w.toast.message}</span>
      <button
        aria-label="Dismiss notification"
        onClick={() => w.setToast(null)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
