const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  Menu,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");

let win;
let hardware;
let setup;
let repairBusy = false;
let startupFailed = false;
const index = path.join(__dirname, "../dist/index.html");
const indexUrl = pathToFileURL(index).href;

// The workbench is a text UI with no WebGL or video; GPU compositing is not
// worth the failure class it adds on flaky Windows drivers and remote sessions.
app.disableHardwareAcceleration();

// Best-effort local diagnostics. Never throws; never leaves the app.
const rendererLogPath = () => {
  try {
    return path.join(app.getPath("userData"), "renderer.log");
  } catch {
    return null;
  }
};
function logRenderer(line) {
  try {
    const file = rendererLogPath();
    if (!file) return;
    const entry = `${new Date().toISOString()} ${line}\n`;
    const stat = fs.existsSync(file) ? fs.statSync(file) : null;
    if (stat && stat.size > 512 * 1024) fs.writeFileSync(file, entry);
    else fs.appendFileSync(file, entry);
  } catch {
    /* diagnostics must never break startup */
  }
}

// Only the main workbench frame may call hardware or setup actions.
function assertTrusted(event) {
  const frameUrl = event.senderFrame
    ? event.senderFrame.url.split("#", 1)[0]
    : "";
  if (
    !win ||
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame ||
    frameUrl !== indexUrl
  ) {
    throw new Error("Hardware controls are restricted to the local workbench.");
  }
}

app.setName("ArdPIC Studio");
app.setAppUserModelId("studio.ardpic.programmer");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win && win.isMinimized()) win.restore();
    if (win) win.focus();
  });

  app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(null);
      const { createHardwareService } = await import("./hardware.mjs");
      const { createSetupService } = await import("./setup.mjs");
      const backupDir = path.join(app.getPath("userData"), "backups");

      win = new BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 640,
        minHeight: 520,
        title: "ArdPIC Studio",
        backgroundColor: "#f3f3f3",
        show: false,
        icon: path.join(__dirname, "app.ico"),
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          webSecurity: true,
          devTools: false,
          webviewTag: false,
        },
      });

      const confirm = async (title, detail, action) =>
        (
          await dialog.showMessageBox(win, {
            type: "warning",
            title: "ArdPIC Studio",
            message: title,
            detail,
            buttons: ["Cancel", action],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          })
        ).response === 1;

      setup = createSetupService({
        userData: app.getPath("userData"),
        backupDir,
      });
      hardware = createHardwareService({
        backupDir,
        confirm,
        preflight: async () => {
          const report = await setup.check();
          if (!report.ready)
            throw new Error("System check failed. Resolve the required items in Setup before using hardware.");
        },
      });

      for (const method of [
        "ports",
        "connect",
        "disconnect",
        "upload",
        "program",
        "monitor",
      ]) {
        ipcMain.handle(`ardpic:${method}`, (event, request) => {
          assertTrusted(event);
          if (repairBusy) throw new Error("Wait for the component check to finish.");
          return hardware[method](request);
        });
      }
      ipcMain.handle("ardpic:setupCheck", (event) => {
        assertTrusted(event);
        return setup.check();
      });
      ipcMain.handle("ardpic:setupRepair", async (event, id) => {
        assertTrusted(event);
        if (id !== "components") {
          throw new Error("Unknown repair action.");
        }
        if (hardware.busy || repairBusy)
          throw new Error("Wait for the current operation to finish.");
        repairBusy = true;
        try {
          return await setup.repair(id);
        } finally {
          repairBusy = false;
        }
      });

      // Mirror renderer console output and crashes into a local log file so a
      // blank window is never silent again. No data leaves the machine.
      win.webContents.on("console-message", (...args) => {
        const first = args[0];
        const detail =
          first && typeof first === "object" && "message" in first
            ? first
            : { level: args[0], message: args[1], line: args[2], sourceId: args[3] };
        logRenderer(
          `console level=${detail.level} line=${detail.line ?? "-"} ${String(detail.message ?? "").slice(0, 500)}`,
        );
      });
      win.webContents.on("render-process-gone", (_event, details) => {
        logRenderer(`render-process-gone reason=${details?.reason} exitCode=${details?.exitCode}`);
        dialog.showErrorBox(
          "ArdPIC Studio stopped unexpectedly",
          `The interface crashed (${details?.reason ?? "unknown reason"}). Please restart the application. Diagnostic log: ${rendererLogPath() ?? "unavailable"}.`,
        );
        app.quit();
      });
      win.webContents.on("did-fail-load", (_event, errorCode, description, validatedURL, isMainFrame) => {
        if (!isMainFrame) return;
        startupFailed = true;
        logRenderer(`did-fail-load code=${errorCode} url=${validatedURL} ${description}`);
        dialog.showErrorBox(
          "ArdPIC Studio could not start",
          `The workbench failed to load (${errorCode}: ${description}). Reinstall the application from the official archive. Diagnostic log: ${rendererLogPath() ?? "unavailable"}.`,
        );
        app.quit();
      });
      win.webContents.setWindowOpenHandler(({ url }) => {
        const allowed = [
          "https://github.com/Ho-Ro/ArdPicProg",
          "https://github.com/Ho-Ro/QPICkit",
          "https://rweather.github.io/ardpicprog/",
          "https://rweather.github.io/ardpicprog/pic14_zif_circuit.html",
        ];
        if (allowed.includes(url)) void shell.openExternal(url);
        return { action: "deny" };
      });
      win.webContents.on("will-navigate", (e) => e.preventDefault());
      win.webContents.on("will-attach-webview", (e) => e.preventDefault());
      win.webContents.session.setPermissionRequestHandler(
        (_wc, _perm, callback) => callback(false),
      );
      win.on("close", (e) => {
        if (hardware.busy) {
          e.preventDefault();
          dialog.showErrorBox(
            "Operation in progress",
            "Wait for the current hardware operation to finish. Do not disconnect the programmer.",
          );
        }
      });
      win.once("ready-to-show", () => {
        win.show();
        logRenderer("window shown");
      });
      await win.loadFile(index);
      logRenderer("renderer document loaded");
    })
    .catch((error) => {
      logRenderer(`startup error: ${error && error.stack ? error.stack : String(error)}`);
      if (!startupFailed)
        dialog.showErrorBox("ArdPIC Studio could not start", String(error));
      app.quit();
    });

  app.on("window-all-closed", () => app.quit());
}
