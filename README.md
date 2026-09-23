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

The catalog lives in **a Google Sheet in your own Drive**, so you can open it
from any device, sort it, edit it by hand, or add a column. The app keeps a
copy on the device as well, which is what makes capture instant and lets it
work with no signal — anything that can't be sent is queued and retried.

If you never connect a sheet, the app still works exactly as before: everything
stays on the device, with CSV/JSON export and import.

**Rules of the road:** the sheet is the source of truth. On open, the app sends
anything queued and then re-reads the sheet, so a row you edited by hand wins.
It will not pull while local changes are still unsent, so nothing is quietly
discarded.

### Connecting the sheet

1. Open your Cellar spreadsheet, then **Extensions → Apps Script**.
2. Delete the placeholder code and paste in [`sheet/Code.gs`](sheet/Code.gs).
3. Change `SECRET` at the top to any random string. Save.
4. **Deploy → New deployment → Web app**, with **Execute as: Me** and
   **Who has access: Anyone**. Authorize it — Google shows an "unverified app"
   warning for your own script, so click Advanced and continue.
5. Copy the `/exec` URL.
6. In the app: Settings → paste the URL and the same secret → **Test connection**.

"Anyone" means anyone holding that URL can call it, which is why every request
carries the secret. Keep the URL and secret out of public places — they live in
the app's settings on your phone, never in this repo.

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
