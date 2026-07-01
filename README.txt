This folder needs two files that aren't included here because they must be
pulled from npm (no internet access when these project files were prepared):

  embedpdf.js
  pdfium.wasm

How to get them (run in the DOCMAN project root, Git Bash):

  npm install @embedpdf/snippet@2.14.4
  cp -r node_modules/@embedpdf/snippet/dist/* vendor/embedpdf/
  cp node_modules/@embedpdf/pdfium/dist/pdfium.wasm vendor/embedpdf/

Then find the jsdelivr URL baked into the bundle:

  grep -o "https://cdn.jsdelivr.net/npm/@embedpdf/pdfium[^\"']*" vendor/embedpdf/embedpdf.js

Report that exact string back to Claude (or just replace it yourself) with:

  sed -i 's|https://cdn.jsdelivr.net/npm/@embedpdf/pdfium[^"'"'"']*|./pdfium.wasm|' vendor/embedpdf/embedpdf.js

Verify it worked (should print nothing — no more jsdelivr references left):

  grep -o "cdn.jsdelivr.net" vendor/embedpdf/embedpdf.js

If embedpdf.js turns out to be split into multiple chunk files (not a single
bundle) after the `cp -r`, copy the whole dist/ folder contents as-is — the
relative imports between chunks will keep working since they resolve
relative to this folder either way. Once pdfium.wasm and embedpdf.js (plus
any chunks) are in this folder, delete this README — it's just setup notes.
