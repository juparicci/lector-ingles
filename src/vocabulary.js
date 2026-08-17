import { getAllVocab, deleteVocabWord, getDueVocab, updateVocabSRS } from './db.js';
import { sm2, QUALITY } from './srs.js';
import { speak } from './tts.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function renderVocabularyList(container) {
  const words = await getAllVocab();

  if (words.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no guardaste ninguna palabra. Tocá una palabra mientras leés para agregarla.</p>`;
    return;
  }

  const dueIds = new Set((await getDueVocab()).map((w) => w.id));

  container.innerHTML = `
    <div class="vocab-list">
      ${words
        .map(
          (w) => `
        <div class="vocab-item" data-id="${w.id}">
          <div class="vocab-item-main">
            <div class="vocab-item-word">
              ${escapeHtml(w.original || w.word)}
              ${dueIds.has(w.id) ? '<span class="vocab-due-badge">a repasar</span>' : ''}
            </div>
            <div class="vocab-item-translation">${escapeHtml(w.translation)}</div>
            ${w.context ? `<div class="vocab-item-context">"${escapeHtml(w.context)}"</div>` : ''}
            <div class="vocab-item-meta">${w.bookTitle ? escapeHtml(w.bookTitle) + ' · ' : ''}${formatDate(w.dateAdded)}</div>
          </div>
          <div class="vocab-item-actions">
            <button class="vocab-speak-btn" type="button" data-word="${escapeHtml(w.original || w.word)}" aria-label="Escuchar">🔊</button>
            <button class="vocab-delete-btn" type="button" data-id="${w.id}" aria-label="Eliminar">🗑</button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  container.querySelectorAll('.vocab-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteVocabWord(btn.dataset.id);
      renderVocabularyList(container);
    });
  });

  container.querySelectorAll('.vocab-speak-btn').forEach((btn) => {
    btn.addEventListener('click', () => speak(btn.dataset.word));
  });
}

export function exportVocabularyCSV(words) {
  const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const header = 'word,translation,context\n';
  const rows = words
    .map((w) => [w.original || w.word, w.translation, w.context].map(escapeCsv).join(','))
    .join('\n');
  const csv = header + rows;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vocabulario-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Review (SRS) ----------

export async function startReviewSession(container, { onComplete } = {}) {
  const queue = await getDueVocab();

  if (queue.length === 0) {
    container.innerHTML = `<p class="empty-state">No tenés palabras para repasar hoy. ¡Volvé mañana!</p>`;
    return;
  }

  let index = 0;
  let revealed = false;

  function renderCard() {
    const word = queue[index];
    revealed = false;
    container.innerHTML = `
      <div class="review-progress">${index + 1} / ${queue.length}</div>
      <div class="review-card">
        <div class="review-word">${escapeHtml(word.original || word.word)}</div>
        <button class="review-speak-btn" type="button" aria-label="Escuchar">🔊</button>
        <div class="review-answer hidden">
          <div class="review-translation">${escapeHtml(word.translation)}</div>
          ${word.context ? `<div class="review-context">"${escapeHtml(word.context)}"</div>` : ''}
        </div>
        <button class="review-reveal-btn" type="button">Mostrar traducción</button>
        <div class="review-grade-buttons hidden">
          <button class="review-grade-btn grade-again" data-quality="${QUALITY.AGAIN}">De nuevo</button>
          <button class="review-grade-btn grade-good" data-quality="${QUALITY.GOOD}">Bien</button>
          <button class="review-grade-btn grade-easy" data-quality="${QUALITY.EASY}">Fácil</button>
        </div>
      </div>
    `;

    container.querySelector('.review-speak-btn').addEventListener('click', () => {
      speak(word.original || word.word);
    });

    container.querySelector('.review-reveal-btn').addEventListener('click', () => {
      revealed = true;
      container.querySelector('.review-answer').classList.remove('hidden');
      container.querySelector('.review-reveal-btn').classList.add('hidden');
      container.querySelector('.review-grade-buttons').classList.remove('hidden');
    });

    container.querySelectorAll('.review-grade-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const quality = Number(btn.dataset.quality);
        const patch = sm2(word.srs, quality);
        await updateVocabSRS(word.id, patch);
        index += 1;
        if (index < queue.length) {
          renderCard();
        } else {
          container.innerHTML = `<p class="empty-state">¡Repaso completado! Repasaste ${queue.length} palabra${queue.length === 1 ? '' : 's'}.</p>`;
          if (onComplete) onComplete();
        }
      });
    });
  }

  renderCard();
}

// ---------- Recall quiz ----------

export async function renderRecallQuiz(container, { limit = 5 } = {}) {
  const all = await getAllVocab();
  const words = all.slice(0, limit);

  if (words.length === 0) {
    container.innerHTML = '';
    return;
  }

  let index = 0;

  function renderQuestion() {
    const word = words[index];
    container.innerHTML = `
      <div class="quiz-box">
        <div class="quiz-title">Mini-quiz: ¿qué significa...?</div>
        <div class="quiz-progress">${index + 1} / ${words.length}</div>
        <div class="quiz-word">${escapeHtml(word.original || word.word)}</div>
        <button class="quiz-reveal-btn" type="button">Revelar</button>
        <div class="quiz-answer hidden">${escapeHtml(word.translation)}</div>
        <button class="quiz-next-btn hidden" type="button">Siguiente</button>
      </div>
    `;

    container.querySelector('.quiz-reveal-btn').addEventListener('click', () => {
      container.querySelector('.quiz-answer').classList.remove('hidden');
      container.querySelector('.quiz-reveal-btn').classList.add('hidden');
      container.querySelector('.quiz-next-btn').classList.remove('hidden');
    });

    container.querySelector('.quiz-next-btn').addEventListener('click', () => {
      index += 1;
      if (index < words.length) renderQuestion();
      else container.innerHTML = `<p class="empty-state">Quiz terminado.</p>`;
    });
  }

  renderQuestion();
}
