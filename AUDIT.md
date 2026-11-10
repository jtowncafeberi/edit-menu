# Visual and PDF export audit

The original PDF remains the authoritative artwork. No default menu content, photographs, font choices, page order or page dimensions were changed.

## Fixed

| Finding | Correction |
| --- | --- |
| Mobile 75% zoom was the same size as 100%; zoom above 100% could put the left edge outside the reachable scroll area. | Zoom now uses the actual fitted page width. Both horizontal edges remain reachable. Fit and zoom-out work on narrow screens. |
| Zoom controls disappeared far above the current page. | View controls remain below the editor header, with offsets measured for each layout and mode. |
| The current-page label could show the preceding preloaded page. | It now follows the largest actually visible page. Mobile navigation uses an accessible page selector. |
| Resizing and changing modes could displace the reading position. | The page and position within that page are preserved. Browser scroll anchoring does not compete with this adjustment. |
| Rounded PNG thumbnail dimensions could influence the page layout. | Page geometry comes exclusively from the PDF dimensions; thumbnails and canvases are positioned inside it. |
| Highlights kept their original width after editing. | Highlights follow the replacement's measured position and width, including rotated text and glyph overhangs. |
| A wider price could collide with an uneditable size label or unit in the same PDF text object. | Validation includes those fixed glyphs, page edges and other edits. Values that cannot fit are rejected before saving. |
| Rebuilding a whole inline text run could shift unedited combo lettering by about 0.04 pt. | Equal-width inline edits now patch the original encoded text string. Unedited prefixes/suffixes retain their original positioning and advances. |
| Combo quantities and millilitre values were labelled as dish prices. | They are identified separately as quantities/sizes, retaining their stable backup IDs. |
| Fast render/zoom requests could allow an older rendering to complete last. | Rendering uses a per-page request token and document generation; stale results are discarded. |
| Saving happened before export/render preparation had succeeded. | State and undo history are committed only after the replacement PDF has been prepared successfully. Invalid imports leave existing edits intact. |
| Some editor labels and small controls were difficult to read/use. | Editor-only labels have stronger contrast and controls have larger touch areas. Small dialogs scroll within the viewport. |

## Verification completed

- All **383 editable regions** individually exported and checked.
- **468 single-region export comparisons**, including growing/shrinking prices, longer/shorter names, inline quantities, supplied font glyphs and rotated lettering. No differences outside original/replacement glyph bounds plus a 1.5 pt antialiasing allowance.
- A combined PDF with **383 simultaneous edits** rendered across all 12 pages using **MuPDF and PDF.js**: **24 full-page comparisons passed** with no differences outside edited regions.
- All **383 original compressed image streams** stayed byte-identical.
- Zero edits return the original bytes; the actual browser-downloaded file was checked too.
- **50 layout combinations**: widths 320, 390, 768, 1024 and 1440 px; zoom 50%, 75%, 100%, 125% and 250%; edit and preview modes. No header overlap, document overflow or out-of-page targets found. Horizontal scrolling within the menu at magnified zoom is intentional.
- All 12 pages inspected on desktop and mobile in both modes; 48 page screenshots captured.
- Browser checks: price/name/quantity changes, resized highlights, invalid and oversized values, dialog fitting at 320 × 360, reload persistence, individual/all reset, undo, rejected import, backup restoration and downloads. The edited browser download exactly matched the expected engine export. No browser console errors were observed.

Machine-readable results are in `validation-audit.json` and `validation-comparison.json`.

## Remaining source constraints

Some original embedded fonts omit glyphs. Exact matching full fonts are supplied for Poppins Medium, Poppins Bold and Alegreya Bold. Other unavailable characters remain blocked; notably CMU Serif pasta prices cannot add digits 0, 4, 6, 7 or 8, and some Now Bold prices cannot add 6. A full original font with matching outlines is needed to remove those restrictions without approximation.

Inline quantities inside a shared text string must retain their digit count and printed width. Otherwise the fixed surrounding lettering cannot remain pixel-identical in both renderers. The control explains this restriction.

