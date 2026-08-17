const cache = new Map();

async function translateGoogle(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google translate failed: ${res.status}`);
  const data = await res.json();
  const translated = data[0].map((chunk) => chunk[0]).join('');
  if (!translated) throw new Error('Google translate: empty result');
  return translated;
}

async function translateMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory failed: ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error('MyMemory: empty result');
  return translated;
}

export async function translate(text) {
  const key = text.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  let result;
  try {
    result = await translateGoogle(text);
  } catch (err) {
    try {
      result = await translateMyMemory(text);
    } catch (err2) {
      throw new Error('No se pudo traducir (ambos servicios fallaron).');
    }
  }

  cache.set(key, result);
  return result;
}
