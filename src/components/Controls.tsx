import { AlertTriangle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import type { ReactNode } from "react";
import { BOARDS, DEVICES } from "../lib/hex.mjs";
import type { Workbench } from "../lib/useWorkbench";

export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      PIC
    </span>
  );
}

export function SelectBox({
  id,
  value,
  onChange,
  children,
  disabled = false,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="select">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </div>
  );
}

export function BoardField({
  w,
  prefix = "",
}: {
  w: Workbench;
  prefix?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`${prefix}board`}>Arduino board</label>
      <SelectBox
        id={`${prefix}board`}
        value={w.boardId}
        onChange={w.chooseBoard}
        disabled={!!w.busy}
      >
        {BOARDS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectBox>
      <span className="hint">{w.board.description}</span>
    </div>
  );
}

export function PortField({
  w,
  prefix = "",
}: {
  w: Workbench;
  prefix?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`${prefix}port`}>Serial port</label>
      <div className="port-row">
        <SelectBox
          id={`${prefix}port`}
          value={w.port}
          onChange={w.choosePort}
          disabled={!!w.busy}
        >
          <option value="">Select a port</option>
          {w.ports.map((p) => (
            <option key={p}>{p}</option>
          ))}
          <option value="VIRTUAL-01">Virtual port (simulation)</option>
        </SelectBox>
        <button
          className="btn btn-icon"
          onClick={w.refreshPorts}
          aria-label="Refresh serial ports"
          title="Refresh serial ports"
          disabled={!!w.busy}
        >
          <span aria-hidden="true">&#x21bb;</span>
        </button>
      </div>
      {w.ports.length === 0 && (
        <span className="hint">
          No hardware port detected. CH340-based Arduino clones need the WCH
          CH341SER USB serial driver; install it, replug the board, then
          refresh. See System check for details.
        </span>
      )}
    </div>
  );
}

export function TargetField({ w }: { w: Workbench }) {
  return (
    <div className="field">
      <label htmlFor="target">Target microcontroller</label>
      <SelectBox
        id="target"
        value={w.target}
        onChange={w.chooseTarget}
        disabled={!!w.busy}
      >
        {DEVICES.map((d) => (
          <option key={d.name}>{d.name}</option>
        ))}
      </SelectBox>
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success" | "error";
}) {
  const Icon =
    tone === "warning" || tone === "error"
      ? AlertTriangle
      : tone === "success"
        ? CheckCircle2
        : Info;
  return (
    <div className={`notice ${tone}`}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={onChange}
    />
  );
}
