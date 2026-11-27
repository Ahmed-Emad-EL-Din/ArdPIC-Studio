import { StrictMode, Component, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const panel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  height: "100%",
  minHeight: "100vh",
  padding: 32,
  background: "#111c30",
  color: "#f3f3f3",
  fontFamily:
    "DM Sans, system-ui, -apple-system, 'Segoe UI', sans-serif",
  textAlign: "center",
};

const button: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid #3b4a6b",
  background: "#1d2c4a",
  color: "#f3f3f3",
  fontSize: 14,
  cursor: "pointer",
};

const message: CSSProperties = {
  maxWidth: 560,
  fontSize: 12.5,
  color: "#aab6d3",
  background: "#0d1626",
  border: "1px solid #2a3a5c",
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

/**
 * Last-resort boundary. If anything throws while the workbench renders, the
 * user gets a readable failure panel with a reload action instead of an
 * empty white window.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("ArdPIC Studio renderer crashed:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={panel} role="alert">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          ArdPIC Studio could not start
        </h1>
        <p style={{ color: "#cdd6ee", maxWidth: 520, lineHeight: 1.5 }}>
          The interface stopped while loading. Your files and settings were not
          touched. Reload to try again; if the problem persists, reinstall
          ArdPIC Studio from the official archive.
        </p>
        <div style={message}>{String(error?.message || error)}</div>
        <button style={button} onClick={() => window.location.reload()}>
          Reload ArdPIC Studio
        </button>
      </div>
    );
  }
}

// Surface otherwise-silent failures instead of leaving a blank window.
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    console.error(
      "Unhandled error:",
      event.error instanceof Error ? event.error.message : event.message,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error(
      "Unhandled promise rejection:",
      event.reason instanceof Error ? event.reason.message : String(event.reason),
    );
  });
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("The application root element is missing from the page.");
}
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
