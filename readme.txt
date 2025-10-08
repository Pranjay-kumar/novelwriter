# Type-to-Read Novel App

This repository contains a zero-dependency browser MVP of the Type-to-Read Novel App. It follows the product requirements captured in [`docs/product_spec.md`](docs/product_spec.md) and prioritises being runnable anywhere without a build toolchain.

## Running the MVP

No npm install is required. Open `index.html` in any modern browser (Chromium, Firefox, or Safari) or serve the folder with a lightweight static server:

```bash
python -m http.server 3000
```

Then browse to `http://localhost:3000/`.

## Feature overview

* Curated sample library from public-domain classics plus support for importing `.txt` files.
* Type-to-advance reader with adaptive chunking, fuzzy accuracy scoring, stumble-word surfacing, and configurable thresholds.
* Session summaries with rolling statistics (accuracy, WPM, duration) and a stumble-word leaderboard.
* Reader settings for theme, fonts (including OpenDyslexic), spacing, and chunk sizing with persistence via `localStorage`.
* Keyboard-friendly navigation and offline-capable storage—once loaded, the app and your data remain available without a network connection.

Refer to the product specification for the broader roadmap and non-functional requirements targeted by the MVP.
