/* ==========================================
   Dragon Digraph — Speech Module
   Wraps Web Speech API for TTS & recognition
   ========================================== */

const Speech = (() => {
  const synth = window.speechSynthesis;

  /* --- Text-to-Speech --- */
  function speak(text, rate = 0.85) {
    return new Promise((resolve) => {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = rate;
      utter.onend = resolve;
      utter.onerror = resolve;
      synth.speak(utter);
    });
  }

  /* --- Speech Recognition --- */
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  function isRecognitionSupported() {
    return !!SpeechRec;
  }

  /**
   * Listen for speech and return the transcript.
   * Resolves with { transcript, confidence } or rejects on error/no-speech.
   */
  function listen() {
    return new Promise((resolve, reject) => {
      if (!SpeechRec) {
        return reject(new Error('Speech recognition not supported'));
      }
      recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      recognition.onresult = (event) => {
        const best = event.results[0][0];
        resolve({
          transcript: best.transcript.toLowerCase().trim(),
          confidence: best.confidence
        });
      };
      recognition.onerror = (e) => reject(e);
      recognition.onnomatch = () => reject(new Error('no-match'));
      recognition.onend = () => {}; // handled by result/error
      recognition.start();
    });
  }

  function stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch (_) { /* ignore */ }
    }
  }

  return { speak, listen, stopListening, isRecognitionSupported };
})();
