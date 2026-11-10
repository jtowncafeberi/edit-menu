# J-Town Café Menu Studio

A browser-only editor for the original 12-page `8nov2026.pdf`. PDF.js renders the original menu; the artwork is not reconstructed in HTML. Exports modify selected PDF text objects, preserving photographs and vector artwork.

```sh
npm ci
npm run dev
```

Open the printed localhost URL. `npm run build` creates the static website in `dist/`.

Click a highlighted price, name or quantity to edit it. Preview hides all targets and edit tools. Undo, individual/all reset, browser persistence, JSON backup import/export, page navigation, zoom and print-quality PDF downloads are included. Use backups when moving devices. All edits remain in the current browser.

The three `static/original.part*` files concatenate to the exact original PDF bytes. This accommodates hosting asset-size limits; it does not alter the PDF. A zero-edit download returns the original bytes unchanged.

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
