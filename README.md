# Cellar

A tiny web app for cataloging wine bottles from a photo of the label.

Tap **+**, snap the front label, and Cellar reads it and pre-fills the details
(name, producer, vintage, vineyard/region, grape, country, ABV). You check
and correct the fields, add price / rating / date / location / notes, and
save. The **photos are never stored** — only the details you confirm.

After the front shot it offers an **optional back-label photo**. Some fronts
(natural wine, design-led producers) carry almost no text, while the back is
where ABV, the importer and the country of origin are usually printed. One tap
skips it. Both images go to the model in a single request, so it reconciles
front against back itself rather than merging two separate readings.

It's a PWA, so you can add it to your iPhone home screen and it opens
full-screen with the camera one tap away.

## Where the data lives

Everything is stored **on your device**, in the browser (`localStorage`) —
no server, no account, nothing leaves your phone except the one label photo
that's sent to Anthropic to read the text (and that photo isn't saved
anywhere).

There's no Google Sheets connector available in this project, so rather than
build against one we kept the catalog self-contained and portable:

- **Export CSV** — open it in Google Sheets / Excel, edit by hand, done.
- **Export JSON** — a full backup.
- **Import** — load a CSV or JSON back in (edit in a spreadsheet, re-import).
  Import merges: rows with a matching `id` are updated, new rows are added,
  and nothing already on the device is removed.

So it stays lightweight and hand-editable, and if you later want it in a real
Google Sheet, the CSV drops straight in.

## The one setup step: an Anthropic API key

Reading labels uses the Anthropic API, which needs your own API key
(roughly a fraction of a cent per bottle with the default Haiku model).

1. Get a key at https://console.anthropic.com/settings/keys
2. Open the app → the gear icon (top right) → paste the key → **Save**.

The key is stored only on your device and is sent only to Anthropic's API to
read a label. You can change the model there too (Haiku is cheapest; a Sonnet
model is more accurate on ornate labels).

## Run it

It's plain static files — any static host works.

**Locally:**
```
python3 -m http.server 8000
# then open http://localhost:8000
```

**On your phone (recommended): GitHub Pages.** Once this is pushed to a repo,
enable Pages (Settings → Pages → Deploy from branch → `main` / root). Open the
Pages URL in Safari → Share → **Add to Home Screen**.

> Note: the API call needs HTTPS (or localhost). GitHub Pages is HTTPS, so
> it works out of the box.

## Adding or changing fields

All fields are defined in one array at the top of `app.js` (`FIELDS`). Add a
line there and it shows up in the form, the list, and the CSV automatically.
Set `fromLabel: true` if the label reader should try to fill it.

## Files

- `index.html` / `styles.css` / `app.js` — the app
- `manifest.webmanifest` / `sw.js` / `icons/` — PWA (installable, offline shell)
