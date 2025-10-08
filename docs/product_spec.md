# Type-to-Read Novel App — Product Spec (v0.1)

## 1. One-liner

A distraction-free reading app where users *type to progress* through a book, turning passive reading into active recall to improve comprehension, retention, and focus.

---

## 2. Goals & Non-Goals

**Primary goals (MVP):**

- Improve reading focus and comprehension via type-to-advance interaction.
- Provide immediate, low-friction feedback (accuracy, WPM, stumble words).
- Support DRM-free imports (TXT/EPUB) and a curated public-domain library.

**Secondary goals (v1.x):**

- Vocabulary tracking + spaced repetition for "stumble words."
- Lightweight annotations (highlights, notes).
- Basic class/coach sharing: progress snapshots, not raw text.

**Non-goals (MVP):**

- Hosting copyrighted/DRM-protected books.
- Social network, comments, or live co-reading.
- Heavy gamification or badges beyond simple streaks/goals.

---

## 3. Target Users & Use Cases

**Personas:**

- **Focused Reader**: wants to reduce doom-scroll attention drift.
- **Language Learner**: needs vocabulary support and pacing.
- **Educator/Coach**: assigns chapters, monitors progress trends.

**Core scenarios:**

1. Import a DRM-free EPUB and complete a 20-minute focused session.
2. Read in small chunks (5–15 words) and auto-advance on correct typing.
3. Review "stumble words" (frequent errors/hesitations) post-session.
4. Toggle assistive features (font, spacing, overlays, TTS per sentence).

---

## 4. Success Metrics (MVP)

- **Activation**: ≥70% of new users complete onboarding + first 10-minute session.
- **Focus proxy**: median chunk dwell time variance ↓ vs first session (learning curve).
- **Learning proxy**: ≥20% reduction in repeat errors on the same chapter within 3 sessions.
- **Retention**: D7 return rate ≥25% for first-time readers.

---

## 5. Functional Requirements (MVP)

1. **Library & Import**
   - Import `.txt` and `.epub` (no DRM). Parse into chapters → paragraphs → sentences → token chunks (5–15 words, configurable).
   - Built-in catalog of public-domain titles (e.g., Gutenberg mirror references only; fetch and process client-side where possible).
2. **Typing Loop**
   - Show next chunk; user types; fuzzy-match tolerance based on Damerau–Levenshtein distance and word alignment.
   - Auto-advance on match ≥ threshold (default 95% per-word, normalized for punctuation and case).
   - Real-time indicators: per-word correctness, caret position, optional predictive greyed text (Preview Mode).
3. **Feedback & Telemetry**
   - Per-session stats: WPM, accuracy, time-on-task, error heatmap per token.
   - "Stumble words" captured when (i) edit distance > threshold or (ii) dwell time > X ms.
   - Post-session review list with quick lookup/flashcard actions.
4. **Assistive Features**
   - Fonts: System, Dyslexia-friendly (OpenDyslexic), serif/sans; adjustable size, letter/word spacing, line height.
   - Color themes: light, dark, sepia; optional color overlays.
   - TTS (per sentence) with playback speed and voice selection (local/browser API where available).
   - Translation/dictionary inline popover (local/offline dictionaries preferred; pluggable provider).
5. **Pacing & Modes**
   - **Flow Mode**: hide upcoming characters; reveal only as typed.
   - **Preview Mode**: display full chunk; grey out next words until typed.
   - Adjustable chunk length or target WPM; adaptive chunking based on recent error/dwell.
6. **Annotations (v1.0 minimal)**
   - Highlight selection; add note; export notes per book as markdown/CSV.
7. **Privacy & Storage**
   - By default, keep full text client-side (IndexedDB). Sync (optional) stores *metadata only* (progress, stats, word lists); never store copyrighted text.

---

## 6. Non-Functional Requirements

- **Performance**: typing feedback within ≤16ms frame budget; initial book parse <5s for 1MB EPUB on mid-tier laptop; service worker for offline use.
- **Security**: text remains local unless user opts in; PII-free analytics; encrypted at rest for cloud-synced metadata.
- **Accessibility (WCAG 2.2 AA)**: keyboard-only navigation, ARIA roles, sufficient contrast, font/spacing controls, screen-reader compatibility.
- **Cross-platform**: modern Chromium/Firefox/Safari; PWA install; mobile-first responsive design.

---

## 7. System Architecture (MVP)

- **Client (Web/PWA)**: React (or Svelte) UI, Web Workers for diff/align; IndexedDB for text and progress; Service Worker for offline.
- **Optional Backend**: Lightweight API for auth, settings sync, and telemetry aggregation (no copyrighted text).
- **Integrations**: TTS via Web Speech API; optional dictionary provider; EPUB.js (or custom) for parsing.

**High-level flow:**

1. Import/Select Book → Parse → Chunkify → Session Engine.
2. Typing Engine (worker): tokenization → fuzzy match → scoring → UI events.
3. Telemetry: per token event → session roll-up → local store → (optional) sync.

---

## 8. Data Model (MVP)

