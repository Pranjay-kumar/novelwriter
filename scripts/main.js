import { sampleBooks } from "../data/sampleBooks.js";
import {
  chunkify,
  highlightDifferences,
  scoreChunk,
  stripPunctuation,
} from "./text.js";
import { loadState, saveState, getDefaultState } from "./storage.js";

const app = document.getElementById("app");
const fallback = document.getElementById("app-fallback");
if (fallback) {
  fallback.remove();
}
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));

let state = initializeState();
let session = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initializeState() {
  const loaded = loadState();
  const hasLibrary = loaded.library && loaded.library.length > 0;
  const allowedFonts = new Set(["sans", "serif", "opendyslexic"]);
  if (!allowedFonts.has(loaded.settings.fontFamily)) {
    loaded.settings.fontFamily = "sans";
  }
  if (!hasLibrary) {
    const seeded = sampleBooks.map((book, index) => ({
      ...book,
      source: "sample",
      createdAt: Date.now() - index * 1000,
      lastChunk: 0,
      totalChunks: 0,
      lastReadAt: null,
      completed: false,
    }));
    loaded.library = seeded;
  } else {
    loaded.library = loaded.library.map((book) => ({
      lastChunk: 0,
      totalChunks: 0,
      lastReadAt: null,
      completed: false,
      ...book,
    }));
  }

  applySettings(loaded.settings);
  return loaded;
}

function applySettings(settings) {
  document.body.dataset.theme = settings.theme;
  document.body.dataset.font = settings.fontFamily;
  document.documentElement.style.setProperty("--reader-size", `${1.35 * settings.fontScale}rem`);
  document.documentElement.style.setProperty("--reader-line", settings.lineHeight);
  document.documentElement.style.setProperty("--reader-letter", `${settings.letterSpacing}em`);
  document.documentElement.style.setProperty("--reader-word", `${settings.wordSpacing}em`);
}

function setView(view) {
  state.lastView = view;
  saveState(state);
  render();
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    if (view === "reader" && !state.activeBookId) {
      showDialog("Choose a book from your library before starting a session.");
      return;
    }
    setView(view);
  });
});

function render() {
  navButtons.forEach((btn) => {
    btn.setAttribute("aria-current", btn.dataset.view === state.lastView ? "page" : "false");
  });

  switch (state.lastView) {
    case "library":
      renderLibrary();
      break;
    case "reader":
      renderReader();
      break;
    case "stats":
      renderStats();
      break;
    case "settings":
      renderSettings();
      break;
    default:
      state.lastView = "library";
      renderLibrary();
  }
}

function renderLibrary() {
  const books = state.library;
  const activeId = state.activeBookId;

  const tiles = books
    .map((book) => {
      const completedChunks = Math.min(book.lastChunk || 0, book.totalChunks || 0);
      const progress = book.totalChunks
        ? Math.min(100, Math.round((completedChunks / book.totalChunks) * 100))
        : 0;
      const progressLabel = book.completed
        ? "Finished"
        : book.totalChunks
        ? `${progress}% read`
        : "Not started";
      const actionLabel = book.completed ? "Restart" : book.id === activeId ? "Resume" : "Start";
      return `
        <article class="book-tile" tabindex="0" data-id="${book.id}">
          <div>
            <h3>${escapeHtml(book.title)}</h3>
            <div class="book-meta">${escapeHtml(book.author)}</div>
          </div>
          <p>${escapeHtml(book.description || "")}</p>
          <div class="book-meta">${progressLabel}</div>
          <div class="form-row">
            <button class="primary-btn" data-action="start" data-id="${book.id}">
              ${actionLabel}
            </button>
            <button class="secondary-btn" data-action="remove" data-id="${book.id}" ${
              book.source === "sample" ? "disabled" : ""
            }>Remove</button>
          </div>
        </article>
      `;
    })
    .join("");

  app.innerHTML = `
    <section class="card">
      <header>
        <h2>Your Library</h2>
        <p class="book-meta">Import plain text books or use the curated public-domain selections.</p>
      </header>
      <div class="grid two" role="list">${tiles}</div>
    </section>
    <section class="card">
      <h2>Import a book</h2>
      <form id="import-form" class="grid">
        <label>
          Choose a .txt file
          <input type="file" accept=".txt" required />
        </label>
        <label>
          Title (optional)
          <input type="text" name="title" placeholder="My Custom Story" />
        </label>
        <label>
          Author (optional)
          <input type="text" name="author" placeholder="Unknown" />
        </label>
        <button type="submit" class="primary-btn">Import</button>
      </form>
    </section>
  `;

  const importForm = document.getElementById("import-form");
  importForm.addEventListener("submit", handleImportSubmit);

  app.querySelectorAll("[data-action='start']").forEach((btn) =>
    btn.addEventListener("click", () => startSession(btn.dataset.id))
  );

  app.querySelectorAll("[data-action='remove']").forEach((btn) =>
    btn.addEventListener("click", () => removeBook(btn.dataset.id))
  );

  app.querySelectorAll(".book-tile").forEach((tile) =>
    tile.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        startSession(tile.dataset.id);
      }
    })
  );
}

function handleImportSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const fileInput = form.querySelector("input[type='file']");
  const file = fileInput.files[0];
  if (!file) {
    showDialog("Please choose a text file to import.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    if (!text || typeof text !== "string" || stripPunctuation(text).length < 10) {
      showDialog("The selected file does not contain enough text.");
      return;
    }
    const title = form.title.value.trim() || file.name.replace(/\.txt$/i, "");
    const author = form.author.value.trim() || "Unknown";
    addBook({
      id: createId(title),
      title,
      author,
      description: "Imported text",
      text,
      source: "imported",
    });
    fileInput.value = "";
    form.title.value = "";
    form.author.value = "";
    showDialog(`Imported "${title}" successfully.`);
  };
  reader.onerror = () => {
    showDialog("Failed to read the selected file.");
  };
  reader.readAsText(file);
}

function createId(text) {
  const base =
    stripPunctuation(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `book-${Date.now()}`;
  let candidate = base;
  let counter = 2;
  const ids = new Set(state.library.map((book) => book.id));
  while (ids.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function addBook(book) {
  state.library.unshift({
    ...book,
    createdAt: Date.now(),
    lastChunk: 0,
    totalChunks: 0,
    lastReadAt: null,
    completed: false,
  });
  saveState(state);
  renderLibrary();
}

function removeBook(bookId) {
  const index = state.library.findIndex((book) => book.id === bookId);
  if (index === -1) return;
  if (state.library[index].source === "sample") {
    showDialog("Sample books cannot be removed.");
    return;
  }
  state.library.splice(index, 1);
  if (state.activeBookId === bookId) {
    state.activeBookId = null;
    session = null;
  }
  saveState(state);
  renderLibrary();
}

function startSession(bookId) {
  const book = state.library.find((item) => item.id === bookId);
  if (!book) return;

  state.activeBookId = bookId;
  const chunkSize = Math.max(3, Math.min(25, state.settings.chunkSize));
  const chunks = chunkify(book.text, chunkSize, true);
  if (!chunks.length) {
    showDialog("This book does not contain any readable text chunks yet.");
    return;
  }
  const resumeIndex = book.completed
    ? 0
    : Math.min(book.lastChunk || 0, Math.max(chunks.length - 1, 0));
  if (book.completed) {
    book.lastChunk = 0;
    book.completed = false;
  }
  book.totalChunks = chunks.length;
  session = {
    id: `session-${Date.now()}`,
    bookId,
    chunks,
    chunkIndex: resumeIndex,
    typed: "",
    startedAt: Date.now(),
    chunkStartedAt: Date.now(),
    entries: [],
    completed: false,
  };
  state.lastView = "reader";
  saveState(state);
  render();
}

function getActiveSession() {
  if (!session && state.activeBookId) {
    startSession(state.activeBookId);
  }
  return session;
}

function renderReader() {
  const activeSession = getActiveSession();
  if (!activeSession) {
    app.innerHTML = `
      <section class="card">
        <h2>No book selected</h2>
        <p>Select a title from your library to begin typing.</p>
        <button class="primary-btn" id="back-to-library">Go to Library</button>
      </section>
    `;
    document.getElementById("back-to-library").addEventListener("click", () => setView("library"));
    return;
  }

  const book = state.library.find((item) => item.id === activeSession.bookId);
  const expected = activeSession.chunks[activeSession.chunkIndex] || "";
  const typed = activeSession.typed || "";
  const { accuracy } = scoreChunk(expected, typed);
  const highlight = highlightDifferences(expected, typed);
  const canAdvance = accuracy >= state.settings.accuracyThreshold && stripPunctuation(typed).length >= stripPunctuation(expected).length * 0.6;
  const percent = (() => {
    const bookProgress = state.library.find((item) => item.id === activeSession.bookId);
    if (!bookProgress || !bookProgress.totalChunks) return 0;
    const completedChunks = Math.min(bookProgress.lastChunk || 0, bookProgress.totalChunks);
    return Math.min(100, Math.round((completedChunks / bookProgress.totalChunks) * 100));
  })();

  const highlightHtml = highlight
    .map(({ text, status }) => {
      if (status === "space") return text;
      return `<span class="${status}">${escapeHtml(text)}</span>`;
    })
    .join("");

  const stumbleList = Object.entries(state.stumbleWords)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([word, info]) => `<span class="stumble-tag">${escapeHtml(word)} · ${info.count}</span>`)
    .join(" ");

  app.innerHTML = `
    <section class="card reader-shell">
      <header>
        <div class="form-row" style="justify-content: space-between; align-items: flex-start;">
          <div>
            <h2>${escapeHtml(book.title)}</h2>
            <div class="book-meta">${escapeHtml(book.author)}</div>
          </div>
          <div class="book-meta">Progress: ${percent}%</div>
        </div>
      </header>
      <div class="chunk-preview" data-mode="${state.settings.mode}">${highlightHtml}</div>
      <textarea class="type-input" id="type-area" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Start typing to reveal the next words...">${escapeHtml(typed)}</textarea>
      <div class="feedback-bar">
        <div>Accuracy: <strong>${Math.round(accuracy * 100)}%</strong></div>
        <div>Chunk ${activeSession.chunkIndex + 1} of ${activeSession.chunks.length}</div>
      </div>
      <div class="form-row">
        <button class="primary-btn" id="advance-btn" ${canAdvance ? "" : "disabled"}>Next chunk</button>
        <button class="secondary-btn" id="finish-btn">End session</button>
        <button class="secondary-btn" id="reset-input">Reset chunk</button>
      </div>
      ${
        stumbleList
          ? `<div><h3>Recent stumble words</h3><div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(120px, auto));">${stumbleList}</div></div>`
          : ""
      }
    </section>
  `;

  const typeArea = document.getElementById("type-area");
  typeArea.focus();
  typeArea.selectionStart = typeArea.value.length;
  typeArea.selectionEnd = typeArea.value.length;

  typeArea.addEventListener("input", () => {
    activeSession.typed = typeArea.value;
    renderReader();
  });

  document.getElementById("advance-btn").addEventListener("click", () => {
    if (!canAdvance) return;
    advanceChunk(activeSession, { accuracy });
  });

  document.getElementById("finish-btn").addEventListener("click", () => finishSession(false));
  document.getElementById("reset-input").addEventListener("click", () => {
    activeSession.typed = "";
    activeSession.chunkStartedAt = Date.now();
    renderReader();
  });
}

function advanceChunk(activeSession, { accuracy }) {
  const expected = activeSession.chunks[activeSession.chunkIndex] || "";
  const typed = activeSession.typed;
  const now = Date.now();
  const duration = now - activeSession.chunkStartedAt;
  const tokenCount = stripPunctuation(expected).split(" ").filter(Boolean).length;
  const wpm = duration > 0 ? Math.round((tokenCount / (duration / 1000 / 60)) * 100) / 100 : 0;

  const entry = {
    chunkIndex: activeSession.chunkIndex,
    expected,
    typed,
    accuracy,
    duration,
    wpm,
  };
  activeSession.entries.push(entry);

  if (accuracy < state.settings.accuracyThreshold) {
    registerStumbles(expected, typed);
  }

  activeSession.chunkIndex += 1;
  activeSession.typed = "";
  activeSession.chunkStartedAt = now;

  if (activeSession.chunkIndex >= activeSession.chunks.length) {
    finishSession(true);
  } else {
    updateProgress(activeSession);
    renderReader();
  }
}

function registerStumbles(expected, typed) {
  const expectedWords = expected.split(/\s+/);
  const typedWords = typed.split(/\s+/);
  expectedWords.forEach((word, index) => {
    const expectedClean = stripPunctuation(word);
    if (!expectedClean) return;
    const typedClean = stripPunctuation(typedWords[index] || "");
    if (expectedClean !== typedClean) {
      const record = state.stumbleWords[expectedClean] || { count: 0, lastSeenAt: null };
      record.count += 1;
      record.lastSeenAt = Date.now();
      state.stumbleWords[expectedClean] = record;
    }
  });
}

function updateProgress(activeSession) {
  const book = state.library.find((item) => item.id === activeSession.bookId);
  if (!book) return;
  book.totalChunks = activeSession.chunks.length;
  const nextIndex = Math.min(activeSession.chunkIndex, activeSession.chunks.length);
  book.lastChunk = nextIndex;
  book.completed = nextIndex >= activeSession.chunks.length && activeSession.chunks.length > 0;
  book.lastReadAt = Date.now();
  saveState(state);
}

function finishSession(completedAll) {
  if (!session) return;
  const activeSession = session;
  const now = Date.now();
  const durationMs = now - activeSession.startedAt;
  const averageAccuracy =
    activeSession.entries.reduce((sum, item) => sum + item.accuracy, 0) /
      (activeSession.entries.length || 1);
  const averageWpm =
    activeSession.entries.reduce((sum, item) => sum + item.wpm, 0) /
    (activeSession.entries.length || 1);

  const summary = {
    id: activeSession.id,
    bookId: activeSession.bookId,
    startedAt: activeSession.startedAt,
    durationMs,
    accuracy: Number(averageAccuracy.toFixed(3)),
    wpm: Number(averageWpm.toFixed(1)),
    chunks: activeSession.entries.length,
    completedAll,
  };

  state.sessions.unshift(summary);
  updateProgress(activeSession);
  session = null;

  saveState(state);
  showDialog("Session saved. Great job!", () => {
    setView("stats");
  });
}

function renderStats() {
  const totals = state.sessions.reduce(
    (acc, session) => {
      acc.totalSessions += 1;
      acc.totalDuration += session.durationMs;
      acc.totalChunks += session.chunks;
      acc.avgAccuracy += session.accuracy;
      acc.avgWpm += session.wpm;
      return acc;
    },
    { totalSessions: 0, totalDuration: 0, totalChunks: 0, avgAccuracy: 0, avgWpm: 0 }
  );

  const averageAccuracy = totals.totalSessions ? totals.avgAccuracy / totals.totalSessions : 0;
  const averageWpm = totals.totalSessions ? totals.avgWpm / totals.totalSessions : 0;
  const averageDuration = totals.totalSessions ? totals.totalDuration / totals.totalSessions : 0;

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  };

  const rows = state.sessions
    .slice(0, 12)
    .map((session) => {
      const book = state.library.find((item) => item.id === session.bookId);
      const title = book ? book.title : "Unknown";
      return `
        <tr>
          <td>${new Date(session.startedAt).toLocaleString()}</td>
          <td>${escapeHtml(title)}</td>
          <td>${Math.round(session.accuracy * 100)}%</td>
          <td>${session.wpm}</td>
          <td>${session.chunks}</td>
          <td>${formatDuration(session.durationMs)}</td>
          <td>${session.completedAll ? "Yes" : "Partial"}</td>
        </tr>
      `;
    })
    .join("");

  const stumbleEntries = Object.entries(state.stumbleWords)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([word, info]) => `<span class="stumble-tag">${escapeHtml(word)} · ${info.count}</span>`)
    .join(" ");

  app.innerHTML = `
    <section class="card">
      <h2>Reading Stats</h2>
      <div class="stats-grid">
        <article class="stat-card">
          <div class="stat-label">Total sessions</div>
          <div class="stat-value">${totals.totalSessions}</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Avg accuracy</div>
          <div class="stat-value">${Math.round(averageAccuracy * 100)}%</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Avg WPM</div>
          <div class="stat-value">${Math.round(averageWpm)}</div>
        </article>
        <article class="stat-card">
          <div class="stat-label">Avg session length</div>
          <div class="stat-value">${formatDuration(averageDuration)}</div>
        </article>
      </div>
    </section>
    <section class="card">
      <h3>Recent sessions</h3>
      ${
        rows
          ? `<div class="table-wrapper"><table class="session-table"><thead><tr><th>When</th><th>Book</th><th>Accuracy</th><th>WPM</th><th>Chunks</th><th>Duration</th><th>Complete</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : "<p>No sessions yet. Start typing to see your progress.</p>"
      }
    </section>
    <section class="card">
      <h3>Frequent stumble words</h3>
      ${stumbleEntries || "<p>Great work! No stumble words recorded yet.</p>"}
    </section>
  `;
}

function renderSettings() {
  const settings = state.settings;
  app.innerHTML = `
    <section class="card">
      <h2>Reader Settings</h2>
      <form id="settings-form" class="grid">
        <div class="form-row">
          <label>Theme
            <select name="theme">
              <option value="light" ${settings.theme === "light" ? "selected" : ""}>Light</option>
              <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Dark</option>
            </select>
          </label>
          <label>Font family
            <select name="fontFamily">
              <option value="sans" ${settings.fontFamily === "sans" ? "selected" : ""}>Sans-serif</option>
              <option value="serif" ${settings.fontFamily === "serif" ? "selected" : ""}>Serif</option>
              <option value="opendyslexic" ${
                settings.fontFamily === "opendyslexic" ? "selected" : ""
              }>OpenDyslexic</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <label>Font scale
            <input type="range" min="0.8" max="1.6" step="0.05" name="fontScale" value="${settings.fontScale}" />
          </label>
          <label>Line height
            <input type="range" min="1.2" max="2.2" step="0.05" name="lineHeight" value="${settings.lineHeight}" />
          </label>
        </div>
        <div class="form-row">
          <label>Letter spacing
            <input type="range" min="0" max="0.2" step="0.005" name="letterSpacing" value="${settings.letterSpacing}" />
          </label>
          <label>Word spacing
            <input type="range" min="0" max="0.3" step="0.01" name="wordSpacing" value="${settings.wordSpacing}" />
          </label>
        </div>
        <div class="form-row">
          <label>Chunk size (words)
            <input type="range" min="4" max="18" step="1" name="chunkSize" value="${settings.chunkSize}" />
          </label>
          <label>Accuracy threshold
            <input type="range" min="0.7" max="1" step="0.01" name="accuracyThreshold" value="${settings.accuracyThreshold}" />
          </label>
        </div>
        <div class="form-row">
          <label>Mode
            <select name="mode">
              <option value="flow" ${settings.mode === "flow" ? "selected" : ""}>Flow mode</option>
              <option value="preview" ${settings.mode === "preview" ? "selected" : ""}>Preview mode</option>
            </select>
          </label>
        </div>
        <div class="form-row" style="justify-content: space-between;">
          <button type="submit" class="primary-btn">Save settings</button>
          <button type="button" class="secondary-btn" id="reset-settings">Reset to defaults</button>
        </div>
      </form>
    </section>
  `;

  const form = document.getElementById("settings-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const updated = {
      theme: formData.get("theme"),
      fontFamily: formData.get("fontFamily"),
      fontScale: Number(formData.get("fontScale")),
      lineHeight: Number(formData.get("lineHeight")),
      letterSpacing: Number(formData.get("letterSpacing")),
      wordSpacing: Number(formData.get("wordSpacing")),
      chunkSize: Number(formData.get("chunkSize")),
      accuracyThreshold: Number(formData.get("accuracyThreshold")),
      mode: formData.get("mode"),
    };
    state.settings = { ...state.settings, ...updated };
    applySettings(state.settings);
    saveState(state);
    showDialog("Settings saved.");
  });

  document.getElementById("reset-settings").addEventListener("click", () => {
    state.settings = getDefaultState().settings;
    applySettings(state.settings);
    saveState(state);
    renderSettings();
    showDialog("Settings restored to defaults.");
  });
}

function showDialog(message, onDismiss) {
  const root = document.getElementById("dialog-root");
  const safeMessage = escapeHtml(message);
  root.innerHTML = `
    <div role="alertdialog" class="card" style="position: fixed; right: 1.5rem; bottom: 1.5rem; max-width: 320px;">
      <p>${safeMessage}</p>
      <div class="form-row" style="justify-content: flex-end;">
        <button class="primary-btn" id="dialog-ok">Okay</button>
      </div>
    </div>
  `;
  let timer = null;
  const dismiss = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    root.innerHTML = "";
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  };
  document.getElementById("dialog-ok").addEventListener("click", dismiss);
  timer = setTimeout(dismiss, 4000);
}

window.addEventListener("beforeunload", () => {
  saveState(state);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && session) {
    finishSession(false);
  }
});

render();
