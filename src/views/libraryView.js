import { getAllBooks, saveBook, deleteBook, makeBookRecord } from '../db.js';
import { parsePDF } from '../parsers/pdfParser.js';
import { parseEPUB } from '../parsers/epubParser.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function importFile(file, { onProgress }) {
  const ext = file.name.split('.').pop().toLowerCase();
  let parsed;
  if (ext === 'pdf') {
    onProgress?.('Leyendo PDF…');
    parsed = await parsePDF(file);
  } else if (ext === 'epub') {
    onProgress?.('Leyendo EPUB…');
    parsed = await parseEPUB(file);
  } else {
    throw new Error('Formato no soportado. Usá un archivo .epub o .pdf.');
  }

  if (!parsed.pages || parsed.pages.length === 0) {
    throw new Error('No se pudo extraer texto del archivo.');
  }

  const book = makeBookRecord({ title: parsed.title, type: ext, pages: parsed.pages });
  await saveBook(book);
  return book;
}

export async function renderLibrary(root, { onOpenBook }) {
  root.innerHTML = `
    <section class="library-view">
      <label class="import-btn" for="file-input">
        <span>＋ Importar libro (.epub / .pdf)</span>
        <input type="file" id="file-input" accept=".epub,.pdf" hidden />
      </label>
      <div id="import-status" class="import-status hidden"></div>
      <div id="book-list" class="book-list"></div>
    </section>
  `;

  const fileInput = root.querySelector('#file-input');
  const statusEl = root.querySelector('#import-status');
  const listEl = root.querySelector('#book-list');

  async function refreshList() {
    const books = await getAllBooks();
    if (books.length === 0) {
      listEl.innerHTML = `<p class="empty-state">Todavía no importaste ningún libro.</p>`;
      return;
    }
    listEl.innerHTML = books
      .map(
        (b) => `
        <div class="book-card" data-id="${b.id}">
          <div class="book-card-info">
            <div class="book-card-title">${escapeHtml(b.title)}</div>
            <div class="book-card-meta">${b.type.toUpperCase()} · página ${b.currentPage + 1} de ${b.totalPages}</div>
          </div>
          <button class="book-delete-btn" type="button" data-id="${b.id}" aria-label="Eliminar libro">🗑</button>
        </div>
      `
      )
      .join('');

    listEl.querySelectorAll('.book-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.book-delete-btn')) return;
        onOpenBook(card.dataset.id);
      });
    });
    listEl.querySelectorAll('.book-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteBook(btn.dataset.id);
        refreshList();
      });
    });
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Importando…';
    try {
      const book = await importFile(file, { onProgress: (msg) => (statusEl.textContent = msg) });
      statusEl.classList.add('hidden');
      fileInput.value = '';
      await refreshList();
      onOpenBook(book.id);
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  });

  await refreshList();
}
