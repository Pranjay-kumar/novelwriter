export function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function sentenceSplit(text) {
  return text
    .replace(/([.!?])\s+/g, "$1|")
    .split("|")
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function tokenize(sentence) {
  return sentence
    .replace(/[\n\r]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function chunkify(text, desiredSize, adaptive = true) {
  const sentences = sentenceSplit(text);
  const chunks = [];
  let carry = [];

  const pushChunk = (tokens) => {
    if (!tokens.length) return;
    chunks.push(tokens.join(" "));
  };

  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    let cursor = 0;
    while (cursor < tokens.length) {
      const remaining = tokens.length - cursor;
      const sliceSize = Math.min(
        desiredSize,
        remaining < Math.ceil(desiredSize / 2) && carry.length
          ? desiredSize - carry.length
          : desiredSize
      );
      const piece = tokens.slice(cursor, cursor + sliceSize);
      carry.push(...piece);
      if (carry.length >= desiredSize) {
        pushChunk(carry.splice(0));
      }
      cursor += sliceSize;
    }
  }

  if (carry.length) {
    pushChunk(carry);
  }

  if (!adaptive || chunks.length < 2) {
    return chunks;
  }

  const averageLength =
    chunks.reduce((sum, chunk) => sum + tokenize(chunk).length, 0) / chunks.length;

  if (averageLength < desiredSize * 0.75) {
    return mergeSmallChunks(chunks, desiredSize);
  }

  return chunks;
}

function mergeSmallChunks(chunks, desiredSize) {
  const merged = [];
  let buffer = [];

  for (const chunk of chunks) {
    const tokens = tokenize(chunk);
    if (buffer.length + tokens.length <= desiredSize + Math.floor(desiredSize / 2)) {
      buffer = buffer.concat(tokens);
      continue;
    }
    if (buffer.length) {
      merged.push(buffer.join(" "));
    }
    buffer = tokens;
  }

  if (buffer.length) {
    merged.push(buffer.join(" "));
  }

  return merged;
}

export function stripPunctuation(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'.,!?;:()\-\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function damerauLevenshtein(a, b) {
  const lenA = a.length;
  const lenB = b.length;
  const maxDist = lenA + lenB;
  const dist = Array.from({ length: lenA + 2 }, () => new Array(lenB + 2).fill(0));
  const da = new Map();

  dist[0][0] = maxDist;

  for (let i = 0; i <= lenA; i += 1) {
    dist[i + 1][0] = maxDist;
    dist[i + 1][1] = i;
  }

  for (let j = 0; j <= lenB; j += 1) {
    dist[0][j + 1] = maxDist;
    dist[1][j + 1] = j;
  }

  for (let i = 1; i <= lenA; i += 1) {
    let db = 0;
    for (let j = 1; j <= lenB; j += 1) {
      const i1 = da.get(b[j - 1]) || 0;
      const j1 = db;
      let cost = 1;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        db = j;
      }
      dist[i + 1][j + 1] = Math.min(
        dist[i][j] + cost,
        dist[i + 1][j] + 1,
        dist[i][j + 1] + 1,
        dist[i1][j1] + (i - i1 - 1) + 1 + (j - j1 - 1)
      );
    }
    da.set(a[i - 1], i);
  }

  return dist[lenA + 1][lenB + 1];
}

export function scoreChunk(expected, typed) {
  const cleanExpected = stripPunctuation(expected);
  const cleanTyped = stripPunctuation(typed);
  if (!cleanExpected) {
    return { accuracy: 1, distance: 0 };
  }
  const distance = damerauLevenshtein(cleanExpected, cleanTyped);
  const accuracy = Math.max(0, 1 - distance / Math.max(cleanExpected.length, 1));
  return { accuracy, distance };
}

export function highlightDifferences(expected, typed) {
  const expTokens = expected.split(/(\s+)/);
  const typedTokens = typed.split(/(\s+)/);
  const result = [];

  for (let i = 0; i < expTokens.length; i += 1) {
    const token = expTokens[i];
    if (/^\s+$/.test(token)) {
      result.push({ text: token, status: "space" });
      continue;
    }
    const typedToken = typedTokens[i] || "";
    if (stripPunctuation(token) === stripPunctuation(typedToken)) {
      result.push({ text: token, status: "correct" });
    } else if (stripPunctuation(typedToken)) {
      result.push({ text: token, status: "error" });
    } else {
      result.push({ text: token, status: "future" });
    }
  }

  return result;
}