```yaml
User:
  id: string
  settings:
    theme: enum{light,dark,sepia}
    font: enum{system,serif,sans,opendyslexic}
    spacing: {letter:number, word:number, line:number}
    tts: {enabled:boolean, rate:number, voice:string}
    privacy: {cloudSync:boolean}

Book:
  id: string
  title: string
  author: string
  source: enum{imported,public_domain}
  manifest: {chapters: ChapterRef[]}
  local_path: string  # IndexedDB key

ChapterRef:
  id: string
  startOffset: number
  endOffset: number

Session:
  id: string
  userId: string
  bookId: string
  chapterId: string
  startedAt: datetime
  durationMs: number
  stats: {wpm:number, accuracy:number, chunks:number}

TokenEvent:
  id: string
  sessionId: string
  tokenId: string
  typed:string
  expected:string
  dtMs:number
  editDistance:number
  correct:boolean

StumbleWord:
  userId: string
  term:string
  count:int
  lastSeenAt: datetime
```

---

## 9. Core Algorithms

**Chunking**

- Tokenize sentences → words → merge into 5–15 word windows respecting punctuation and hyphenation; adaptive shrink on recent error spikes.

**Fuzzy Matching (Worker)**

- Normalize: lowercase, strip punctuation (configurable), collapse whitespace.
- Align typed to expected with Damerau–Levenshtein; per-word alignment by greedy split + dynamic programming fallback.
- Score = 1 − (editDistance / max(len(expected), 1)).
- Advance when all words score ≥ threshold OR global score ≥ threshold and no *critical* words (proper nouns) below secondary threshold.

**Stumble Detection**

- Mark if (editDistance > τ) OR (dtMs > μ + k·σ over last N tokens) OR backspace burst > B.
- Add to user’s StumbleWord with lemmatized key.

---

## 10. UX Flows (MVP)

1. **Onboarding**: pick a sample chapter → pick font/theme → 60-sec tutorial → first session starts.
2. **Reading**: minimal chrome (progress bar, time, accuracy); ESC → quick settings; hold SPACE to peek next chunk (if in Flow Mode).
3. **Session End**: stats, stumble list, quick review (TTS or re-type), set next goal.
4. **Library**: grid of books with last progress; import button; search by title/author.

---

## 11. Accessibility & Internationalization

- RTL support; IME-friendly input (CJK); diacritics-aware matching; per-language tokenization (TinySegmenter/Intl.Segmenter where available).
- Keyboard shortcuts: Tab to advance (when eligible), Ctrl+/ help, +/- font size.

---

## 12. Content & Licensing

- Public domain sources (e.g., Gutenberg). For user imports, process locally; do not upload or cache server-side without explicit consent.
- Provide license attributions for included dictionaries or TTS voices if required.

---

## 13. Analytics & Privacy

- Collect only aggregate, non-text telemetry (session durations, error rates) unless user opts in.
- Provide local-only mode; clear data control; export/delete account functions.

---

## 14. Edge Cases & Risks

- **IME composition**: ensure no premature validation while composing characters.
- **Hyphenation/ligatures**: normalize to canonical forms; avoid punishing typographic quirks.
- **Performance**: long chapters must stream chunk data; precompute next N chunks in worker.
- **Legal**: never store copyrighted text in cloud; validate import to detect DRM and warn.

---

## 15. Roadmap

- **MVP (4–6 weeks dev)**: import + typing loop + stats + minimal assistive settings + local storage + 3 sample books.
- **v1.1**: spaced repetition for stumble words; notes export; basic TTS.
- **v1.2**: educator snapshot links; simple assignments; share progress (no text).
- **v1.3**: mobile polish, offline dictionary packs, translation gloss.

---

## 16. Acceptance Criteria (MVP)

- Can import a DRM-free `.epub` and complete a session with real-time fuzzy matching; advance occurs with ≤150ms latency on a 5-year-old laptop.
- Stats screen shows WPM, accuracy, and ≥3 most frequent stumble words.
- User can toggle font, spacing, theme, chunk length; settings persist.
- Works offline after first load; re-opens last book at exact position.
- Text never leaves device in local-only mode; telemetry opt-in is off by default.

---

## 17. Interfaces (Sketch)

**Parsing Service (client)**

```ts
parseEpub(file: File): Promise<Book>
chunkify(bookId: string, options: {chunkSize:number; adapt:boolean}): AsyncIterable<Chunk>
```

**Typing Engine (worker)**

```ts
initSession(bookId: string, chapterId: string): Promise<Session>
score(typed: string, expected: string, opts: ScoreOpts): ScoreResult
next(): Chunk  // returns next expected chunk
```

**Sync API (optional backend)**

```http
POST /v1/auth/signup | login
GET  /v1/user/settings
PUT  /v1/user/settings
GET  /v1/books/:id/progress (metadata only)
PUT  /v1/books/:id/progress
POST /v1/telemetry/sessions
```

---

## 18. Open Questions

1. What default chunk size best balances flow vs. friction for different languages?
2. Should proper nouns be "critical words" by default?
3. How strict should punctuation be in scoring for language learners?
4. Which offline dictionary licenses fit redistribution in a PWA?
5. Is mobile haptic feedback desirable or distracting during typing?

---

## 19. Glossary

- **Chunk**: contiguous 5–15 word span presented for typing.
- **Stumble Word**: term frequently mistyped or hesitated on; eligible for review.
- **Flow Mode**: reveal only what the user correctly types; no look-ahead.
- **Preview Mode**: show full chunk but gate progress on correctness.
