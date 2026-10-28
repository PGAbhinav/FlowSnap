# FlowSnap

**Turn long study text into editable, source-aware flowcharts.**

FlowSnap is a small, browser-based open-source MVP for students and researchers. Paste text or upload a TXT, PDF, or DOCX file, extract important points, and arrange them into an editable diagram.

## Features

- Paste text or load `.txt`, `.md`, `.pdf`, and `.docx` documents.
- Runs in the browser; no account, server, or AI API key required.
- Overview, balanced, and detailed extraction settings.
- Process-flow, concept-map, and topic-hierarchy layouts.
- Editable node title, supporting detail, and type.
- Drag nodes, add nodes, create connections, and remove nodes.
- Inspect the source excerpt associated with generated nodes.
- Export SVG, PNG, or a JSON project you can reopen.
- Static website suitable for GitHub Pages.

## Run locally

No build step is required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser, or serve the folder locally:

```bash
python3 -m http.server 8000
```

3. Visit `http://localhost:8000`.

The PDF.js and Mammoth.js libraries are loaded from a CDN for PDF and DOCX support, so those file types require an internet connection. Pasted text and TXT/Markdown files work without those libraries.

## Publish on GitHub Pages

1. Create a **public** repository named `flowsnap`.
2. Upload the files in this project to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under the build/deployment source, select **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Wait for the Pages deployment to finish. GitHub will show the published URL in the Pages settings.

No build command is needed.

## Current limitations

This is an early MVP, not a fully semantic AI system.

- The extraction engine uses heuristics and explicit language patterns. It may miss important facts or infer relationships that need correction.
- Source excerpts are retained for review, but the MVP does not provide robust scientific citation or sentence-level factual verification.
- Scanned/image-only PDFs need OCR and are not supported by the current parser.
- Complex equations, tables, multi-column PDFs, and unusual document layouts may extract poorly.
- Long documents should be processed section by section; the MVP has a practical node limit.
- PNG/SVG export and browser behavior may vary slightly by browser.

**Always verify the generated diagram against the original material**, especially for scientific, medical, legal, or other high-stakes content.

## Privacy

Text extraction and diagram generation run locally in the browser. Documents are not uploaded to a FlowSnap server because the project has no backend. PDF/DOCX parser scripts are fetched from a public CDN when needed. Do not use the tool as a guarantee that sensitive content is safe to share.

## Contributing

Issues, bug reports, accessibility improvements, parser improvements, and example documents are welcome. Please include a small reproducible example when reporting an extraction problem.

## License

MIT. See [LICENSE](LICENSE).