The source PDF itself contains tight spacing, faint repeated border lettering and a white strip above page 6. These are present in the original, not added by the editor, and are preserved. Source text is not silently copy-edited. Some dish names are separate text runs and retain separate controls.

This audit covers the listed cases and viewport sizes. It does not claim every possible replacement string or browser engine is identical; invalid or unsupported replacements are blocked instead of approximated.

## Menu Studio UI refresh — 10 November 2026

The editor chrome was refreshed with clearer typography, grouped backup/reset controls, a collapsible navigation panel, larger touch targets, and a local-save status. Original assets, field coordinates and PDF engine were unchanged.

Rechecked edit/preview at widths 320, 390, 768, 1024 and 1440 pixels: no document overflow or header controls outside the viewport; all 12 page ratios remained correct. Visually inspected desktop, mobile, expanded backup tools and collapsed navigation. Browser checks passed for price 69 → 149, name editing, individual reset, reset-all, undo, reload persistence, backup export/import and PDF downloads. Undo history is session-only; saved edits persist across reloads.

Fresh PDF checks passed: zero-edit browser download matched the source bytes; a downloaded edited PDF retained all 12 page dimensions with a difference only at the edited page-2 price. Fifteen representative edits and the combined 383-edit stress export passed. Both MuPDF and PDF.js comparisons found no differences outside edited regions across all 12 pages (24 comparisons); all 383 original image streams remained byte-identical. These checks retain the font-glyph and width limits documented above.

## Native PDF sharing — 11 November 2026

Added a Share PDF control using the native Web Share API with a prepared File containing the displayed PDF bytes. Share and download use that same File, refreshed after edits, undo, import and resets. Unit checks cover immediate native invocation, exact File identity, unsupported/blocked API fallback, rejection, and cancellation without download. Browser checks covered the control at widths 320, 390, 768, 1024 and 1440 pixels without document or header overflow. A browser download after 69 → 149 retained all 12 page dimensions; rendered differences were confined to that price; all 383 original image streams were byte-identical. Reset returned the source bytes unchanged. The in-app browser began a native share operation, but its system sheet was not exposed to automation; delivery through WhatsApp, Telegram, AirDrop and other apps on physical devices was not verified. Browser tests used reload to end that pending test operation.

## Shared autosave — 11 November 2026

Added a D1-backed GET/PUT menu API and browser synchronization, with no application authentication. Server validation reuses the exact menu field, font and collision checks. Automated tests cover fresh restore, sequential saves, compare-and-swap conflicts, offline/reload recovery, lost responses and idempotent requests, legacy local migration, malformed/oversized requests, cross-origin rejection and reset timestamps. Existing hosting access is preserved.

Browser tests used independent localhost and 127.0.0.1 local-storage contexts with one database: fresh context restored a changed price; a stale tab was blocked; loading the online menu backed up the pending local value. Stopping the local server exposed a PDF worker reload bug; the editor now reuses its loaded PDF worker. Retest passed for applying an edit offline, reconnecting, saving it online, and restoring it in the second context. Original PDF/text engine and artwork assets are unchanged.

## Liquid-glass theme — 11 November 2026

Refreshed editor-only CSS using the J-Town Café POS reference: dark charcoal, subtle blue accents, frosted panels, reflective borders, soft highlights and white active controls. Added solid-surface fallbacks for browsers without backdrop blur and reduced-transparency preferences. Menu canvases, edit-target styling, coordinates, source assets and PDF engine remain unchanged.

Visually checked desktop, mobile, editing dialog and expanded backup tools. Edit/preview checks at widths 320, 390, 768, 1024 and 1440 found no document overflow, header controls outside the viewport or invalid page ratios. Fixed low contrast in the mobile page selector. Browser editing, local saving, undo and downloads passed with no captured browser errors. Full test command and Vercel build passed. Downloaded zero-edit PDF matched source bytes; an edited download retained all 12 page dimensions and changed only the selected page-2 price when rendered. This update prepares the repository for the user's Vercel deployment; the separate ChatGPT-hosted Site was not republished.
