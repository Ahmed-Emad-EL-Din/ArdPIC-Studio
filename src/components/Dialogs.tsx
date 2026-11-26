import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { DEVICES } from "../lib/hex.mjs";
import type { Workbench } from "../lib/useWorkbench";
import { Logo, Notice, PortField, Toggle } from "./Controls";

function Modal({
  title,
  w,
  children,
  footer,
}: {
  title: string;
  w: Workbench;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    first.current?.focus();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!w.busy) w.open(null);
      }}
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          ref={first}
          className="btn btn-icon btn-ghost"
          aria-label="Close dialog"
          onClick={() => w.open(null)}
          disabled={!!w.busy}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {w.toast?.error && (
        <div className="dialog-error" role="alert">
          {w.toast.message}
        </div>
      )}
      {w.busy && (
        <div className="operation" role="status">
          <span>{w.busy}...</span>
          <div className="progress">
            <i
              style={{ width: w.progress ? `${w.progress}%` : undefined }}
              className={w.progress ? "" : "indeterminate"}
            />
          </div>
        </div>
      )}
      <div className="modal-foot">{footer}</div>
    </dialog>
  );
}

function Cancel({ w, label = "Cancel" }: { w: Workbench; label?: string }) {
  return (
    <button className="btn" disabled={!!w.busy} onClick={() => w.open(null)}>
      {label}
    </button>
  );
}

