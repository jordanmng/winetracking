/**
 * Cellar — Google Apps Script backend.
 *
 * Setup (once):
 *   1. Open your Cellar spreadsheet.
 *   2. Extensions > Apps Script. Delete whatever is there and paste this file in.
 *   3. Change SECRET below to any random string. Save.
 *   4. Deploy > New deployment > type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Authorize when asked (Google shows an "unverified app" warning for your
 *      own script — Advanced > Go to ... to continue).
 *   5. Copy the /exec URL and paste it, with the same SECRET, into Cellar's
 *      Settings.
 *
 * "Anyone" means anyone holding the URL can call it, which is why every
 * request must carry the secret. Keep both out of public places.
 */

var SECRET = "CHANGE-ME";

var HEADERS = ["id", "date_added", "name", "producer", "vintage", "vineyard",
               "varietal", "country", "abv", "price", "rating", "date",
               "location", "notes", "updated_at"];

/** The tab whose A1 says "id", so adding or reordering tabs can't point the
    app at the wrong one (an empty tab would read as "everything deleted"). */
function sheet_() {
  var tabs = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < tabs.length; i++) {
    if (String(tabs[i].getRange(1, 1).getValue()).trim() === "id") return tabs[i];
  }
  var sh = tabs[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

/** Header row as written in the sheet, so columns you add by hand survive. */
function headers_(sh) {
  var width = Math.max(sh.getLastColumn(), 1);
  var row = sh.getRange(1, 1, 1, width).getValues()[0];
  var out = [];
  for (var i = 0; i < row.length; i++) {
    var h = String(row[i]).trim();
    if (h !== "") out.push(h);
  }
  return out.length ? out : HEADERS;
}

function idColumn_(sh) {
  if (sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var ids = [];
  for (var i = 0; i < vals.length; i++) ids.push(String(vals[i][0]).trim());
  return ids;
}

function rows_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var hs = headers_(sh);
  // Display values: a hand-typed date or 13.5% comes back as the text shown,
  // not a Date object or 0.135.
  var values = sh.getRange(2, 1, last - 1, hs.length).getDisplayValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var o = {}, blank = true;
    for (var c = 0; c < hs.length; c++) {
      var v = values[r][c];
      o[hs[c]] = v === "" || v === null ? "" : String(v);
      if (o[hs[c]] !== "") blank = false;
    }
    if (!blank) out.push(o);
  }
  return out;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ error: "Sheet busy, try again" });
  }
  try {
    if (SECRET === "CHANGE-ME") return json_({ error: "Set SECRET in the script first" });
    var req = JSON.parse(e.postData.contents);
    if (String(req.secret) !== String(SECRET)) return json_({ error: "Bad secret" });

    var sh = sheet_();
    var hs = headers_(sh);

    if (req.action === "ping") return json_({ ok: true, count: rows_(sh).length });
    if (req.action === "list") return json_({ ok: true, bottles: rows_(sh) });

    if (req.action === "upsert") {
      var b = req.bottle || {};
      if (!b.id) return json_({ error: "Missing id" });
      var at = idColumn_(sh).indexOf(String(b.id));
      var row = at >= 0 ? at + 2 : sh.getLastRow() + 1;
      var range = sh.getRange(row, 1, 1, hs.length);
      var old = [];
      if (at >= 0) {
        var vals = range.getValues()[0], fx = range.getFormulas()[0];
        for (var j = 0; j < hs.length; j++) old.push(fx[j] || vals[j]);
      }
      var line = [];
      for (var i = 0; i < hs.length; i++) {
        var v = b[hs[i]];
        // A column the app doesn't know (added by hand) keeps what's there.
        if (v === undefined) { line.push(old[i] === undefined ? "" : old[i]); continue; }
        v = v === null ? "" : String(v);
        // Leading ' stores it as plain text: "13.5%" stays 13.5%, not 0.135,
        // and label text starting with "=" can't become a formula.
        line.push(v === "" ? "" : "'" + v);
      }
      range.setValues([line]);
      return json_({ ok: true, updated: at >= 0 });
    }

    if (req.action === "delete") {
      if (!req.id) return json_({ error: "Missing id" });
      var at2 = idColumn_(sh).indexOf(String(req.id));
      if (at2 >= 0) sh.deleteRow(at2 + 2);
      return json_({ ok: true, removed: at2 >= 0 });
    }

    return json_({ error: "Unknown action: " + req.action });
  } catch (err) {
    return json_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, note: "Cellar endpoint is alive. The app posts here." });
}
