import { tokenizeParagraph, normalizeWord, sentenceContaining } from './tokenize.js';
import { translate } from './translate.js';
import { saveVocabWord, getSavedWordsSet } from './db.js';
import { isCommonWord } from './frequency.js';
import { speak } from './tts.js';

let popupEl = null;
let activeWordSpan = null;
let onSavedCallback = null;

function ensurePopup() {
  if (popupEl) return popupEl;
  popupEl = document.createElement('div');
  popupEl.className = 'translate-popup hidden';
  document.body.appendChild(popupEl);
  document.addEventListener('click', (e) => {
    if (popupEl.classList.contains('hidden')) return;
    if (popupEl.contains(e.target) || e.target.classList.contains('word')) return;
    hidePopup();
  });
  window.addEventListener('scroll', () => hidePopup(), true);
  return popupEl;
}

function hidePopup() {
  if (!popupEl) return;
  popupEl.classList.add('hidden');
  if (activeWordSpan) activeWordSpan.classList.remove('word-active');
  activeWordSpan = null;
}

export function closeTranslationPopup() {
  hidePopup();
}

function positionPopup(anchorRect) {
  const popup = popupEl;
  popup.style.left = '0px';
  popup.style.top = '0px';
  popup.classList.remove('hidden');

  const margin = 8;
  const popupRect = popup.getBoundingClientRect();

  let left = anchorRect.left + anchorRect.width / 2 - popupRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - popupRect.width - margin));

  let top = anchorRect.top - popupRect.height - margin;
  if (top < margin) {
    top = anchorRect.bottom + margin;
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - popupRect.height - margin));

  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

function renderPopupLoading(word) {
  const popup = ensurePopup();
  popup.innerHTML = `
    <div class="popup-word">${escapeHtml(word)}</div>
    <div class="popup-loading">Traduciendo…</div>
  `;
}

function renderPopupResult({ word, translation, saved, bookId, bookTitle, sentence, error }) {
  const popup = ensurePopup();
  if (error) {
    popup.innerHTML = `
      <div class="popup-word">${escapeHtml(word)}</div>
      <div class="popup-error">${escapeHtml(error)}</div>
    `;
    return;
  }

  popup.innerHTML = `
    <div class="popup-row">
      <div class="popup-word">${escapeHtml(word)}</div>
      <button class="popup-speak-btn" type="button" aria-label="Escuchar palabra">🔊</button>
    </div>
    <div class="popup-translation">${escapeHtml(translation)}</div>
    <button class="popup-save-btn" type="button" ${saved ? 'disabled' : ''}>
      ${saved ? '✓ Guardado' : 'Guardar'}
    </button>
  `;

  popup.querySelector('.popup-speak-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    speak(word);
  });

  const saveBtn = popup.querySelector('.popup-save-btn');
  saveBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.textContent = '✓ Guardado';
    const original = activeWordSpan ? activeWordSpan.textContent : word;
    await saveVocabWord({ word, original, translation, context: sentence, bookId, bookTitle });
    if (activeWordSpan) activeWordSpan.classList.add('word-saved');
    if (onSavedCallback) onSavedCallback();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function handleWordTap(span, { bookId, bookTitle }) {
  const word = span.dataset.word;
  const sentence = span.dataset.sentence;
  const original = span.textContent;

  // Second tap on the same active word acts as quick-save once translated.
  if (activeWordSpan === span && popupEl && !popupEl.classList.contains('hidden')) {
    const saveBtn = popupEl.querySelector('.popup-save-btn:not([disabled])');
    if (saveBtn) {
      saveBtn.click();
      return;
    }
  }

  if (activeWordSpan) activeWordSpan.classList.remove('word-active');
  activeWordSpan = span;
  span.classList.add('word-active');

  ensurePopup();
  renderPopupLoading(original);
  positionPopup(span.getBoundingClientRect());

  try {
    const translation = await translate(original);
    if (activeWordSpan !== span) return; // user moved on
    renderPopupResult({ word, translation, saved: span.classList.contains('word-saved'), bookId, bookTitle, sentence });
    positionPopup(span.getBoundingClientRect());
  } catch (err) {
    if (activeWordSpan !== span) return;
    renderPopupResult({ word, error: err.message || 'Error al traducir' });
    positionPopup(span.getBoundingClientRect());
  }
}

export function setOnSaved(cb) {
  onSavedCallback = cb;
}

function tagWrapperFor(tag) {
  if (tag === 'li') return null; // handled by caller grouping into <ul>
  return tag;
}

export async function renderPage(container, page, { bookId, bookTitle, highlightFrequency = false }) {
  container.innerHTML = '';
  const savedWords = await getSavedWordsSet();

  let listBuffer = null;

  for (const para of page.paragraphs) {
    let el;
    if (para.tag === 'li') {
      if (!listBuffer) {
        listBuffer = document.createElement('ul');
        container.appendChild(listBuffer);
      }
      el = document.createElement('li');
      listBuffer.appendChild(el);
    } else {
      listBuffer = null;
      el = document.createElement(tagWrapperFor(para.tag) || 'p');
      container.appendChild(el);
    }

    const tokens = tokenizeParagraph(para.text);
    let offset = 0;
    for (const token of tokens) {
      if (token.type === 'word') {
        const normalized = normalizeWord(token.value);
        const span = document.createElement('span');
        span.className = 'word';
        if (savedWords.has(normalized)) span.classList.add('word-saved');
        if (highlightFrequency && isCommonWord(normalized)) span.classList.add('word-common');
        span.dataset.word = normalized;
        span.dataset.sentence = sentenceContaining(para.text, offset);
        span.textContent = token.value;
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          handleWordTap(span, { bookId, bookTitle });
        });
        el.appendChild(span);
      } else {
        el.appendChild(document.createTextNode(token.value));
      }
      offset += token.value.length;
    }
  }
}

export function getPageText(page) {
  return page.paragraphs.map((p) => p.text).join('. ');
}
