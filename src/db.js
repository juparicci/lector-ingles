import { openDB } from 'idb';

const DB_NAME = 'lector-ingles-db';
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          const books = db.createObjectStore('books', { keyPath: 'id' });
          books.createIndex('dateAdded', 'dateAdded');
        }
        if (!db.objectStoreNames.contains('vocabulary')) {
          const vocab = db.createObjectStore('vocabulary', { keyPath: 'id' });
          vocab.createIndex('word', 'word');
          vocab.createIndex('dateAdded', 'dateAdded');
          vocab.createIndex('nextReview', 'srs.nextReview');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

function uid() {
  return crypto.randomUUID();
}

// ---------- Books ----------

export async function saveBook(book) {
  const db = await getDB();
  await db.put('books', book);
  return book;
}

export async function getBook(id) {
  const db = await getDB();
  return db.get('books', id);
}

export async function getAllBooks() {
  const db = await getDB();
  const all = await db.getAll('books');
  return all.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
}

export async function deleteBook(id) {
  const db = await getDB();
  await db.delete('books', id);
}

export async function updateBookProgress(id, currentPage) {
  const db = await getDB();
  const book = await db.get('books', id);
  if (!book) return;
  book.currentPage = currentPage;
  await db.put('books', book);
}

export function makeBookRecord({ title, type, pages, fontSize }) {
  return {
    id: uid(),
    title,
    type,
    pages, // array of { paragraphs: [{ tag, text }] }
    totalPages: pages.length,
    currentPage: 0,
    dateAdded: new Date().toISOString(),
    fontSize: fontSize || 100,
  };
}

// ---------- Vocabulary ----------

function defaultSRS() {
  return {
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    nextReview: new Date().toISOString(),
    lastReviewed: null,
  };
}

export async function saveVocabWord({ word, original, translation, context, bookId, bookTitle }) {
  const db = await getDB();
  const normalized = word.toLowerCase();

  const existing = await db.getFromIndex('vocabulary', 'word', normalized);
  if (existing) {
    return existing;
  }

  const entry = {
    id: uid(),
    word: normalized,
    original,
    translation,
    context,
    bookId,
    bookTitle,
    dateAdded: new Date().toISOString(),
    srs: defaultSRS(),
  };
  await db.put('vocabulary', entry);
  return entry;
}

export async function getAllVocab() {
  const db = await getDB();
  const all = await db.getAll('vocabulary');
  return all.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
}

export async function isWordSaved(word) {
  const db = await getDB();
  const entry = await db.getFromIndex('vocabulary', 'word', word.toLowerCase());
  return !!entry;
}

export async function getSavedWordsSet() {
  const all = await getAllVocab();
  return new Set(all.map((v) => v.word));
}

export async function deleteVocabWord(id) {
  const db = await getDB();
  await db.delete('vocabulary', id);
}

export async function updateVocabSRS(id, srsPatch) {
  const db = await getDB();
  const entry = await db.get('vocabulary', id);
  if (!entry) return;
  entry.srs = { ...entry.srs, ...srsPatch };
  await db.put('vocabulary', entry);
  return entry;
}

export async function getDueVocab(limit = Infinity) {
  const all = await getAllVocab();
  const now = new Date();
  const due = all.filter((v) => new Date(v.srs.nextReview) <= now);
  due.sort((a, b) => new Date(a.srs.nextReview) - new Date(b.srs.nextReview));
  return isFinite(limit) ? due.slice(0, limit) : due;
}

// ---------- Settings ----------

export async function getSetting(key, fallback = null) {
  const db = await getDB();
  const row = await db.get('settings', key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = await getDB();
  await db.put('settings', { key, value });
}
