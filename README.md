# J-Town Café Menu Studio

An editor for the original 12-page `8nov2026.pdf`. PDF.js renders the original menu; the artwork is not reconstructed in HTML. Exports modify selected PDF text objects, preserving photographs and vector artwork.

```sh
npm ci
npm run dev
```

Open the printed localhost URL. `npm run build` creates the browser assets in `dist/client/` and the database API Worker in `dist/server/`. Node 22.13+ is required for the local SQLite preview. `npm run dev` builds and starts the editor plus its local shared database; rebuild after source changes.

Click a highlighted price, name or quantity to edit it. Preview hides all targets and edit tools. Undo, individual/all reset, browser persistence, JSON backup import/export, page navigation, zoom and print-quality PDF downloads are included. Use backups when moving devices. Edits automatically save to a shared database; local browser recovery and JSON backups are also retained.

The three `static/original.part*` files concatenate to the exact original PDF bytes. This accommodates hosting asset-size limits; it does not alter the PDF. A zero-edit download returns the original bytes unchanged.

## Vercel-only deployment

Import this repository into Vercel. The checked-in `vercel.json` uses `npm run build:vercel` and publishes `dist/client/`. No database, Cloudflare account, API keys or environment variables are required for this build. It saves edits only in the current browser and shows “Saved on this device”. Use JSON backups to move edits to another device; clearing browser data removes local edits. PDF download and native file sharing still work.

The previously published ChatGPT Site is a separate deployment and is not changed by this Vercel configuration. The server-backed build remains available below but is not used on Vercel.

## Shared saving (server-backed build only)

The hosted editor automatically saves edits and a last-saved timestamp to Cloudflare D1 through `/api/menu`. Fresh visits load the latest saved menu. No application password, account, private owner token or sign-in is required. Anyone able to access the editor can read and change its menu. The hosting platform’s existing site access policy remains separate and unchanged.

Only the text changes are stored, not new copies of the original PDF or photographs. All saves use server-side field/glyph/overlap validation. Revision checks prevent a stale browser from overwriting newer edits: “Load saved menu” loads the online version and first downloads any pending local changes as a backup. Offline edits remain local; “Retry saving” reconnects. This supports editing after the page has loaded; it is not a fully offline-installable application.

Legacy local edits upload automatically if shared storage is empty. If an online menu already exists and differs from unsaved local edits, the editor asks the user to load the saved menu and preserves the local changes in a backup. It never silently overwrites that newer online menu.

Local preview uses `work/menu.sqlite` (ignored by Git). Hosted storage uses the `DB` D1 binding and the schema migration in `drizzle/`. Sites provisions that binding from its hosting manifest. GitHub Pages or a plain static Vercel deployment cannot run this API: self-hosting needs a compatible Worker + D1 binding, assets binding, and migration application.

## Share PDF

Share PDF passes the current, full-quality PDF file to the device’s native share sheet when the browser supports PDF file sharing over HTTPS. Available apps (such as WhatsApp, Telegram, AirDrop or email) depend on the device and installed share extensions. Unsupported or blocked sharing falls back to downloading the same PDF for manual attachment. Cancelling a share does not force a download. The file is prepared when the displayed menu changes so sharing starts directly from the tap, without waiting for PDF generation. No public upload is required.

## Audit and limits

[AUDIT.md](AUDIT.md) records the findings, fixes and test coverage: all 383 editable regions, 468 individual export comparisons, a combined 383-edit export checked by two renderers, and desktop/mobile UI checks.

Missing original font glyphs and values that cannot fit without disturbing nearby lettering are blocked, with an explanation. Some CMU Serif/Now font digits remain unavailable. Inline quantities in shared text runs must retain their printed width. Exact full-font supplements are included for Poppins Medium/Bold and Alegreya Bold; their OFL licenses are in `static/`.

Some names are separate PDF runs and retain separate controls. Original tight spacing, faint border lettering and the white strip above page 6 are present in the source and remain unchanged. The source's historical hidden text layers remain; this editor is not a redaction workflow.

## Verification

Basic checks:

```sh
npm test
```

Optional complete PDF audit (Python 3.9+):

```sh
python3 -m venv work/venv
work/venv/bin/pip install -r scripts/requirements-audit.txt
PYTHON=work/venv/bin/python node audit-export.mjs
node engine-regressions.mjs
node audit-pdfjs.mjs
work/venv/bin/python scripts/compare-combined.py
```

These create test-only PDFs under `work/`; they do not change the website's original menu or saved browser edits. Machine-readable results from the completed audit are retained in `validation-audit.json` and `validation-comparison.json`.
