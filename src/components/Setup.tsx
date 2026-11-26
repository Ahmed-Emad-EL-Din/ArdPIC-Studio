import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Download,
  Info,
  RefreshCw,
} from "lucide-react";
import type { SetupItem, SetupReport } from "../lib/types";

const browserReport: SetupReport = {
  checkedAt: new Date().toISOString(),
  supported: false,
  ready: false,
  items: [
    {
      id: "browser",
      label: "Desktop application",
      status: "info",
      detail:
        "This is the browser preview. Physical USB programming requires ArdPIC Studio.exe on Windows 64-bit. Validation and virtual sessions work here.",
      fix: null,
    },
  ],
};

const message = (error: unknown) =>
  error instanceof Error
    ? error.message.replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      )
    : "The check could not be completed.";

export function useSetup() {
  const [report, setReport] = useState<SetupReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    if (!window.ardpic) {
      setReport(browserReport);
      return;
    }
    setRunning(true);
    setError("");
    try {
      setReport(await window.ardpic.setupCheck());
    } catch (e) {
      setError(message(e));
    } finally {
      setRunning(false);
    }
  }, []);

  const repair = useCallback(async (id: string) => {
    if (!window.ardpic) return;
    setRunning(true);
    setError("");
    try {
      setReport(await window.ardpic.setupRepair(id));
    } catch (e) {
      setError(message(e));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { report, running, error, check, repair };
}

export type SetupState = ReturnType<typeof useSetup>;

const icons = {
  ok: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
};

const labels = {
  ok: "Passed",
  info: "Information",
  warning: "Needs attention",
  error: "Failed",
};

function Row({ item, setup }: { item: SetupItem; setup: SetupState }) {
  const Icon = icons[item.status];
  return (
    <div className={`check-item ${item.status}`}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <strong>{item.label}</strong>
        <p>{item.detail}</p>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <span
          className={`badge ${item.status === "ok" ? "ok" : item.status === "warning" ? "warn" : item.status === "error" ? "error" : ""}`}
        >
          {labels[item.status]}
        </span>
        {item.fix === "download" && (
          <button
            className="btn btn-sm"
            onClick={() => setup.repair("components")}
            disabled={setup.running}
          >
            <Download size={14} aria-hidden="true" />
            Download
          </button>
        )}
      </div>
    </div>
  );
}

export default function SetupPage({ setup }: { setup: SetupState }) {
  const report = setup.report;
  const groups = report
    ? [
        {
          title: "Required",
          items: report.items.filter(
            (i) =>
              ["platform", "runtime", "backup"].includes(i.id) ||
              i.id.startsWith("tool:") ||
              i.id.startsWith("firmware:"),
          ),
        },
        {
          title: "Connection",
          items: report.items.filter((i) => i.id === "serial"),
        },
        {
          title: "Optional",
          items: report.items.filter((i) => i.id === "components"),
        },
      ]
    : [];

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Status</h2>
            <p>
              {!report
                ? "Running checks."
                : !report.supported
                  ? "Browser preview. Desktop checks are not available here."
                  : report.ready
                    ? "All required items passed. You can connect a programmer."
                    : "One or more required items failed. Programming is blocked until they pass."}
            </p>
          </div>
          <button
            className="btn"
            onClick={() => void setup.check()}
            disabled={setup.running}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {setup.running ? "Checking" : "Check again"}
          </button>
        </div>
        {setup.error && (
          <div className="notice error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <div>{setup.error}</div>
          </div>
        )}
        {report && report.supported && (
          <p className="muted" style={{ fontSize: 12.5 }}>
            Last checked {new Date(report.checkedAt).toLocaleTimeString()}.
          </p>
        )}
      </section>

      {groups.map((group) =>
        group.items.length ? (
          <section className="card" key={group.title}>
            <h2>{group.title}</h2>
            <div>
              {group.items.map((item) => (
                <Row key={item.id} item={item} setup={setup} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      {report && report.supported && (
        <section className="card">
          <h2>About downloads</h2>
          <p className="muted">
            Everything the programmer needs is bundled and checked against its
            SHA-256 value at each start. Only optional components listed in the
            signed release manifest are downloaded, and only over HTTPS. A
            download is kept only after its checksum matches.
          </p>
          <p className="muted">
            Windows USB serial drivers need administrator approval and are
            installed by the board maker. This page reports whether the driver
            is working, but cannot install it silently.
          </p>
        </section>
      )}
    </div>
  );
}
