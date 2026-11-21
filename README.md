### Resume

- Web: https://nascarsayan.github.io (`index.html`, static, no server)
- PDF: `resume.pdf`, behind the "Download PDF" button.

`index.html` has a print stylesheet that is the one-page, ATS-friendly CV. CI
(`.github/workflows/pdf.yml`) runs `bun scripts/build-pdf.ts` on every push: headless Chrome prints the
page, the script picks the largest text scale that fits one A4 page (stepping down slightly if that
clears stub lines), commits the PDF,
and fails if any layout rule breaks:

| rule | meaning |
|---|---|
| `pdf.pages` | exactly one page |
| `pdf.fill` | text fills at least 95% of the page height |
| `pdf.margins` | no text crosses the margins |
| `pdf.scale` | text never shrinks below ~8.3pt; trim content instead |
| `web.overflow` | nothing spills sideways at 360 / 768 / 1280 px |

Locally: `bun scripts/build-pdf.ts` (build + lint) or `--check` (lint only). Needs Chrome and poppler.
