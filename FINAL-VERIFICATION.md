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

- Saved edits are browser-local. Shared cloud saving and owner sign-in are not implemented; owner identity and backend setup are still required. Hosting remains the existing private Site, not a new Vercel deployment.
- Native-share logic and fallback are tested. Actual delivery through WhatsApp, Telegram, AirDrop and physical Android/iOS/Windows devices was not verified. Available apps depend on OS/browser support and installed share targets. The in-app browser's native system sheet is not exposed to automation.
- Original missing font glyphs, text-width and overlap restrictions remain enforced. Some original names are split across separate PDF text runs. Existing source spacing/artwork is preserved.
- Vite reports a non-fatal bundle-size advisory because PDF.js and PDF editing libraries are bundled. The original menu is approximately 36 MB; its image quality is preserved.
