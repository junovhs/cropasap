# Vendored fonts

Fonts are served from our own origin rather than a CDN, so the app makes no
third-party requests at runtime. Both files are variable fonts — one file covers
every weight the CSS asks for.

| File | Family | Role | Axes |
|---|---|---|---|
| `geist.woff2` | Geist | words: interface copy, controls, headings | `wght 100..900` |
| `geist-mono.woff2` | Geist Mono | machine facts: pixels, ratios, sizes, formats, filenames, keys, section labels | `wght 100..900` |

Both are © 2023 Vercel, in collaboration with basement.studio, licensed under
the SIL Open Font License 1.1 — see `OFL.txt`. They are the same files Ishoo
ships, so the Strange Systems apps share one typeface.

`@font-face` declarations live at the top of `../styles.css` and in
`../docs-theme.css`. Every family declares a real fallback stack, so the
interface stays legible if a file is ever missing. `scripts/build-static.mjs`
copies this whole directory into `dist/`.
