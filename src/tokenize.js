// Splits into tokens, keeping words and separators (spaces, punctuation) separate.
// A "word" token is one that contains at least one letter.
const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

export function tokenizeParagraph(text) {
  const tokens = [];
  let lastIndex = 0;
  let match;
  WORD_RE.lastIndex = 0;
  while ((match = WORD_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: 'word', value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return tokens;
}

export function normalizeWord(word) {
  return word.toLowerCase().replace(/['’]s$/, '');
}

// Finds the sentence containing the character offset `wordIndex` within `text`.
const SENTENCE_RE = /[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g;

export function sentenceContaining(text, charOffset) {
  SENTENCE_RE.lastIndex = 0;
  let match;
  while ((match = SENTENCE_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (charOffset >= start && charOffset < end) {
      return match[0].trim();
    }
  }
  return text.trim();
}
