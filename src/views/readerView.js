import { getBook, updateBookProgress, saveBook } from '../db.js';
import { renderPage, getPageText, setOnSaved } from '../reader.js';
import { speak, stopSpeaking, isSpeaking } from '../tts.js';
import { getSetting, setSetting } from '../db.js';

const MIN_FONT = 70;
const MAX_FONT = 160;
const FONT_STEP = 10;

export async function renderReader(root, bookId, { onExit }) {
  const book = await getBook(bookId);
  if (!book) {
    root.innerHTML = `<p class="empty-state">No se encontró el libro.</p>`;
    return;
  }

  const highlightFrequency = await getSetting('highlightFrequency', false);

  root.innerHTML = `
    <section class="reader-view">
      <div class="reader-toolbar">
        <div class="font-controls">
          <button class="icon-btn" id="font-dec" aria-label="Reducir letra">A-</button>
          <button class="icon-btn" id="font-inc" aria-label="Agrandar letra">A+</button>
        </div>
        <button class="icon-btn" id="speak-page-btn" aria-label="Escuchar página">🔊 Escuchar página</button>
        <label class="freq-toggle">
          <input type="checkbox" id="freq-toggle" ${highlightFrequency ? 'checked' : ''} />
          Solo destacar palabras poco frecuentes
        </label>
      </div>
      <div class="page-content" id="page-content" style="font-size: ${book.fontSize}%"></div>
      <div class="reader-nav">
        <button class="icon-btn" id="prev-page" aria-label="Página anterior">‹ Anterior</button>
        <div class="page-indicator" id="page-indicator"></div>
        <button class="icon-btn" id="next-page" aria-label="Página siguiente">Siguiente ›</button>
      </div>
    </section>
  `;

  const contentEl = root.querySelector('#page-content');
  const indicatorEl = root.querySelector('#page-indicator');
  const prevBtn = root.querySelector('#prev-page');
  const nextBtn = root.querySelector('#next-page');
  const speakBtn = root.querySelector('#speak-page-btn');
  const freqToggle = root.querySelector('#freq-toggle');

  let currentPage = book.currentPage || 0;
  let highlightFreq = highlightFrequency;

  async function showPage(pageIndex) {
    stopSpeaking();
    currentPage = Math.max(0, Math.min(pageIndex, book.totalPages - 1));
    const page = book.pages[currentPage];
    await renderPage(contentEl, page, { bookId: book.id, bookTitle: book.title, highlightFrequency: highlightFreq });
    contentEl.scrollTop = 0;
    indicatorEl.textContent = `Página ${currentPage + 1} de ${book.totalPages}`;
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage === book.totalPages - 1;
    await updateBookProgress(book.id, currentPage);
  }

  prevBtn.addEventListener('click', () => showPage(currentPage - 1));
  nextBtn.addEventListener('click', () => showPage(currentPage + 1));

  root.querySelector('#font-dec').addEventListener('click', async () => {
    book.fontSize = Math.max(MIN_FONT, book.fontSize - FONT_STEP);
    contentEl.style.fontSize = `${book.fontSize}%`;
    await saveBook(book);
  });
  root.querySelector('#font-inc').addEventListener('click', async () => {
    book.fontSize = Math.min(MAX_FONT, book.fontSize + FONT_STEP);
    contentEl.style.fontSize = `${book.fontSize}%`;
    await saveBook(book);
  });

  speakBtn.addEventListener('click', () => {
    if (isSpeaking()) {
      stopSpeaking();
      speakBtn.textContent = '🔊 Escuchar página';
      return;
    }
    const text = getPageText(book.pages[currentPage]);
    speak(text);
    speakBtn.textContent = '⏹ Detener';
    const check = setInterval(() => {
      if (!isSpeaking()) {
        speakBtn.textContent = '🔊 Escuchar página';
        clearInterval(check);
      }
    }, 300);
  });

  freqToggle.addEventListener('change', async () => {
    highlightFreq = freqToggle.checked;
    await setSetting('highlightFrequency', highlightFreq);
    await showPage(currentPage);
  });

  setOnSaved(() => {
    // Re-render current paragraph highlighting is handled per-span already; no full refresh needed.
  });

  await showPage(currentPage);

  return {
    cleanup() {
      stopSpeaking();
    },
    title: book.title,
  };
}
