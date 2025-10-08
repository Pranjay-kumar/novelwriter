# Type-to-Read Novel App

This repository contains a zero-dependency browser MVP of the Type-to-Read Novel App. It follows the product requirements captured in [`docs/product_spec.md`](docs/product_spec.md) and prioritises being runnable anywhere without a build toolchain.

## Running the MVP

No package installation or build step is required; everything is bundled into plain HTML, CSS, and JavaScript files. You have two easy options to launch the app:

1. **Open the file directly** – double-click `index.html` (or drag it into your browser window). This works on any desktop platform and is the fastest way to try the experience.
2. **Serve the folder locally** – if you prefer a local web address (useful for mobile testing or service worker caching), run a static file server from the repository root:

   ```bash
   python -m http.server 3000
   ```

   Then visit `http://localhost:3000/` in your browser. Any similar static server tool (e.g., `npx serve`, `ruby -run -ehttpd .`, `python -m http.server`) will work as well.

Once the page is open, the app loads the sample library automatically. You can import additional `.txt` books via **Library → Import Text**, and your progress is saved in `localStorage`, so subsequent runs will pick up where you left off—even offline.

## Feature overview

* Curated sample library from public-domain classics plus support for importing `.txt` files.
* Type-to-advance reader with adaptive chunking, fuzzy accuracy scoring, stumble-word surfacing, and configurable thresholds.
* Session summaries with rolling statistics (accuracy, WPM, duration) and a stumble-word leaderboard.
* Reader settings for theme, fonts (including OpenDyslexic), spacing, and chunk sizing with persistence via `localStorage`.
* Keyboard-friendly navigation and offline-capable storage—once loaded, the app and your data remain available without a network connection.

Refer to the product specification for the broader roadmap and non-functional requirements targeted by the MVP.

## Branch structure

All development branches are now merged into the `main` branch. If you cloned this repository before the consolidation, make sure to `git checkout main`
and pull the latest changes. The historical `work` branch currently points to the same tip for continuity but will no longer receive updates.
