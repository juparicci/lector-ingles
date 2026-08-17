import JSZip from 'jszip';

const PARAGRAPH_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI']);
const WORDS_PER_PAGE = 350;

function resolvePath(base, relative) {
  const baseParts = base.split('/');
  baseParts.pop();
  const relParts = relative.split('/');
  for (const part of relParts) {
    if (part === '.' || part === '') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  return baseParts.join('/');
}

async function readXml(zip, path) {
  const file = zip.file(path);
  if (!file) throw new Error(`No se encontró el archivo dentro del EPUB: ${path}`);
  const text = await file.async('text');
  return new DOMParser().parseFromString(text, 'application/xml');
}

async function getOpfPath(zip) {
  const containerXml = await readXml(zip, 'META-INF/container.xml');
  const rootfile = containerXml.querySelector('rootfile');
  if (!rootfile) throw new Error('container.xml sin rootfile');
  return rootfile.getAttribute('full-path');
}

function extractParagraphsFromDoc(doc) {
  const body = doc.querySelector('body');
  if (!body) return [];
  const paragraphs = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (PARAGRAPH_TAGS.has(node.tagName)) return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) {
      const tag = node.tagName.toLowerCase();
      paragraphs.push({ tag: tag === 'li' ? 'li' : tag, text });
    }
  }
  return paragraphs;
}

function paginateParagraphs(paragraphs) {
  const pages = [];
  let current = [];
  let wordCount = 0;

  for (const para of paragraphs) {
    const words = para.text.split(/\s+/).length;
    if (wordCount > 0 && wordCount + words > WORDS_PER_PAGE) {
      pages.push({ paragraphs: current });
      current = [];
      wordCount = 0;
    }
    current.push(para);
    wordCount += words;
  }
  if (current.length > 0) pages.push({ paragraphs: current });
  return pages;
}

export async function parseEPUB(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const opfPath = await getOpfPath(zip);
  const opfDoc = await readXml(zip, opfPath);

  let title = file.name.replace(/\.epub$/i, '');
  const titleEl = opfDoc.querySelector('metadata > *[*|title], metadata > title');
  if (titleEl?.textContent?.trim()) title = titleEl.textContent.trim();

  const manifest = {};
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    manifest[item.getAttribute('id')] = {
      href: item.getAttribute('href'),
      mediaType: item.getAttribute('media-type'),
    };
  });

  const spineIds = Array.from(opfDoc.querySelectorAll('spine > itemref')).map((el) =>
    el.getAttribute('idref')
  );

  const allPages = [];
  for (const idref of spineIds) {
    const manifestItem = manifest[idref];
    if (!manifestItem) continue;
    if (!/xhtml|html/.test(manifestItem.mediaType || '')) continue;

    const chapterPath = resolvePath(opfPath, manifestItem.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const chapterText = await chapterFile.async('text');
    const chapterDoc = new DOMParser().parseFromString(chapterText, 'text/html');
    const paragraphs = extractParagraphsFromDoc(chapterDoc);
    if (paragraphs.length === 0) continue;

    const chapterPages = paginateParagraphs(paragraphs);
    allPages.push(...chapterPages);
  }

  return { title, pages: allPages };
}
