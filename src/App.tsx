import { useEffect, useState } from "react";
import { useWorkbench } from "./lib/useWorkbench";
import {
  MenuBar,
  PageHeading,
  Sidebar,
  StatusBar,
  Toast,
} from "./components/Shell";
import Programmer from "./components/Programmer";
import {
  ActivityLog,
  DeviceLibrary,
  Documentation,
  FirmwareUploader,
  SerialMonitor,
  WiringGuide,
} from "./components/Modules";
import SetupPage, { useSetup } from "./components/Setup";
import Dialogs from "./components/Dialogs";

function useNarrow() {
  const query = "(max-width: 820px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

export default function App() {
  const w = useWorkbench();
  const setup = useSetup();
  const narrow = useNarrow();
  const [drawer, setDrawer] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!narrow) setDrawer(false);
  }, [narrow]);

  const toggleNav = () => {
    if (narrow) setDrawer((open) => !open);
    else setHidden((value) => !value);
  };

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
      if (w.busy || w.dialog) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && ["o", "n", "s", ","].includes(key)) {
        e.preventDefault();
        if (key === "o") w.browse();
        if (key === "n") w.open("new");
        if (key === "s") w.exportLogs();
        if (key === ",") w.open("settings");
      } else if (e.key === "F1") {
        e.preventDefault();
        w.setGuideStep(0);
        w.open("guide");
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [w]);

  const page =
    w.page === "Programmer" ? (
      <Programmer w={w} />
    ) : w.page === "Firmware uploader" ? (
      <FirmwareUploader w={w} />
    ) : w.page === "Device library" ? (
      <DeviceLibrary w={w} />
    ) : w.page === "Setup" ? (
      <SetupPage setup={setup} />
    ) : w.page === "Serial monitor" ? (
      <SerialMonitor w={w} />
    ) : w.page === "Activity log" ? (
      <ActivityLog w={w} />
    ) : w.page === "Wiring guide" ? (
      <WiringGuide />
    ) : (
      <Documentation w={w} />
    );

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <MenuBar w={w} toggleNav={toggleNav} />
      <div className="body">
        <Sidebar
          w={w}
          drawer={drawer}
          hidden={!narrow && hidden}
          close={() => setDrawer(false)}
        />
        <main id="main" className="main" tabIndex={-1}>
          <div className="content">
            <PageHeading w={w} />
            <div className="page-enter" key={w.page}>
              {page}
            </div>
          </div>
        </main>
      </div>
      <StatusBar w={w} report={setup.report} />
      <input
        ref={w.fileInput}
        type="file"
        accept=".hex"
        aria-label="Open Intel HEX file"
        hidden
        onChange={(e) => {
          void w.loadFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {w.dialog && <Dialogs key={w.dialog} w={w} />}
      <Toast w={w} />
    </div>
  );
}
