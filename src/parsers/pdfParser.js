import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Groups text items from a PDF page into paragraphs using vertical gaps
// between lines as the paragraph boundary heuristic.
function groupIntoParagraphs(textContent) {
  const items = textContent.items.filter((item) => item.str.trim().length > 0);
  if (items.length === 0) return [];

  const lines = [];
  let currentLine = null;
  const Y_TOLERANCE = 2;

  for (const item of items) {
    const y = item.transform[5];
    if (currentLine && Math.abs(currentLine.y - y) <= Y_TOLERANCE) {
      currentLine.text += item.str;
      currentLine.hasSpaceAtEnd = item.hasEOL;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = { y, text: item.str };
    }
  }
  if (currentLine) lines.push(currentLine);

  // Estimate typical line gap to detect paragraph breaks (larger gaps).
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    gaps.push(Math.abs(lines[i - 1].y - lines[i].y));
  }
  const typicalGap = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;

  const paragraphs = [];
  let buffer = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text.trim();
    if (!line) continue;
    if (i > 0) {
      const gap = Math.abs(lines[i - 1].y - lines[i].y);
      const isParagraphBreak = typicalGap > 0 && gap > typicalGap * 1.6;
      if (isParagraphBreak && buffer) {
        paragraphs.push(buffer.trim());
        buffer = '';
      } else if (buffer) {
        buffer += ' ';
      }
    }
    buffer += line;
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());

  return paragraphs.map((text) => ({ tag: 'p', text }));
}

export async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const paragraphs = groupIntoParagraphs(textContent);
    if (paragraphs.length > 0) {
      pages.push({ paragraphs });
    }
  }

  let title = file.name.replace(/\.pdf$/i, '');
  try {
    const metadata = await pdf.getMetadata();
    if (metadata?.info?.Title) title = metadata.info.Title;
  } catch {
    // ignore metadata failures
  }

  return { title, pages };
}
