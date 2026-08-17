let englishVoice = null;

function pickEnglishVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang?.startsWith('en')) ||
    null
  );
}

if (typeof speechSynthesis !== 'undefined') {
  englishVoice = pickEnglishVoice();
  speechSynthesis.onvoiceschanged = () => {
    englishVoice = pickEnglishVoice();
  };
}

export function speak(text, { rate = 1 } = {}) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  if (englishVoice) utterance.voice = englishVoice;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function isSpeaking() {
  return 'speechSynthesis' in window && speechSynthesis.speaking;
}
