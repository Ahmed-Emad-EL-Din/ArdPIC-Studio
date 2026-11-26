import { useState } from "react";
import {
  ArrowRight,
  Download,
  Search,
  ScrollText,
  Trash2,
  Upload,
} from "lucide-react";
import { DEVICES } from "../lib/hex.mjs";
import { downloadText, formatTime, type Workbench } from "../lib/useWorkbench";
import { BoardField, Notice, PortField, SelectBox } from "./Controls";
import { Console } from "./Programmer";
import schematic from "../../desktop/vendor/Ho-Ro-circuit.png";

export function FirmwareUploader({ w }: { w: Workbench }) {
  return (
    <div className="stack">
      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Upload firmware</h2>
              <p>
                Writes ProgramPIC 1.8.horo to the Arduino flash memory.
                Bootloader and fuses are not changed.
              </p>
            </div>
          </div>
          <BoardField w={w} prefix="upload-" />
          <PortField w={w} prefix="upload-" />
          <div className="card-foot">
            <span className="hint">
              Remove any PIC from the programmer socket first.
            </span>
            <button
              className="btn btn-primary"
              disabled={!!w.busy}
              onClick={() => {
                if (!w.port) {
                  w.notify(
                    "Select a serial port, or choose the virtual port to test the workflow.",
                    true,
                  );
                  document.getElementById("upload-port")?.focus();
                } else {
                  w.open("upload");
                }
              }}
            >
              <Upload size={15} aria-hidden="true" />
              Upload firmware
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Before you upload</h2>
          <ol
            className="stack"
            style={{ gap: 10, paddingLeft: 20, margin: 0, fontSize: 13.5 }}
          >
            <li>
              Use a classic 5 V Arduino Uno R3 or Nano with an ATmega328P. Uno
              R4 and 3.3 V boards are not supported.
            </li>
            <li>
              Use the Ho-Ro 1.8 interface circuit. The original rweather shield
              uses different pins and is not compatible with this firmware.
            </li>
            <li>
              After upload, the Connect step verifies the exact firmware version
              before any write is possible.
            </li>
          </ol>
          <div className="card-foot">
            <button
              className="btn btn-link"
              onClick={() => w.go("Wiring guide")}
            >
              Open the wiring guide <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
      <Console w={w} />
    </div>
  );
}

