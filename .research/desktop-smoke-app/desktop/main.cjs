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

let win;
let hardware;
let setup;
let repairBusy = false;
const index = path.join(__dirname, "../dist/index.html");
const indexUrl = pathToFileURL(index).href;

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
      win.once("ready-to-show", () => win.show());
      await win.loadFile(index);
    })
    .catch((error) => {
      dialog.showErrorBox("ArdPIC Studio could not start", String(error));
      app.quit();
    });

  app.on("window-all-closed", () => app.quit());
}
