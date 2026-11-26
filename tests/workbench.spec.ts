import { expect, test, type Page } from "@playwright/test";
import { SAMPLE_HEX } from "../src/lib/hex.mjs";

const button = (p: Page, name: string) =>
  p.getByRole("button", { name, exact: true });

async function example(p: Page) {
  await button(p, "File").click();
  await p.getByRole("menuitem", { name: "Load example HEX" }).click();
}

async function connect(p: Page) {
  await button(p, "Connect programmer").click();
  await button(p, "Connect virtual programmer").click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Programmer",
  );
});

test("initial workspace is disconnected and writing is locked", async ({
  page,
}) => {
  await expect(button(page, "Program target")).toBeDisabled();
  await expect(
    page.getByText("Not connected", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Arduino board", { exact: true })).toHaveValue(
    "uno",
  );
});

test("complete virtual write requires confirmation and verifies its readback", async ({
  page,
}) => {
  await example(page);
  await expect(button(page, "Program target")).toBeDisabled();
  await connect(page);
  await button(page, "Program target").click();
  await expect(button(page, "Program virtual target")).toBeDisabled();
  await page.getByRole("checkbox").check();
  await button(page, "Program virtual target").click();
  await expect(
    page.getByText("Written and verified", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("log", { name: "Activity log" })).toContainText(
    "Readback verification passed.",
  );
});

test("changing the board invalidates a verified programmer", async ({
  page,
}) => {
  await connect(page);
  await example(page);
  await expect(button(page, "Program target")).toBeEnabled();
  await page.getByLabel("Arduino board", { exact: true }).selectOption("nano");
  await expect(button(page, "Program target")).toBeDisabled();
  await expect(button(page, "Connect programmer")).toBeVisible();
});

test("changing the target releases the loaded file", async ({ page }) => {
  await example(page);
  await page.getByLabel("Target microcontroller").selectOption("PIC16F628A");
  await expect(page.getByText("safe-loop.hex", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "Reload a HEX file built for PIC16F628A",
  );
});

test("a bad checksum clears any previously valid file and locks writes", async ({
  page,
}) => {
  await connect(page);
  await example(page);
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.hex",
    mimeType: "text/plain",
    buffer: Buffer.from(SAMPLE_HEX.replace("D0", "D1")),
  });
  await expect(page.getByRole("alert")).toContainText("checksum mismatch");
  await expect(button(page, "Program target")).toBeDisabled();
  await expect(button(page, "Remove HEX file")).toHaveCount(0);
});

test("file selection accepts a valid HEX and rejects reserved memory", async ({
  page,
}) => {
  const input = page.locator("input[type=file]");
  await input.setInputFiles({
    name: "program.hex",
    mimeType: "text/plain",
    buffer: Buffer.from(SAMPLE_HEX),
  });
  await expect(page.getByText("program.hex", { exact: true })).toBeVisible();
  await input.setInputFiles({
    name: "reserved.hex",
    mimeType: "text/plain",
    buffer: Buffer.from(":02400E000000B0\n:00000001FF\n"),
  });
  await expect(page.getByRole("alert")).toContainText("reserved");
});

test("device search selects a target profile", async ({ page }) => {
  await button(page, "Device library").click();
  await page.getByLabel("Search microcontrollers").fill("675");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await button(page, "Use as target").click();
  await expect(page.getByLabel("Target microcontroller")).toHaveValue(
    "PIC12F675",
  );
});

test("firmware uploader works in the simulation and the monitor reads identity", async ({
  page,
}) => {
  await button(page, "Firmware uploader").click();
  await page.getByLabel("Arduino board").selectOption("nano-old");
  await page
    .getByLabel("Serial port", { exact: true })
    .selectOption("VIRTUAL-01");
  await button(page, "Upload firmware").click();
  await expect(button(page, "Upload and verify")).toBeDisabled();
  await page.getByRole("checkbox").check();
  await button(page, "Upload and verify").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("log", { name: "Activity log" })).toContainText(
    "firmware uploaded and verified",
  );
  await button(page, "Serial monitor").click();
  await button(page, "Query identity").click();
  await expect(
    page.getByRole("log", { name: "Programmer output" }),
  ).toContainText("ProgramPIC 1.8.horo");
});

test("activity log is searchable, exportable, and cleared only after confirmation", async ({
  page,
}) => {
  await button(page, "Activity log").click();
  await page.getByLabel("Search events").fill("Waiting");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await button(page, "Export").click();
  expect((await download).suggestedFilename()).toMatch(/\.log$/);
  await button(page, "Clear activity log").click();
  await button(page, "Cancel").click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await button(page, "Clear activity log").click();
  await button(page, "Clear log").click();
  await expect(page.getByText("The log is empty.")).toBeVisible();
});

test("settings survive a reload, while the connection does not", async ({
  page,
}) => {
  await connect(page);
  await page.keyboard.press("Control+,");
  await button(page, "Dark").click();
  await page.getByRole("switch", { name: "Show timestamps" }).click();
  await button(page, "Done").click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".log-line time")).toHaveCount(0);
  await expect(button(page, "Connect programmer")).toBeVisible();
});

test("guide, wiring checklist, documentation, and author credit", async ({
  page,
}) => {
  await page.keyboard.press("F1");
  await expect(
    page.getByRole("heading", { name: "Check the system", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) await button(page, "Next step").click();
  await button(page, "Finish guide").click();
  await button(page, "Wiring guide").click();
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await expect(page.getByText("4 of 4 items reviewed.")).toBeVisible();
  await page.getByRole("tab", { name: "Schematic", exact: true }).click();
  await expect(page.getByRole("img", { name: /Official Ho-Ro/ })).toBeVisible();
  await button(page, "Documentation").click();
  await page.getByLabel("Search documentation").fill("fails");
  await button(page, "If an operation fails").click();
  await button(page, "About ArdPIC").click();
  await expect(
    page.getByText("Ahmed Emad El-Din Hussein", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ArdPicProg (Ho-Ro/ArdPicProg)" }),
  ).toHaveAttribute("href", "https://github.com/Ho-Ro/ArdPicProg");
});

test("new session is cancellable and resets connection and file", async ({
  page,
}) => {
  await example(page);
  await connect(page);
  await page.keyboard.press("Control+n");
  await button(page, "Cancel").click();
  await expect(button(page, "Program target")).toBeEnabled();
  await page.keyboard.press("Control+n");
  await button(page, "Start new session").click();
  await expect(button(page, "Program target")).toBeDisabled();
  await expect(page.getByText("safe-loop.hex", { exact: true })).toHaveCount(0);
});

test("system check shows browser preview status without desktop bridge", async ({
  page,
}) => {
  await button(page, "Setup").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "System check",
  );
  await expect(
    page.getByText("Browser preview. Desktop checks are not available here."),
  ).toBeVisible();
});

test("narrow screens keep navigation reachable and usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Programmer",
  );
  expect(
    await page
      .locator(".main")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBeTruthy();
  await page.screenshot({ path: "tests/screenshots/workbench-mobile.png" });
  await button(page, "Toggle navigation").click();
  await button(page, "Device library").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Device library",
  );
  await button(page, "Toggle navigation").click();
  await button(page, "Settings").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await button(page, "Done").click();
});

test("layouts render without horizontal overflow from 320 to 1920 pixels", async ({
  page,
}) => {
  for (const width of [320, 360, 620, 768, 900, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(60);
    expect(
      await page
        .locator(".main")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      `width ${width}`,
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "tests/screenshots/workbench-desktop.png" });
});
