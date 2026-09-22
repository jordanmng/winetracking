"use strict";

/* ------------------------------------------------------------------ *
 * FIELD CONFIG
 * Add a new column by adding ONE line here. `fromLabel: true` means the
 * label reader will try to fill it; everything else drives the form,
 * the list card, and CSV import/export automatically.
 * ------------------------------------------------------------------ */
const FIELDS = [
  { key: "name",     label: "Name",             type: "text",     fromLabel: true },
  { key: "producer", label: "Producer",         type: "text",     fromLabel: true },
  { key: "vintage",  label: "Vintage",          type: "text",     fromLabel: true },
  { key: "vineyard", label: "Vineyard / Region",type: "text",     fromLabel: true },
  { key: "varietal", label: "Grape / Varietal", type: "text",     fromLabel: true },
  { key: "country",  label: "Country",          type: "text",     fromLabel: true },
  { key: "abv",      label: "ABV",              type: "text",     fromLabel: true },
  { key: "price",    label: "Price",            type: "text",     fromLabel: false },
  { key: "rating",   label: "Rating",           type: "text",     fromLabel: false },
  { key: "date",     label: "Date",             type: "date",     fromLabel: false },
  { key: "location", label: "Location",         type: "text",     fromLabel: false },
  { key: "notes",    label: "Notes",            type: "textarea", fromLabel: false },
];

const LS = {
  bottles: "cellar:bottles",
  apikey:  "cellar:apikey",
  model:   "cellar:model",
  workspace: "cellar:workspace",
};
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/* ---------------------------- storage ----------------------------- */
function loadBottles() {
  try { return JSON.parse(localStorage.getItem(LS.bottles) || "[]"); }
  catch { return []; }
}
function saveBottles(list) {
  try { localStorage.setItem(LS.bottles, JSON.stringify(list)); }
  catch (e) { toast("Could not save (storage full?)"); }
}
const getKey   = () => localStorage.getItem(LS.apikey) || "";
const getModel = () => localStorage.getItem(LS.model) || DEFAULT_MODEL;
const getWorkspace = () => localStorage.getItem(LS.workspace) || "";

/* ------------------------------ dom ------------------------------- */
const $ = (id) => document.getElementById(id);
const views = { list: $("view-list"), edit: $("view-edit"), settings: $("view-settings") };
function show(view) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[view].classList.remove("hidden");
  $("btn-add").classList.toggle("hidden", view !== "list");
  window.scrollTo(0, 0);
}

let draft = null;      // bottle being added/edited
let editingId = null;  // id when editing an existing bottle

/* ----------------------------- list ------------------------------- */
function renderList() {
  const list = loadBottles().sort((a, b) => (b.date_added || "").localeCompare(a.date_added || ""));
  const ul = $("bottle-list");
  ul.innerHTML = "";
  $("empty").classList.toggle("hidden", list.length > 0);
  for (const b of list) {
    const li = document.createElement("li");
    li.className = "bottle-card";
    li.onclick = () => openEdit(b);
    const sub = [b.producer, b.vineyard].filter(Boolean).join(" · ");
    const meta = [];
    if (b.varietal) meta.push(`<span>${esc(b.varietal)}</span>`);
    if (b.price)    meta.push(`<span><b>${esc(b.price)}</b></span>`);
    if (b.rating)   meta.push(`<span>★ <b>${esc(b.rating)}</b></span>`);
    if (b.location) meta.push(`<span>📍 ${esc(b.location)}</span>`);
    li.innerHTML = `
      <div class="bc-top">
        <span class="bc-name">${esc(b.name) || "Unnamed bottle"}</span>
        <span class="bc-vintage">${esc(b.vintage)}</span>
      </div>
      ${sub ? `<div class="bc-sub">${esc(sub)}</div>` : ""}
      ${meta.length ? `<div class="bc-meta">${meta.join("")}</div>` : ""}`;
    ul.appendChild(li);
  }
}

/* -------------------------- edit / confirm ------------------------ */
function buildForm(values) {
  const form = $("edit-form");
  form.innerHTML = "";
  for (const f of FIELDS) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const val = values[f.key] == null ? "" : String(values[f.key]);
    const control = f.type === "textarea"
      ? `<textarea id="f-${f.key}">${esc(val)}</textarea>`
      : `<input id="f-${f.key}" type="${f.type}" value="${esc(val)}" />`;
    wrap.innerHTML = `<span class="field-label">${f.label}</span>${control}`;
    form.appendChild(wrap);
  }
}
function readForm() {
  const out = {};
  for (const f of FIELDS) out[f.key] = ($(`f-${f.key}`).value || "").trim();
  return out;
}

function openEdit(bottle) {
  editingId = bottle.id;
  draft = { ...bottle };
  $("edit-title").textContent = "Edit bottle";
  $("edit-delete").classList.remove("hidden");
  $("extract-status").classList.add("hidden");
  buildForm(draft);
  show("edit");
}

function openConfirm(extracted) {
  editingId = null;
  const today = new Date().toISOString().slice(0, 10);
  draft = { ...extracted, date: extracted.date || today };
  $("edit-title").textContent = "Confirm bottle";
  $("edit-delete").classList.add("hidden");
  buildForm(draft);
  show("edit");
}

