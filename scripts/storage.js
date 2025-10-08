const STORAGE_KEY = "type-to-read-state-v1";

const clone = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const defaultState = {
  settings: {
    theme: "light",
    fontFamily: "sans",
    fontScale: 1,
    letterSpacing: 0.02,
    wordSpacing: 0.08,
    lineHeight: 1.8,
    mode: "flow",
    chunkSize: 9,
    accuracyThreshold: 0.92,
  },
  library: [],
  sessions: [],
  stumbleWords: {},
  activeBookId: null,
  lastView: "library",
};

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return clone(defaultState);
    }
    const parsed = JSON.parse(stored);
    return {
      ...clone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      stumbleWords: parsed.stumbleWords || {},
    };
  } catch (error) {
    console.warn("Failed to parse saved state", error);
    return clone(defaultState);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist state", error);
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return clone(defaultState);
}

export function getDefaultState() {
  return clone(defaultState);
}
