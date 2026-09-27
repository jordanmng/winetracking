const { test, expect } = require("@playwright/test");
const { SHEET_URL, fakeSheet, openApp, local, pending } = require("./helpers");

const bottle = (id, name, extra = {}) =>
  ({ id, name, date_added: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", ...extra });

test("connecting a sheet sends up the bottles already on the phone", async ({ page }) => {
  const sheet = await fakeSheet(page);
  await openApp(page, { bottles: [bottle("a", "Barolo"), bottle("b", "Rioja")] });

  await page.click("#btn-settings");
  await page.fill("#set-sheeturl", SHEET_URL);
  await page.fill("#set-sheetsecret", "s3cret");
  await page.click("#settings-save");
  await page.evaluate(() => syncNow(true));

  expect([...sheet.rows.keys()].sort()).toEqual(["a", "b"]);
  expect((await local(page)).map((b) => b.name).sort()).toEqual(["Barolo", "Rioja"]);
});

test("a row edited by hand in the sheet wins on the next open", async ({ page }) => {
  await fakeSheet(page, [bottle("a", "Barolo 2019 (fixed in sheet)")]);
  await openApp(page, { bottles: [bottle("a", "Barolo")], sheet: true });
  await page.evaluate(() => syncNow(true));

  expect((await local(page))[0].name).toBe("Barolo 2019 (fixed in sheet)");
  await expect(page.locator(".bc-name")).toHaveText("Barolo 2019 (fixed in sheet)");
});

test("deleting a bottle removes its row from the sheet", async ({ page }) => {
  const sheet = await fakeSheet(page, [bottle("a", "Barolo"), bottle("b", "Rioja")]);
  await openApp(page, { bottles: [bottle("a", "Barolo"), bottle("b", "Rioja")], sheet: true });
  await page.evaluate(() => syncNow(true));

  page.once("dialog", (d) => d.accept());
  await page.locator(".bottle-card", { hasText: "Rioja" }).click();
  await page.click("#edit-delete");
  await expect.poll(() => [...sheet.rows.keys()]).toEqual(["a"]);
  expect(await pending(page)).toEqual({});
});

// Regression: this edit used to be replaced by the sheet's older copy, and
// that older copy was then pushed back up.
test("an edit made offline while a sync is running is kept", async ({ page }) => {
  const sheet = await fakeSheet(page, [bottle("a", "Barolo")]);
  await openApp(page, { bottles: [bottle("a", "Barolo")], sheet: true });
  await page.evaluate(() => syncNow(true));

  sheet.listDelay = 800;
  const sync = page.evaluate(() => syncNow(true));
  sheet.offline = true;
  await page.waitForTimeout(200);             // the pull is now in flight
  await page.locator(".bottle-card").click();
  await page.fill("#f-name", "Barolo Riserva");
  await page.click("#edit-save");
  await sync;

  expect((await local(page))[0].name).toBe("Barolo Riserva");
  expect(await pending(page)).toEqual({ a: "upsert" });

  sheet.offline = false;                      // signal comes back
  sheet.listDelay = 0;
  await page.evaluate(() => syncNow(true));
  expect(sheet.rows.get("a").name).toBe("Barolo Riserva");
  expect((await local(page))[0].name).toBe("Barolo Riserva");
});

test("a wrong secret is reported by Test connection", async ({ page }) => {
  await fakeSheet(page);
  await openApp(page);
  await page.click("#btn-settings");
  await page.fill("#set-sheeturl", SHEET_URL);
  await page.fill("#set-sheetsecret", "wrong");
  await page.click("#sheet-test");
  await expect(page.locator("#sheet-result")).toContainText("Bad secret");
});