function CheckLine({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check-line">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

const guide = [
  {
    title: "Check the system",
    text: "Open System check. Every required item must pass before you connect a programmer.",
    page: "Setup" as const,
  },
  {
    title: "Install the programmer firmware",
    text: "In Firmware uploader, select the Arduino and its port, then upload ProgramPIC 1.8.horo. Disconnect any PIC first.",
    page: "Firmware uploader" as const,
  },
  {
    title: "Connect and load a file",
    text: "On the Programmer page, connect the verified programmer, choose the target microcontroller, and load a HEX file that passes validation.",
    page: "Programmer" as const,
  },
  {
    title: "Program and verify",
    text: "With power removed, insert the target in the correct orientation. Confirm the operation. The result is read back and compared before it is reported as successful.",
    page: "Programmer" as const,
  },
];

export default function Dialogs({ w }: { w: Workbench }) {
  const [ack, setAck] = useState(false);
  const [ack2, setAck2] = useState(false);
  const [typed, setTyped] = useState("");
  if (!w.dialog) return null;

  if (w.dialog === "connect") {
    const simulated = w.connectionChoice === "virtual";
    return (
      <Modal
        title="Connection manager"
        w={w}
        footer={
          <>
            <Cancel w={w} />
            {simulated ? (
              <button
                className="btn btn-primary"
                disabled={!!w.busy}
                onClick={() => w.connect(true, true)}
              >
                Connect virtual programmer
              </button>
            ) : window.ardpic ? (
              <button
                className="btn btn-primary"
                disabled={!w.port || w.virtual || !ack || !!w.busy}
                onClick={() => w.connect(false, ack)}
              >
                Verify USB programmer
              </button>
            ) : (
              <button className="btn btn-primary" disabled>
                Desktop application required
              </button>
            )}
          </>
        }
      >
        <div className="segmented" role="group" aria-label="Connection type">
          <button
            aria-pressed={!simulated}
            onClick={() => {
              w.setConnectionChoice("hardware");
              setAck(false);
            }}
            disabled={!!w.busy}
          >
            USB programmer
          </button>
          <button
            aria-pressed={simulated}
            onClick={() => {
              w.setConnectionChoice("virtual");
              setAck(false);
            }}
            disabled={!!w.busy}
          >
            Simulation
          </button>
        </div>
        {simulated ? (
          <>
            <p>
              A simulated programmer uses local memory only. No USB device is
              opened.
            </p>
            <dl className="info-list">
              <div>
                <dt>Arduino profile</dt>
                <dd>{w.board.name}</dd>
              </div>
              <div>
                <dt>Port</dt>
                <dd className="mono">VIRTUAL-01</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>{w.target}</dd>
              </div>
            </dl>
          </>
        ) : window.ardpic ? (
          <>
            <PortField w={w} prefix="connect-" />
            <Notice tone="warning">
              Connect only the Ho-Ro 1.8 circuit. The identity check resets the
              Arduino.
            </Notice>
            <CheckLine checked={ack} onChange={setAck}>
              The PIC is removed from the socket, and external programming
              voltage is disconnected.
            </CheckLine>
          </>
        ) : (
          <>
            <p>
              USB programming runs in the Windows desktop application. This
              browser preview cannot open serial ports.
            </p>
            <Notice>
              Download ArdPIC Studio for Windows, extract the full folder, and
              run ArdPIC Studio.exe.
            </Notice>
          </>
        )}
      </Modal>
    );
  }

  if (w.dialog === "program" || w.dialog === "upload") {
    const upload = w.dialog === "upload";
    const ready = ack && (w.virtual || upload || (ack2 && typed === w.target));
    return (
      <Modal
        title={upload ? "Upload firmware" : "Program target"}
        w={w}
        footer={
          <>
            <span className="hint">
              {w.virtual
                ? "Simulation only."
                : "This operation changes the device."}
            </span>
            <Cancel w={w} />
            <button
              className={`btn ${w.virtual || upload ? "btn-primary" : "btn-danger"}`}
              disabled={!ready || !!w.busy}
              onClick={() => (upload ? w.upload(ready) : w.program(ready))}
            >
              {upload
                ? "Upload and verify"
                : w.virtual
                  ? "Program virtual target"
                  : "Erase and program"}
            </button>
          </>
        }
      >
        <Notice tone={w.virtual ? "info" : "warning"}>
          {w.virtual
            ? "This is a simulation. It affects local memory only, not a physical device."
            : upload
              ? "This replaces the Arduino sketch. The bootloader and fuses are not changed."
              : "The target is erased and reprogrammed. A backup of its current contents is saved first."}
        </Notice>
        <dl className="info-list">
          <div>
            <dt>Arduino</dt>
            <dd>{w.board.name}</dd>
          </div>
          <div>
            <dt>Port</dt>
            <dd className="mono">{w.port}</dd>
          </div>
          {upload ? (
            <div>
              <dt>Firmware</dt>
              <dd>ProgramPIC 1.8.horo</dd>
            </div>
          ) : (
            <>
              <div>
                <dt>Target</dt>
                <dd>{w.target}</dd>
              </div>
              <div>
                <dt>HEX file</dt>
                <dd>
                  {w.firmware?.name} ({w.firmware?.size} bytes)
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Verification</dt>
            <dd>Full readback comparison</dd>
          </div>
        </dl>
        <CheckLine checked={ack} onChange={setAck}>
          {w.virtual
            ? "I understand this is a simulation."
            : upload
              ? "The correct board is connected and the PIC is removed."
              : "The PIC orientation, circuit, and measured supply voltages are correct for this device."}
        </CheckLine>
        {!w.virtual && !upload && (
          <>
            <CheckLine checked={ack2} onChange={setAck2}>
              I have an independent copy of the data I need to keep on this
              device.
            </CheckLine>
            <div className="field">
              <label htmlFor="confirm-target">Type {w.target} to confirm</label>
              <input
                className="input mono"
                id="confirm-target"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          </>
        )}
      </Modal>
    );
  }

  if (w.dialog === "settings") {
    return (
      <Modal
        title="Settings"
        w={w}
        footer={
          <>
            <span className="hint">Saved on this computer.</span>
            <Cancel w={w} label="Done" />
          </>
        }
      >
        <div className="field">
          <span className="label">Theme</span>
          <div className="segmented" role="group" aria-label="Theme">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                aria-pressed={w.prefs.theme === t}
                onClick={() => w.setPrefs((p) => ({ ...p, theme: t }))}
              >
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </div>
        <div>
          {(
            [
              [
                "timestamps",
                "Show timestamps",
                "Show the time of each activity entry.",
              ],
              [
                "autoScroll",
                "Follow new activity",
                "Keep the newest entry visible.",
              ],
              [
                "reducedMotion",
                "Reduce motion",
                "Turn off transitions in the interface.",
              ],
            ] as const
          ).map(([key, label, text]) => (
            <div className="setting" key={key}>
              <div>
                <strong>{label}</strong>
                <small>{text}</small>
              </div>
              <Toggle
                checked={w.prefs[key]}
                label={label}
                onChange={() => w.setPrefs((p) => ({ ...p, [key]: !p[key] }))}
              />
            </div>
          ))}
        </div>
        <Notice>Write protection cannot be turned off in settings.</Notice>
      </Modal>
    );
  }

  if (w.dialog === "guide") {
    const current = guide[w.guideStep];
    return (
      <Modal
        title="Quick guide"
        w={w}
        footer={
          <>
            <button
              className="btn"
              disabled={!w.guideStep}
              onClick={() => w.setGuideStep(w.guideStep - 1)}
            >
              Back
            </button>
            {w.guideStep < guide.length - 1 ? (
              <button
                className="btn btn-primary"
                onClick={() => w.setGuideStep(w.guideStep + 1)}
              >
                Next step
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => w.open(null)}>
                Finish guide
              </button>
            )}
          </>
        }
      >
        <p className="muted">
          Step {w.guideStep + 1} of {guide.length}
        </p>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <button
          className="btn btn-link"
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            w.go(current.page);
          }}
        >
          Go to this page
        </button>
      </Modal>
    );
  }

  if (w.dialog === "shortcuts") {
    return (
      <Modal
        title="Keyboard shortcuts"
        w={w}
        footer={<Cancel w={w} label="Close" />}
      >
        <dl className="info-list">
          {[
            ["New session", "Ctrl+N"],
            ["Open HEX file", "Ctrl+O"],
            ["Export activity log", "Ctrl+S"],
            ["Settings", "Ctrl+,"],
            ["Quick guide", "F1"],
            ["Close a menu or dialog", "Esc"],
          ].map(([text, key]) => (
            <div key={text}>
              <dt>{text}</dt>
              <dd className="mono">{key}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    );
  }

  if (w.dialog === "about") {
    return (
      <Modal
        title="About ArdPIC Studio"
        w={w}
        footer={<Cancel w={w} label="Close" />}
      >
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <Logo />
          <div>
            <h3>ArdPIC Studio 1.0.0</h3>
            <p className="muted">
              Arduino-based programmer for PIC microcontrollers
            </p>
          </div>
        </div>
        <dl className="info-list">
          <div>
            <dt>Made by</dt>
            <dd>Ahmed Emad El-Din Hussein</dd>
          </div>
          <div>
            <dt>Programmer firmware</dt>
            <dd>ProgramPIC 1.8.horo</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{window.ardpic ? "Windows desktop" : "Browser preview"}</dd>
          </div>
          <div>
            <dt>Supported targets</dt>
            <dd>{DEVICES.map((d) => d.name).join(", ")}</dd>
          </div>
        </dl>
        <div className="stack" style={{ gap: 6 }}>
          <a
            href="https://github.com/Ho-Ro/ArdPicProg"
            target="_blank"
            rel="noreferrer"
          >
            ArdPicProg (Ho-Ro/ArdPicProg)
          </a>
          <a
            href="https://github.com/Ho-Ro/QPICkit"
            target="_blank"
            rel="noreferrer"
          >
            QPICkit (Ho-Ro/QPICkit)
          </a>
          <a
            href="https://rweather.github.io/ardpicprog/"
            target="_blank"
            rel="noreferrer"
          >
            Original ArdPicProg documentation
          </a>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Firmware and host tools are distributed under GPL-3.0 by their
          authors. This release is not code-signed and has not been qualified on
          hardware.
        </p>
      </Modal>
    );
  }

  const clear = w.dialog === "clear";
  return (
    <Modal
      title={clear ? "Clear the activity log?" : "Start a new session?"}
      w={w}
      footer={
        <>
          <button
            className="btn btn-link"
            onClick={w.exportLogs}
            style={{ marginRight: "auto" }}
          >
            Export the log first
          </button>
          <Cancel w={w} />
          <button
            className="btn btn-primary"
            onClick={clear ? w.clearLogs : w.reset}
          >
            {clear ? "Clear log" : "Start new session"}
          </button>
        </>
      }
    >
      <p>
        {clear
          ? `This removes ${w.logs.length} events from the session. The connection and loaded file are not changed.`
          : "This disconnects the programmer and clears the loaded file and activity log. Settings are kept."}
      </p>
    </Modal>
  );
}
