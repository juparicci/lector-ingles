import './style.css';
import { renderLibrary } from './views/libraryView.js';
import { renderReader } from './views/readerView.js';
import { renderVocabView } from './views/vocabView.js';
import { closeTranslationPopup } from './reader.js';

const viewRoot = document.getElementById('view-root');
const viewTitle = document.getElementById('view-title');
const tabbar = document.getElementById('tabbar');
const backBtn = document.getElementById('nav-back');

let activeCleanup = null;

function setChrome({ title, showBack, activeTab }) {
  viewTitle.textContent = title;
  backBtn.classList.toggle('hidden', !showBack);
  tabbar.classList.toggle('hidden', !!showBack);
  tabbar.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === activeTab);
  });
}

async function router() {
  closeTranslationPopup();
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  const hash = window.location.hash || '#/library';
  const [, route, param] = hash.split('/');

  if (route === 'reader' && param) {
    setChrome({ title: 'Leyendo…', showBack: true, activeTab: null });
    const result = await renderReader(viewRoot, param, {
      onExit: () => (window.location.hash = '#/library'),
    });
    if (result) {
      viewTitle.textContent = result.title;
      activeCleanup = result.cleanup;
    }
  } else if (route === 'vocabulary') {
    setChrome({ title: 'Mi vocabulario', showBack: false, activeTab: 'vocabulary' });
    await renderVocabView(viewRoot);
  } else {
    setChrome({ title: 'Biblioteca', showBack: false, activeTab: 'library' });
    await renderLibrary(viewRoot, {
      onOpenBook: (id) => (window.location.hash = `#/reader/${id}`),
    });
  }
}

tabbar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  window.location.hash = `#/${btn.dataset.view}`;
});

backBtn.addEventListener('click', () => {
  window.location.hash = '#/library';
});

window.addEventListener('hashchange', router);
router();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(() => {
      // vite-plugin-pwa virtual module not available in dev without registration; ignore.
    });
  });
}