export function DeviceLibrary({ w }: { w: Workbench }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const devices = DEVICES.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) &&
      (family === "all" || d.name.startsWith(family)),
  );
  return (
    <div className="stack">
      <div className="row">
        <label className="search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            placeholder="Search by part number"
            aria-label="Search microcontrollers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <SelectBox
          id="family"
          value={family}
          onChange={setFamily}
          label="Device family"
        >
          <option value="all">All families</option>
          <option value="PIC16">PIC16</option>
          <option value="PIC12">PIC12</option>
        </SelectBox>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Part number</th>
              <th>Program memory</th>
              <th>EEPROM</th>
              <th>Package</th>
              <th>Device ID</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.name}>
                <td>
                  <strong>{d.name}</strong>
                </td>
                <td>{d.words / 1024}K words</td>
                <td>{d.eeprom} bytes</td>
                <td>{d.pins}-pin DIP</td>
                <td className="mono">{d.id}</td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-sm"
                    disabled={!!w.busy}
                    onClick={() => {
                      w.chooseTarget(d.name);
                      w.go("Programmer");
                      w.notify(`${d.name} selected as the target.`);
                    }}
                  >
                    {w.target === d.name ? "Selected" : "Use as target"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!devices.length && (
          <div className="empty">
            <p>No device matches this search.</p>
            <button
              className="btn btn-link"
              onClick={() => {
                setQuery("");
                setFamily("all");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <Notice>
        A device profile describes memory layout only. Check the adapter and the
        device datasheet before connecting a part.
      </Notice>
    </div>
  );
}

export function SerialMonitor({ w }: { w: Workbench }) {
  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Programmer identity</h2>
            <p>
              {w.connected
                ? `Connected on ${w.port}${w.virtual ? " (simulation)" : ""}.`
                : "Connect a programmer to read its identity."}
            </p>
          </div>
          <span className={`badge ${w.connected ? "ok" : ""}`}>
            {w.connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={w.monitor}
            disabled={!!w.busy}
          >
            {w.connected ? "Query identity" : "Connect programmer"}
          </button>
          <button
            className="btn"
            onClick={() =>
              downloadText("ardpic-serial.log", w.serialLines.join("\n"))
            }
            disabled={!w.serialLines.length}
          >
            <Download size={14} aria-hidden="true" />
            Export output
          </button>
          <button
            className="btn btn-ghost"
            onClick={w.clearSerial}
            disabled={!w.serialLines.length}
          >
            Clear
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Output</h2>
        <div
          className="log"
          role="log"
          aria-label="Programmer output"
          style={{ maxHeight: 360 }}
        >
          {w.serialLines.length ? (
            w.serialLines.map((line, i) => (
              <div className="log-line" key={i}>
                <span className="mono" style={{ whiteSpace: "pre-wrap" }}>
                  {line}
                </span>
              </div>
            ))
          ) : (
            <div className="log-line">
              <span className="muted">No output yet.</span>
            </div>
          )}
        </div>
        <Notice>
          Only identity queries are available. Free-form commands are disabled,
          so no command can change voltages or erase memory.
        </Notice>
      </section>
    </div>
  );
}

export function ActivityLog({ w }: { w: Workbench }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const shown = w.logs.filter(
    (l) =>
      (level === "all" || level === l.level) &&
      l.message.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="stack">
      <div className="row">
        <label className="search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            aria-label="Search events"
            placeholder="Search events"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <SelectBox
          id="severity"
          value={level}
          onChange={setLevel}
          label="Event level"
        >
          <option value="all">All levels</option>
          {["system", "info", "success", "warning", "error"].map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </SelectBox>
        <button className="btn" onClick={w.exportLogs}>
          <Download size={14} aria-hidden="true" />
          Export
        </button>
        <button
          className="btn btn-icon"
          aria-label="Clear activity log"
          onClick={() => w.open("clear")}
          disabled={!w.logs.length}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Time</th>
              <th>Level</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td className="mono">{formatTime(l.time)}</td>
                <td>{l.level[0].toUpperCase() + l.level.slice(1)}</td>
                <td>{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && (
          <div className="empty">
            <ScrollText size={22} aria-hidden="true" />
            <p>
              {w.logs.length
                ? "No events match this filter."
                : "The log is empty."}
            </p>
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Showing {shown.length} of {w.logs.length} events in this session.
      </p>
    </div>
  );
}

const checklist = [
  [
    "Match the circuit revision",
    "Use the Ho-Ro 1.8 interface with ProgramPIC 1.8.horo. The original ZIF shield has different pins and VPP polarity.",
  ],
  [
    "Inspect with power disconnected",
    "Check socket orientation, adapter, ground continuity, and shorts. Never connect programming voltage to an Arduino pin.",
  ],
  [
    "Measure both supply rails",
    "With the target removed, measure VDD and VPP against the device programming specification. The application cannot measure voltage.",
  ],
  [
    "Verify the programmer first",
    "Connect the programmer before inserting a target. Insert the target only with power removed.",
  ],
];

export function WiringGuide() {
  const [tab, setTab] = useState("Checklist");
  const [checked, setChecked] = useState<number[]>([]);
  return (
    <div className="stack">
      <Notice tone="warning">
        The Ho-Ro and rweather circuits are not interchangeable. Confirm which
        circuit you have before you connect anything.
      </Notice>
      <div className="tabs" role="tablist">
        {["Checklist", "Pin reference", "Schematic"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Checklist" && (
        <section className="card">
          <p className="muted">
            Review each item with the circuit on your bench. These are your own
            inspection notes. They do not certify the hardware.
          </p>
          {checklist.map(([title, detail], i) => (
            <label
              className="check-line"
              key={title}
              style={{
                padding: "10px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              <input
                type="checkbox"
                checked={checked.includes(i)}
                onChange={() =>
                  setChecked((old) =>
                    old.includes(i) ? old.filter((n) => n !== i) : [...old, i],
                  )
                }
              />
              <span>
                <strong>{title}</strong>
                <br />
                <span className="muted">{detail}</span>
              </span>
            </label>
          ))}
          <p className="muted" style={{ fontSize: 13 }}>
            {checked.length} of {checklist.length} items reviewed.
          </p>
        </section>
      )}
      {tab === "Pin reference" && (
        <div className="table-wrap">
          <table className="data pin-table">
            <thead>
              <tr>
                <th>Arduino pin</th>
                <th>Signal</th>
                <th>Function</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["D2", "VDD", "Target supply control"],
                [
                  "D3",
                  "VPP / MCLR",
                  "High-voltage switch control, active high",
                ],
                ["D4", "PGC", "Programming clock"],
                ["D5", "PGD", "Programming data, bidirectional"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "Schematic" && (
        <section className="card">
          <div className="schematic">
            <img
              src={schematic}
              alt="Official Ho-Ro ArdPicProg 1.8 circuit schematic"
            />
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Schematic from the Ho-Ro ArdPicProg project, revision 420aace.
          </p>
        </section>
      )}
      <div className="row">
        <a
          href="https://github.com/Ho-Ro/ArdPicProg"
          target="_blank"
          rel="noreferrer"
        >
          ArdPicProg project
        </a>
        <a
          href="https://rweather.github.io/ardpicprog/pic14_zif_circuit.html"
          target="_blank"
          rel="noreferrer"
        >
          Original ZIF circuit
        </a>
      </div>
    </div>
  );
}

const articles = [
  {
    title: "Getting started",
    body: "Open System check and confirm every required item passes. Then go to Programmer, choose your Arduino and its serial port, and connect. The connection step verifies the firmware before any write is possible.",
  },
  {
    title: "Try a simulated session",
    body: "Select Virtual port (simulation) and connect. Load the example HEX file and program the virtual target. Simulated writes change only local memory. A simulation does not test real hardware.",
  },
  {
    title: "Accepted HEX files",
    body: "Use Intel HEX with 16-bit little-endian PIC words, aligned addresses, and valid checksums. Records must stay within the program or EEPROM memory of the selected device. Configuration words, device IDs, and calibration are never written by this application.",
  },
  {
    title: "Writing a target",
    body: "Program target first checks the device identity, reads the existing memory, and saves a backup. It then asks for a second confirmation before erasing. After writing, every byte is read back and compared. A mismatch is reported as a failure.",
  },
  {
    title: "If an operation fails",
    body: "Remove power, inspect the wiring and the target, then reconnect. Do not disconnect the programmer while an operation is running. The activity log records each step.",
  },
];

export function Documentation({ w }: { w: Workbench }) {
  const [expanded, setExpanded] = useState(0);
  const [query, setQuery] = useState("");
  const filtered = articles
    .map((a, i) => ({ ...a, i }))
    .filter((a) =>
      (a.title + a.body).toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <div className="stack">
      <label className="search" style={{ maxWidth: 420 }}>
        <Search size={15} aria-hidden="true" />
        <input
          className="input"
          placeholder="Search documentation"
          aria-label="Search documentation"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="table-wrap accordion">
        {filtered.map((a) => (
          <section key={a.title}>
            <button
              aria-expanded={expanded === a.i}
              onClick={() => setExpanded(expanded === a.i ? -1 : a.i)}
            >
              {a.title}
              <span className="muted" aria-hidden="true">
                {expanded === a.i ? "-" : "+"}
              </span>
            </button>
            {expanded === a.i && (
              <div className="body-text">
                <p>{a.body}</p>
                {a.i === 1 && (
                  <button
                    className="btn"
                    onClick={() => {
                      w.choosePort("VIRTUAL-01");
                      w.example();
                      w.open("connect");
                    }}
                  >
                    Start a simulated session
                  </button>
                )}
                {a.i === 0 && (
                  <button className="btn" onClick={() => w.go("Setup")}>
                    Open System check
                  </button>
                )}
              </div>
            )}
          </section>
        ))}
        {!filtered.length && (
          <div className="empty">
            <p>No articles match this search.</p>
            <button className="btn btn-link" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
