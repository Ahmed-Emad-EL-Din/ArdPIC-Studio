import { useEffect, useRef, useState } from "react";
import { FileCode2, Plug, Unplug, X } from "lucide-react";
import type { Workbench } from "../lib/useWorkbench";
import { formatTime } from "../lib/useWorkbench";
import { BoardField, PortField, TargetField } from "./Controls";

const levelText: Record<string, string> = {
  system: "System",
  info: "Info",
  success: "OK",
  warning: "Warning",
  error: "Error",
};

export function Console({ w }: { w: Workbench }) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (w.prefs.autoScroll && scroll.current) {
      scroll.current.scrollTop = scroll.current.scrollHeight;
    }
  }, [w.logs, w.prefs.autoScroll, w.consoleOpen]);

  return (
    <section className="card" aria-labelledby="activity-title">
      <div className="card-head">
        <div>
          <h2 id="activity-title">Activity</h2>
          <p>Every step, check, and result for this session.</p>
        </div>
        <div className="row">
          <button
            className="btn btn-sm"
            onClick={() => w.setConsoleOpen(!w.consoleOpen)}
            aria-expanded={w.consoleOpen}
          >
            {w.consoleOpen ? "Hide" : "Show"}
          </button>
          <button
            className="btn btn-sm"
            onClick={() => w.open("clear")}
            disabled={!w.logs.length || !!w.busy}
          >
            Clear
          </button>
        </div>
      </div>
      {w.consoleOpen && (
        <div className="log" ref={scroll} role="log" aria-label="Activity log">
          {w.logs.length ? (
            w.logs.map((l) => (
              <div className="log-line" key={l.id}>
                {w.prefs.timestamps && <time>{formatTime(l.time)}</time>}
                <span className={`log-level ${l.level}`}>
                  {levelText[l.level]}
                </span>
                <span>{l.message}</span>
              </div>
            ))
          ) : (
            <div className="log-line">
              <span className="muted">The log is empty.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function HexField({ w }: { w: Workbench }) {
  const [drag, setDrag] = useState(false);
  return (
    <div className="field" role="group" aria-labelledby="hex-label">
      <span className="label" id="hex-label">
        HEX file
      </span>
      {w.firmware ? (
        <div className="file-row">
          <FileCode2 size={20} aria-hidden="true" />
          <div>
            <strong>{w.firmware.name}</strong>
            <span>
              {w.firmware.size} bytes, {w.firmware.records} data records,
              checked for {w.target}
            </span>
          </div>
          <button
            className="btn btn-sm"
            onClick={w.browse}
            disabled={!!w.busy}
            aria-label="Replace HEX file"
          >
            Replace
          </button>
          <button
            className="btn btn-icon btn-ghost"
            onClick={w.removeFile}
            disabled={!!w.busy}
            aria-label="Remove HEX file"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div
          className={`dropzone ${drag ? "drag" : ""} ${w.fileError ? "invalid" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!w.busy) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void w.loadFile(e.dataTransfer.files[0]);
          }}
        >
          <span>Drop an Intel HEX file (.hex) here, or choose one.</span>
          <button
            className="btn btn-sm"
            onClick={w.browse}
            disabled={!!w.busy}
            aria-label="Choose HEX file"
          >
            Choose file
          </button>
        </div>
      )}
      {w.fileError && (
        <div className="field-error" role="alert">
          {w.fileError}
        </div>
      )}
    </div>
  );
}

export default function Programmer({ w }: { w: Workbench }) {
  const programmerBadge = w.connected
    ? w.virtual
      ? { text: "Simulated", tone: "accent" }
      : { text: "Verified", tone: "ok" }
    : { text: "Not connected", tone: "" };

  const targetBadge = w.verified
    ? { text: "Written and verified", tone: "ok" }
    : w.firmware
      ? { text: "Ready to program", tone: "accent" }
      : { text: "No file loaded", tone: "" };

  const blockers: string[] = [];
  if (!w.connected) blockers.push("Connect and verify the programmer.");
  if (!w.firmware) blockers.push("Load a HEX file that passes validation.");
  const last = [...w.logs]
    .reverse()
    .find((l) => l.level === "success" || l.level === "error");

  return (
    <div className="stack">
      <div className="grid-2">
        <section className="card" aria-labelledby="programmer-title">
          <div className="card-head">
            <div>
              <h2 id="programmer-title">Programmer</h2>
              <p>An Arduino Uno or Nano running ProgramPIC 1.8.horo.</p>
            </div>
            <span className={`badge ${programmerBadge.tone}`}>
              {programmerBadge.text}
            </span>
          </div>
          <BoardField w={w} />
          <PortField w={w} />
          <div className="card-foot">
            <button
              className={`btn ${w.connected ? "" : "btn-primary"}`}
              onClick={w.requestConnect}
              disabled={!!w.busy}
            >
              {w.connected ? (
                <Unplug size={15} aria-hidden="true" />
              ) : (
                <Plug size={15} aria-hidden="true" />
              )}
              {w.connected ? "Disconnect programmer" : "Connect programmer"}
            </button>
            <button
              className="btn btn-link"
              onClick={() => w.go("Firmware uploader")}
            >
              Install firmware on an Arduino
            </button>
          </div>
        </section>

        <section className="card" aria-labelledby="target-title">
          <div className="card-head">
            <div>
              <h2 id="target-title">Target</h2>
              <p>The microcontroller in the socket and the file to write.</p>
            </div>
            <span className={`badge ${targetBadge.tone}`}>
              {targetBadge.text}
            </span>
          </div>
          <TargetField w={w} />
          <HexField w={w} />
          <div className="card-foot">
            {blockers.length > 0 ? (
              <span className="hint">{blockers.join(" ")}</span>
            ) : (
              <span className="hint">Review the summary before you write.</span>
            )}
            <button
              className="btn btn-primary"
              disabled={!w.connected || !w.firmware || !!w.busy}
              onClick={() => w.open("program")}
            >
              Program target
            </button>
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="summary-title">
        <div className="card-head">
          <h2 id="summary-title">Summary</h2>
        </div>
        <dl className="kv">
          <dt>Arduino board</dt>
          <dd>{w.board.name}</dd>
          <dt>Serial port</dt>
          <dd>{w.port || "Not selected"}</dd>
          <dt>Target</dt>
          <dd>{w.target}</dd>
          <dt>HEX file</dt>
          <dd>
            {w.firmware
              ? `${w.firmware.name} (${w.firmware.size} bytes)`
              : "None"}
          </dd>
          <dt>Last result</dt>
          <dd>{last ? last.message : "No operations yet."}</dd>
        </dl>
      </section>

      <Console w={w} />
    </div>
  );
}
