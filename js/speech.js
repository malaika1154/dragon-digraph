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
   * Request microphone permission explicitly.
   * Returns true if granted, false otherwise.
   */
  async function requestMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // release immediately
      return true;
    } catch {
      return false;
    }
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
      // Stop any TTS that might interfere
      synth.cancel();
      // Stop any previous recognition
      if (recognition) {
        try { recognition.abort(); } catch (_) { /* ignore */ }
      }
      recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 5;
      recognition.continuous = false;

      let settled = false;

      recognition.onresult = (event) => {
        if (settled) return;
        settled = true;
        const best = event.results[0][0];
        resolve({
          transcript: best.transcript.toLowerCase().trim(),
          confidence: best.confidence
        });
      };
      recognition.onerror = (e) => {
        if (settled) return;
        settled = true;
        reject(e);
      };
      recognition.onnomatch = () => {
        if (settled) return;
        settled = true;
        reject(new Error('no-match'));
      };
      recognition.onend = () => {
        if (!settled) {
          settled = true;
          reject(new Error('no-speech'));
        }
      };
      try {
        recognition.start();
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  }

  function stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch (_) { /* ignore */ }
    }
  }

  return { speak, listen, stopListening, isRecognitionSupported, requestMic };
})();
