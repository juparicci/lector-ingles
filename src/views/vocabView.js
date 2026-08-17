import { renderVocabularyList, exportVocabularyCSV, startReviewSession, renderRecallQuiz } from '../vocabulary.js';
import { getAllVocab, getDueVocab } from '../db.js';

export async function renderVocabView(root) {
  const dueCount = (await getDueVocab()).length;

  root.innerHTML = `
    <section class="vocab-view">
      <div class="subtabs">
        <button class="subtab-btn active" data-tab="list">Lista</button>
        <button class="subtab-btn" data-tab="review">Repasar hoy${dueCount ? ` (${dueCount})` : ''}</button>
        <button class="subtab-btn" data-tab="quiz">Mini-quiz</button>
      </div>
      <div class="vocab-actions">
        <button class="export-btn" id="export-csv-btn" type="button">⬇ Exportar CSV (Anki)</button>
      </div>
      <div id="subtab-content"></div>
    </section>
  `;

  const content = root.querySelector('#subtab-content');
  const tabs = root.querySelectorAll('.subtab-btn');

  async function showTab(name) {
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    if (name === 'list') {
      await renderVocabularyList(content);
    } else if (name === 'review') {
      await startReviewSession(content, {
        onComplete: () => {
          // Review counts refresh next time the vocab view is opened.
        },
      });
    } else if (name === 'quiz') {
      await renderRecallQuiz(content, { limit: 5 });
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  root.querySelector('#export-csv-btn').addEventListener('click', async () => {
    const words = await getAllVocab();
    if (words.length === 0) {
      alert('No hay palabras guardadas para exportar.');
      return;
    }
    exportVocabularyCSV(words);
  });

  await showTab('list');
}
