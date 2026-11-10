# Final verification — 11 November 2026

Application commit tested: `2d16586ab79fea64aac11c49ae83c2dbde83aa2f`.

## Passed

- `npm test`: zero-edit byte identity, 15 representative edits, all field originals, native-share invocation/File identity/cancellation/fallback checks.
- `npm run build`: successful Vite production build.
- `npm audit`: zero reported vulnerabilities.
- Full export audit: 383 editable fields, 468 rendered individual export comparisons, zero failures. The 69 rejected test candidates were rejected by the intended glyph/width/overlap safeguards.
- Combined stress export: 383 simultaneous valid changes. All 12 pages compared with both MuPDF and PDF.js (24 comparisons); zero differences outside edited regions. All 383 compressed original image streams remained byte-identical.
- Browser production-build checks: price 69 → 149, name editing, undo, reset-one/reset-all, reload persistence, backup export/import and PDF download.
- Downloaded edited PDF: 12 original page dimensions/rotations; rendered difference confined to the selected page-2 price. Reset download matched the original bytes.
- Captured and visually reviewed all 12 browser pages. Checked edit/preview at widths 320, 390, 768, 1024 and 1440 pixels: correct page ratios, no document overflow, preview targets hidden.
- Zoom 100% → 125% → Fit 100%, panel collapse/expand, and no captured browser errors.
- Live deployment uses the tested production JavaScript asset. Header branding, Share PDF button, favicon and touch-icon references verified; the deployed favicon image loaded successfully.
- Shared tracked application files match the deployed Site source checkout.

## Remaining limits

- Shared saving is now implemented without application authentication; see the shared-storage verification below. Hosting remains the existing private Site, not a new Vercel deployment. Anyone who can access the editor can change its menu.
- Native-share logic and fallback are tested. Actual delivery through WhatsApp, Telegram, AirDrop and physical Android/iOS/Windows devices was not verified. Available apps depend on OS/browser support and installed share targets. The in-app browser's native system sheet is not exposed to automation.
- Original missing font glyphs, text-width and overlap restrictions remain enforced. Some original names are split across separate PDF text runs. Existing source spacing/artwork is preserved.
- Vite reports a non-fatal bundle-size advisory because PDF.js and PDF editing libraries are bundled. The original menu is approximately 36 MB; its image quality is preserved.

## Shared-storage verification — 11 November 2026

- Added a D1 database API, shared autosave, last-saved timestamps, local pending-change recovery and revision conflict protection. No application login or password was added. Existing hosting access remains unchanged.
- Automated storage tests passed against SQLite: first/next save, fresh restore, stale revisions, offline persistence/resume, dropped responses, idempotency, legacy browser data conflicts, payload/field validation, cross-origin checks and reset timestamps.
- Browser tests passed across independent localhost and 127.0.0.1 storage contexts: save → fresh restore → conflicting stale edit → backup local changes → load saved menu. Tested offline editing with the server stopped, restart/retry, and restoration in the second context.
- Fixed the offline renderer regression by reusing the loaded PDF worker.
- Live hosting verification: native database inspection confirmed `DB` / `menu_state`; an actual browser edit wrote revision 1 with price 149 and a server timestamp. Reload restored that edit. Reset saved revision 2 with an empty edits object; the test left the original prices in place.
- Live edited download retained all 12 page sizes/rotations and all 383 compressed original image streams. Rendering all 12 pages found only the edited price region changed. The reset download matched the exact original bytes.
- Live layouts checked at widths 320, 390 and 1440: no horizontal overflow or header controls outside the viewport; online save status visible.
- Fresh install, full test command and production build passed; dependency audit reported zero vulnerabilities. PDF engine/data/artwork are unchanged from the previous complete 468-export audit.
- The page must finish loading before offline editing; this is not an offline-installable app. Native share delivery on physical devices remains unverified. Anonymous application access is intentional, per request; a public deployment would allow anyone with access to overwrite saved menu changes.
