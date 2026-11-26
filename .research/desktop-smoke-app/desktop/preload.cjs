const { contextBridge, ipcRenderer } = require("electron");

const methods = [
  "ports",
  "connect",
  "disconnect",
  "upload",
  "program",
  "monitor",
  "setupCheck",
  "setupRepair",
];

contextBridge.exposeInMainWorld(
  "ardpic",
  Object.fromEntries(
    methods.map((method) => [
      method,
      (request) => ipcRenderer.invoke(`ardpic:${method}`, request),
    ]),
  ),
);
