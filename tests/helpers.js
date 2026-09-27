// Fakes for the two outside services the app talks to.

const SHEET_URL = "https://script.google.com/macros/s/TEST/exec";

/** An in-memory stand-in for sheet/Code.gs. `offline = true` fails upserts. */
async function fakeSheet(page, rows = []) {
  const sheet = {
    rows: new Map(rows.map((r) => [r.id, r])),
    calls: [],
    offline: false,
    listDelay: 0,
  };
  await page.route("https://script.google.com/**", async (route) => {
    const req = JSON.parse(route.request().postData());
    sheet.calls.push(req.action);
    if (req.secret !== "s3cret") return route.fulfill({ json: { error: "Bad secret" } });
    if (req.action === "upsert") {
      if (sheet.offline) return route.abort();
      sheet.rows.set(req.bottle.id, req.bottle);
    }
    if (req.action === "delete") sheet.rows.delete(req.id);
    if (req.action === "list") {
      const snapshot = [...sheet.rows.values()];
      await new Promise((r) => setTimeout(r, sheet.listDelay));
      return route.fulfill({ json: { ok: true, bottles: snapshot } });
    }
    route.fulfill({ json: { ok: true, count: sheet.rows.size } });
  });
  return sheet;
}

/** Answers every label read with `fields` as the model's JSON. */
async function fakeClaude(page, fields) {
  const requests = [];
  await page.route("https://api.anthropic.com/**", (route) => {
    requests.push(JSON.parse(route.request().postData()));
    route.fulfill({ json: { content: [{ type: "text", text: JSON.stringify(fields) }] } });
  });
  return requests;
}

/** Opens the app with localStorage preset (bottles, settings). */
async function openApp(page, { bottles = [], sheet = false, apiKey = "" } = {}) {
  await page.goto("/");
  await page.evaluate(({ bottles, sheet, apiKey, url }) => {
    localStorage.clear();
    localStorage.setItem("cellar:bottles", JSON.stringify(bottles));
    if (apiKey) localStorage.setItem("cellar:apikey", apiKey);
    if (sheet) {
      localStorage.setItem("cellar:sheeturl", url);
      localStorage.setItem("cellar:sheetsecret", "s3cret");
    }
  }, { bottles, sheet, apiKey, url: SHEET_URL });
  await page.reload();
}

const local = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("cellar:bottles")));
const pending = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("cellar:pending") || "{}"));

module.exports = { SHEET_URL, fakeSheet, fakeClaude, openApp, local, pending };
