const { test, expect } = require("@playwright/test");
const { fakeClaude, openApp, local } = require("./helpers");

// A 1x1 PNG is enough: the fake API doesn't look at the pixels.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

test("the app loads with no errors or blocked resources", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await openApp(page, { apiKey: "sk-test" });
  await expect(page.locator("#empty")).toBeVisible();
  expect(errors.filter((e) => !/favicon/.test(e) && !/404/.test(e))).toEqual([]);
});

test("a label photo fills the form, and saving adds the bottle", async ({ page }) => {
  const requests = await fakeClaude(page, {
    name: "Riserva", producer: "Giacomo Conterno", vintage: "2016", abv: "14%",
  });
  await openApp(page, { apiKey: "sk-test" });

  await page.setInputFiles("#camera-input", { name: "front.png", mimeType: "image/png", buffer: PNG });
  await page.click("#back-skip");
  await expect(page.locator("#f-producer")).toHaveValue("Giacomo Conterno");
  await expect(page.locator("#f-abv")).toHaveValue("14%");

  // One request, one image, and the photo is never kept.
  expect(requests).toHaveLength(1);
  expect(requests[0].messages[0].content.filter((c) => c.type === "image")).toHaveLength(1);

  await page.click("#edit-save");
  const saved = await local(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: "Riserva", vintage: "2016" });
  expect(JSON.stringify(saved)).not.toContain("base64");
});

test("importing a CSV merges by id and gives blank ids their own", async ({ page }) => {
  await openApp(page, { bottles: [{ id: "a", name: "Barolo", date_added: "2026-09-01" }] });
  await page.click("#btn-settings");
  const csv = "id,name,vintage\na,Barolo,2019\n,Rioja,2018\n,Chablis,2022\n";
  await page.setInputFiles("#import-file", { name: "cellar.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator("#toast")).toContainText("2 new, 1 updated");

  const list = await local(page);
  expect(list).toHaveLength(3);
  expect(new Set(list.map((b) => b.id)).size).toBe(3);
  expect(list.find((b) => b.id === "a")).toMatchObject({ vintage: "2019", date_added: "2026-09-01" });
});