function saveEdit() {
  const data = readForm();
  const list = loadBottles();
  if (editingId) {
    const i = list.findIndex((b) => b.id === editingId);
    if (i >= 0) list[i] = { ...list[i], ...data };
  } else {
    list.push({ id: uid(), date_added: new Date().toISOString(), ...data });
  }
  saveBottles(list);
  renderList();
  show("list");
  toast(editingId ? "Updated" : "Saved to cellar");
}

function deleteBottle() {
  if (!editingId) return;
  if (!confirm("Delete this bottle?")) return;
  saveBottles(loadBottles().filter((b) => b.id !== editingId));
  renderList();
  show("list");
  toast("Deleted");
}

/* ------------------------- label reading -------------------------- */
async function handlePhoto(file) {
  if (!file) return;
  if (!getKey()) {
    toast("Add your API key in Settings first");
    openSettings();
    return;
  }
  openConfirm({});                       // show form immediately
  const status = $("extract-status");
  status.className = "extract-status";
  status.innerHTML = `<span class="spinner"></span><span>Reading the label…</span>`;
  status.classList.remove("hidden");
  try {
    const b64 = await downscale(file);
    const fields = await readLabel(b64);
    draft = { ...draft, ...fields };
    buildForm(draft);
    status.classList.add("hidden");
    toast("Check the fields, then save");
  } catch (err) {
    status.className = "extract-status err";
    status.textContent = "Couldn't read the label: " + (err.message || err) + ". Enter the details by hand.";
  }
}

function downscale(file, max = 1568, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      const url = c.toDataURL("image/jpeg", quality);
      resolve(url.split(",")[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = URL.createObjectURL(file);
  });
}

async function readLabel(b64) {
  const wanted = FIELDS.filter((f) => f.fromLabel);
  const keyList = wanted.map((f) => `"${f.key}"`).join(", ");
  const descr = wanted.map((f) => `- ${f.key}: ${f.label}`).join("\n");
  const prompt =
`You are reading a photo of a wine bottle label. Extract these fields:
${descr}

Return ONLY a JSON object with exactly these keys: ${keyList}.
Use an empty string "" for anything not clearly legible on the label. Do not guess or invent details. Return the JSON and nothing else.`;

  const headers = {
    "content-type": "application/json",
    "x-api-key": getKey(),
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  // Org-level keys aren't tied to a workspace and need this header.
  const ws = getWorkspace();
  if (ws) headers["anthropic-workspace-id"] = ws;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: getModel(),
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); if (j.error?.message) msg = j.error.message; } catch {}
    if (res.status === 401) msg = "API key rejected — check it in Settings";
    if (/workspace/i.test(msg)) msg += " \u2014 paste your Workspace ID in Settings and try again";
    throw new Error(msg);
  }
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("").trim();
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json);
  const clean = {};
  for (const f of wanted) if (parsed[f.key]) clean[f.key] = String(parsed[f.key]).trim();
  return clean;
}

/* ---------------------------- settings ---------------------------- */
function openSettings() {
  $("set-apikey").value = getKey();
  $("set-model").value = getModel();
  $("set-workspace").value = getWorkspace();
  $("count-line").textContent = `${loadBottles().length} bottle(s) stored on this device.`;
  show("settings");
}
function saveSettings() {
  localStorage.setItem(LS.apikey, $("set-apikey").value.trim());
  localStorage.setItem(LS.model, ($("set-model").value.trim() || DEFAULT_MODEL));
  localStorage.setItem(LS.workspace, $("set-workspace").value.trim());
  toast("Settings saved");
  show("list");
}

/* --------------------------- import/export ------------------------ */
function exportJSON() {
  download("cellar.json", JSON.stringify(loadBottles(), null, 2), "application/json");
}
function exportCSV() {
  const cols = ["id", "date_added", ...FIELDS.map((f) => f.key)];
  const rows = [cols.join(",")];
  for (const b of loadBottles()) rows.push(cols.map((c) => csvCell(b[c])).join(","));
  download("cellar.csv", rows.join("\n"), "text/csv");
}
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
async function importFile(file) {
  const text = await file.text();
  let list;
  try {
    list = file.name.endsWith(".json") ? JSON.parse(text) : parseCSV(text);
  } catch (e) { toast("Could not read that file"); return; }
  if (!Array.isArray(list)) { toast("File format not recognized"); return; }
  list = list.map((b) => ({ id: b.id || uid(), date_added: b.date_added || new Date().toISOString(), ...b }));
  saveBottles(list);
  renderList();
  toast(`Imported ${list.length} bottle(s)`);
  openSettings();
}
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter((r) => r.some((c) => c !== "")).map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h.trim()] = r[i] ?? ""));
    return o;
  });
}

/* ----------------------------- utils ------------------------------ */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ------------------------------ wire ------------------------------ */
$("btn-add").onclick = () => $("camera-input").click();
$("camera-input").onchange = (e) => { handlePhoto(e.target.files[0]); e.target.value = ""; };
$("btn-settings").onclick = openSettings;
$("settings-back").onclick = () => show("list");
$("settings-save").onclick = saveSettings;
$("edit-cancel").onclick = () => show("list");
$("edit-save").onclick = saveEdit;
$("edit-delete").onclick = deleteBottle;
$("export-csv").onclick = exportCSV;
$("export-json").onclick = exportJSON;
$("import-btn").onclick = () => $("import-file").click();
$("import-file").onchange = (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; };

renderList();
show("list");
if (!getKey()) toast("Add your API key in Settings to read labels");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
