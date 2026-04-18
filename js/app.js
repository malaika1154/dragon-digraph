/* ==========================================
   Dragon Digraph — Main Application
   ========================================== */

(async function () {
  'use strict';

  /* ---- Click sound (Web Audio API) ---- */
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playClick() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .btn, .island-card, .avatar-card, .stage-card, .options-grid .btn, .dd-tile, .listen-word-card')) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playClick();
    }
  });

  /* ---- Load data files ---- */
  const [configRes, digraphsRes] = await Promise.all([
    fetch('data/config.json'),
    fetch('data/digraphs.json')
  ]);
  const CONFIG = await configRes.json();
  const DIGRAPH_DATA = (await digraphsRes.json()).digraphs;

  /* ---- Persistence helpers (localStorage) ---- */
  const SAVE_KEY = 'dragonDigraph_save';

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function writeSave(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  function getDefaultSave() {
    return {
      avatar: null,
      // stageProgress[digraphId][stageType] = { completed: bool, score: n }
      stageProgress: {},
      dragonsEarned: [] // digraph ids with all 4 stages done
    };
  }

  let save = loadSave() || getDefaultSave();

  /* ---- DOM refs ---- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---- Screen management ---- */
  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.remove('active'));
    $(`#screen-${id}`).classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ---- Shuffle helper ---- */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---- Randomized feedback phrases ---- */
  const CHEERS = [
    '✅ Excellent!', '✅ Amazing!', '✅ Great job!', '✅ Wonderful!',
    '✅ Superstar!', '✅ You rock!', '✅ Brilliant!', '✅ Awesome!',
    '✅ Fantastic!', '✅ Well done!', '✅ Perfect!', '✅ Keep it up!'
  ];
  const TRIES = [
    '❌ Try again!', '❌ Almost there!', '❌ Not quite — keep going!',
    '❌ So close!', '❌ Don\'t give up!', '❌ You\'ll get it next time!'
  ];
  function randomCheer() { return CHEERS[Math.floor(Math.random() * CHEERS.length)]; }
  function randomTry()   { return TRIES[Math.floor(Math.random() * TRIES.length)]; }

  /* =============================================
     TITLE / PLAY SCREEN
     ============================================= */
  /* ---- Background Music (YouTube IFrame API) ---- */
  let ytPlayer = null;
  let musicMuted = false;
  let musicRequested = false;

  // Load the YouTube IFrame API script
  const ytScript = document.createElement('script');
  ytScript.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(ytScript);

  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('yt-player', {
      videoId: 'myZFE73HX28',
      playerVars: { autoplay: 0, loop: 1, playlist: 'myZFE73HX28', controls: 0 },
      events: {
        onReady: function () {
          ytPlayer.setVolume(30);
          if (musicRequested) startBgMusic();
        }
      }
    });
  };

  function startBgMusic() {
    musicRequested = true;
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      ytPlayer.playVideo();
      document.getElementById('btn-music-toggle').style.display = 'block';
    }
  }

  document.getElementById('btn-music-toggle').addEventListener('click', () => {
    if (!ytPlayer) return;
    if (musicMuted) {
      ytPlayer.unMute();
      document.getElementById('btn-music-toggle').textContent = '🔊';
    } else {
      ytPlayer.mute();
      document.getElementById('btn-music-toggle').textContent = '🔇';
    }
    musicMuted = !musicMuted;
  });

  $('#btn-play').addEventListener('click', () => {
    startBgMusic();
    showScreen('welcome');
  });

  /* =============================================
     WELCOME
     ============================================= */
  $('#btn-start').addEventListener('click', () => {
    if (save.avatar) {
      renderMap();
      showScreen('map');
    } else {
      renderAvatarSelect();
      showScreen('avatar');
    }
  });

  /* =============================================
     AVATAR SELECT
     ============================================= */
  function renderAvatarSelect() {
    const list = $('#avatar-list');
    list.innerHTML = '';
    CONFIG.avatars.forEach((av) => {
      const card = document.createElement('div');
      card.className = 'avatar-card';
      card.innerHTML = `
        <div class="emoji">${av.emoji}</div>
        <h3>${av.name}</h3>
        <p>${av.description}</p>`;
      card.addEventListener('click', () => {
        save.avatar = av.id;
        writeSave(save);
        renderMap();
        showScreen('map');
      });
      list.appendChild(card);
    });
  }

  /* =============================================
     ISLAND MAP
     ============================================= */
  function getAvatar() {
    return CONFIG.avatars.find((a) => a.id === save.avatar) || CONFIG.avatars[0];
  }

  function isIslandUnlocked(index) {
    if (index === 0) return true;
    // Previous island must be fully complete
    const prevDigraph = DIGRAPH_DATA[index - 1];
    return save.dragonsEarned.includes(prevDigraph.id);
  }

  function isIslandComplete(digraphId) {
    return save.dragonsEarned.includes(digraphId);
  }

  function renderMap() {
    const av = getAvatar();
    $('#player-avatar-icon').textContent = av.emoji;
    $('#player-name').textContent = av.name;
    $('#dragon-count').textContent = save.dragonsEarned.length;
    updateAnkiButton();

    const chain = $('#island-chain');
    chain.innerHTML = '';

    const sides = ['left', 'right'];          // zigzag pattern

    DIGRAPH_DATA.forEach((dg, idx) => {
      /* — connector chain between islands — */
      if (idx > 0) {
        const connector = document.createElement('div');
        connector.className = 'chain-connector';
        connector.innerHTML = '<div class="chain-link"></div><div class="chain-link"></div><div class="chain-link"></div>';
        chain.appendChild(connector);
      }

      /* — island row (alternates left / right) — */
      const row = document.createElement('div');
      row.className = 'island-row ' + sides[idx % 2];

      const unlocked = isIslandUnlocked(idx);
      const complete = isIslandComplete(dg.id);
      const card = document.createElement('div');
      card.className = 'island-card' + (unlocked ? '' : ' locked');
      card.style.background = dg.island.background;
      card.style.color = dg.island.color;
      card.innerHTML = `
        <div class="icon">${dg.island.icon}</div>
        <h3>${dg.island.name}</h3>
        <div class="blend-label">${dg.digraph}</div>
        ${complete ? '<span class="check-badge">✅</span>' : ''}
        ${!unlocked ? '<span class="lock-badge">🔒</span>' : ''}`;
      if (unlocked) {
        card.addEventListener('click', () => openIsland(dg));
      }
      row.appendChild(card);
      chain.appendChild(row);
    });
  }

  $('#btn-dragons').addEventListener('click', () => {
    renderDragonCollection();
    showScreen('dragons');
  });
  $('#btn-back-map2').addEventListener('click', () => {
    renderMap();
    showScreen('map');
  });

  /* =============================================
     DRAGON COLLECTION
     ============================================= */
  function renderDragonCollection() {
    const container = $('#dragon-collection');
    container.innerHTML = '';
    DIGRAPH_DATA.forEach((dg) => {
      const earned = save.dragonsEarned.includes(dg.id);
      const cell = document.createElement('div');
      cell.className = 'dragon-cell' + (earned ? '' : ' empty');
      cell.innerHTML = `
        <div class="dragon-emoji">${earned ? dg.island.icon : '❓'}</div>
        <h4>${dg.island.name}</h4>
        <p>${earned ? 'Earned!' : 'Locked'}</p>`;
      container.appendChild(cell);
    });
  }

  /* =============================================
     STAGE SELECT for an island
     ============================================= */
  let currentDigraph = null;

  function getStageProgress(digraphId, stageType) {
    return (save.stageProgress[digraphId] && save.stageProgress[digraphId][stageType]) || null;
  }

  function isStageUnlocked(digraphId, stageIdx) {
    if (stageIdx === 0) return true;
    const prevType = CONFIG.stageTypes[stageIdx - 1].id;
    const prev = getStageProgress(digraphId, prevType);
    return prev && prev.completed;
  }

  function openIsland(dg) {
    currentDigraph = dg;
    $('#island-title').textContent = `${dg.island.icon} ${dg.island.name}`;

    const list = $('#stage-list');
    list.innerHTML = '';

    CONFIG.stageTypes.forEach((st, idx) => {
      const prog = getStageProgress(dg.id, st.id);
      const unlocked = isStageUnlocked(dg.id, idx);
      const card = document.createElement('div');
      card.className = 'stage-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="stage-icon"><img src="${st.icon}" alt="${st.name}"></div>
        <div class="stage-info">
          <h3>${st.name}</h3>
          <p>${st.description}</p>
        </div>
        <div class="stage-status">${prog && prog.completed ? '✅' : unlocked ? '▶️' : '🔒'}</div>`;
      if (unlocked) {
        card.addEventListener('click', () => launchStage(dg, st.id));
      }
      list.appendChild(card);
    });
    showScreen('stages');
  }

  $('#btn-back-map').addEventListener('click', () => {
    renderMap();
    showScreen('map');
  });

  // Back-to-stages buttons (multiple)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-back-stages')) {
      if (currentDigraph) openIsland(currentDigraph);
    }
  });

  /* =============================================
     STAGE LAUNCHER
     ============================================= */
  function launchStage(dg, stageType) {
    currentDigraph = dg;
    switch (stageType) {
      case 'learn': startLearn(dg); break;
      case 'quiz': startQuiz(dg); break;
      case 'dragdrop': startDragDrop(dg); break;
      case 'speech': startSpeech(dg); break;
    }
  }

  function markStageComplete(digraphId, stageType, score) {
    if (!save.stageProgress[digraphId]) save.stageProgress[digraphId] = {};
    save.stageProgress[digraphId][stageType] = { completed: true, score };

    // Check if all stages done → earn dragon
    const allDone = CONFIG.stageTypes.every((st) => {
      const p = getStageProgress(digraphId, st.id);
      return p && p.completed;
    });
    if (allDone && !save.dragonsEarned.includes(digraphId)) {
      save.dragonsEarned.push(digraphId);
    }
    writeSave(save);
    return allDone && save.dragonsEarned.includes(digraphId);
  }

  /* =============================================
     LEARN MODE
     ============================================= */
  function startLearn(dg) {
    $('#learn-digraph').textContent = dg.digraph;
    $('#learn-pronunciation').textContent = dg.pronunciation;

    const container = $('#learn-words');
    container.innerHTML = '';

    dg.stages.learn.words.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'listen-word-card';
      let inner = '';
      if (w.image) inner += `<img src="${encodeURI(w.image)}" alt="${w.word}">`;
      inner += `<div class="word-label">${highlightDigraph(w.word, dg.digraph)}</div>`;
      inner += `<div class="speak-icon">🔊</div>`;
      card.innerHTML = inner;
      card.addEventListener('click', () => Speech.speak(w.word));
      container.appendChild(card);
    });

    // Mark learn stage as complete immediately (it's informational)
    markStageComplete(dg.id, 'learn', 0);
    showScreen('learn');
  }

  function highlightDigraph(word, digraph) {
    const idx = word.toLowerCase().indexOf(digraph.toLowerCase());
    if (idx === -1) return word;
    return word.substring(0, idx) +
      `<strong style="color:var(--primary)">${word.substring(idx, idx + digraph.length)}</strong>` +
      word.substring(idx + digraph.length);
  }

  /* =============================================
     QUIZ
     ============================================= */
  let quizState = {};

  function startQuiz(dg) {
    const questions = shuffle(dg.stages.quiz.questions).slice(0, CONFIG.questionsPerStage);
    quizState = { dg, questions, idx: 0, score: 0 };
    showQuizQuestion();
    showScreen('quiz');
  }

  function showQuizQuestion() {
    const q = quizState.questions[quizState.idx];
    const total = quizState.questions.length;

    $('#quiz-progress-fill').style.width = `${(quizState.idx / total) * 100}%`;
    $('#quiz-score').textContent = `Question ${quizState.idx + 1} of ${total}  •  Score: ${quizState.score}`;
    $('#quiz-prompt').innerHTML = formatPrompt(q.prompt);
    $('#quiz-feedback').textContent = '';
    $('#quiz-feedback').className = 'feedback';

    const grid = $('#quiz-options');
    grid.innerHTML = '';
    shuffle(q.options).forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleQuizAnswer(btn, opt, q));
      grid.appendChild(btn);
    });
  }

  function formatPrompt(prompt) {
    return prompt.replace('_', '<span class="blank">___</span>');
  }

  function handleQuizAnswer(btn, selected, question) {
    // Disable all buttons
    $$('#quiz-options .option-btn').forEach((b) => (b.style.pointerEvents = 'none'));

    const correct = selected === question.answer;
    btn.classList.add(correct ? 'correct' : 'wrong');

    if (correct) {
      quizState.score++;
      $('#quiz-feedback').textContent = `${randomCheer()} The word is "${question.fullWord}"`;
      $('#quiz-feedback').className = 'feedback correct';
      Speech.speak(question.fullWord);
    } else {
      // Highlight correct
      $$('#quiz-options .option-btn').forEach((b) => {
        if (b.textContent === question.answer) b.classList.add('correct');
      });
      $('#quiz-feedback').textContent = `${randomTry()} The answer was "${question.answer}" → "${question.fullWord}"`;
      $('#quiz-feedback').className = 'feedback wrong';
    }

    setTimeout(() => {
      quizState.idx++;
      if (quizState.idx < quizState.questions.length) {
        showQuizQuestion();
      } else {
        finishStage('quiz', quizState.score, quizState.questions.length);
      }
    }, 1600);
  }

  /* =============================================
     DRAG & DROP
     ============================================= */
  let ddState = {};

  function startDragDrop(dg) {
    const questions = shuffle(dg.stages.dragdrop.questions).slice(0, CONFIG.questionsPerStage);
    ddState = { dg, questions, idx: 0, score: 0 };
    showDDQuestion();
    showScreen('dragdrop');
  }

  function showDDQuestion() {
    const q = ddState.questions[ddState.idx];
    const total = ddState.questions.length;

    $('#dd-progress-fill').style.width = `${(ddState.idx / total) * 100}%`;
    $('#dd-score').textContent = `Question ${ddState.idx + 1} of ${total}  •  Score: ${ddState.score}`;
    $('#dd-prompt').innerHTML = formatPrompt(q.prompt);
    $('#dd-feedback').textContent = '';
    $('#dd-feedback').className = 'feedback';
    $('#dd-drop-text').textContent = 'Drop here';

    // Show picture if available, otherwise show island emoji
    const picEl = $('#dd-picture');
    if (q.image) {
      picEl.innerHTML = `<img src="${encodeURI(q.image)}" alt="${q.fullWord}">`;
    } else {
      picEl.innerHTML = `<span class="dd-picture-emoji">${ddState.dg.island.icon}</span>`;
    }

    const choices = $('#dd-choices');
    choices.innerHTML = '';

    const allOptions = shuffle([q.answer, ...q.distractors]);
    allOptions.forEach((opt) => {
      const chip = document.createElement('div');
      chip.className = 'dd-chip';
      chip.textContent = opt;
      chip.draggable = true;
      chip.dataset.value = opt;

      // Drag events
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', opt);
        chip.style.opacity = '0.5';
      });
      chip.addEventListener('dragend', () => {
        chip.style.opacity = '1';
      });

      // Tap fallback for touch devices
      chip.addEventListener('click', () => handleDDAnswer(chip, opt, q));
      choices.appendChild(chip);
    });

    // Drop zone
    const zone = $('#dd-dropzone');
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('hover'); };
    zone.ondragleave = () => zone.classList.remove('hover');
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('hover');
      const val = e.dataTransfer.getData('text/plain');
      const chip = [...$$('.dd-chip')].find((c) => c.dataset.value === val);
      handleDDAnswer(chip, val, q);
    };
  }

  function handleDDAnswer(chip, selected, question) {
    // Disable interaction
    $$('.dd-chip').forEach((c) => (c.style.pointerEvents = 'none'));

    const correct = selected === question.answer;
    if (chip) chip.classList.add(correct ? 'correct' : 'wrong');

    if (correct) {
      ddState.score++;
      $('#dd-drop-text').textContent = question.answer;
      $('#dd-feedback').textContent = `${randomCheer()} "${question.fullWord}"`;
      $('#dd-feedback').className = 'feedback correct';
      Speech.speak(question.fullWord);
    } else {
      $('#dd-feedback').textContent = `${randomTry()} The answer was "${question.answer}" → "${question.fullWord}"`;
      $('#dd-feedback').className = 'feedback wrong';
    }

    setTimeout(() => {
      ddState.idx++;
      if (ddState.idx < ddState.questions.length) {
        showDDQuestion();
      } else {
        finishStage('dragdrop', ddState.score, ddState.questions.length);
      }
    }, 1600);
  }

  /* =============================================
     SPEECH STAGE
     ============================================= */
  let spState = {};

  function startSpeech(dg) {
    const words = shuffle(dg.stages.speech.words).slice(0, CONFIG.questionsPerStage);
    spState = { dg, words, idx: 0, score: 0 };

    if (!Speech.isRecognitionSupported()) {
      $('#sp-no-support').classList.remove('hidden');
    } else {
      $('#sp-no-support').classList.add('hidden');
    }

    showSpeechWord();
    showScreen('speech');
  }

  function showSpeechWord() {
    const word = spState.words[spState.idx];
    const total = spState.words.length;

    $('#sp-progress-fill').style.width = `${(spState.idx / total) * 100}%`;
    $('#sp-score').textContent = `Word ${spState.idx + 1} of ${total}  •  Score: ${spState.score}`;
    $('#sp-word').textContent = word;
    $('#sp-heard').textContent = '';
    $('#sp-feedback').textContent = '';
    $('#sp-feedback').className = 'feedback';
    $('#btn-speak').classList.remove('recording');
    $('#btn-speak').disabled = false;
  }

  $('#btn-hear-word').addEventListener('click', () => {
    const word = spState.words[spState.idx];
    Speech.speak(word);
  });

  $('#btn-speak').addEventListener('click', async () => {
    if (!Speech.isRecognitionSupported()) return;
    const btn = $('#btn-speak');

    // Request mic permission first
    const micOk = await Speech.requestMic();
    if (!micOk) {
      $('#sp-feedback').textContent = '🎤 Microphone access denied — please allow microphone in your browser.';
      $('#sp-feedback').className = 'feedback wrong';
      return;
    }

    btn.classList.add('recording');
    btn.disabled = true;
    $('#sp-heard').textContent = 'Listening...';
    $('#sp-feedback').textContent = '';
    $('#sp-feedback').className = 'feedback';

    try {
      const result = await Speech.listen();
      btn.classList.remove('recording');
      const heard = result.transcript;
      const target = spState.words[spState.idx].toLowerCase();

      $('#sp-heard').textContent = `I heard: "${heard}"`;

      // Flexible matching: exact, or the word appears in transcript
      const correct = heard === target || heard.includes(target) || target.includes(heard);

      if (correct) {
        spState.score++;
        $('#sp-feedback').textContent = randomCheer();
        $('#sp-feedback').className = 'feedback correct';
      } else {
        $('#sp-feedback').textContent = `${randomTry()} The word is "${target}"`;
        $('#sp-feedback').className = 'feedback wrong';
      }
    } catch {
      btn.classList.remove('recording');
      btn.disabled = false;
      $('#sp-heard').textContent = '';
      $('#sp-feedback').textContent = '🎤 Could not hear you — tap to try again!';
      $('#sp-feedback').className = 'feedback wrong';
      return;  // let user retry without advancing
    }

    btn.disabled = false;
    setTimeout(() => {
      spState.idx++;
      if (spState.idx < spState.words.length) {
        showSpeechWord();
      } else {
        finishStage('speech', spState.score, spState.words.length);
      }
    }, 1800);
  });

  /* =============================================
     STAGE COMPLETE
     ============================================= */
  function finishStage(stageType, score, total) {
    const passed = score >= CONFIG.passThreshold;
    const earnedDragon = passed ? markStageComplete(currentDigraph.id, stageType, score) : false;

    if (passed) {
      $('#complete-icon').textContent = '🎉';
      $('#complete-title').textContent = 'Stage Complete!';
      $('#complete-msg').textContent = `You scored ${score} out of ${total}!`;
    } else {
      $('#complete-icon').textContent = '💪';
      $('#complete-title').textContent = 'Keep Practising!';
      $('#complete-msg').textContent = `You scored ${score} out of ${total}. Need ${CONFIG.passThreshold} to pass. Try again!`;
    }

    if (earnedDragon) {
      $('#complete-dragon').classList.remove('hidden');
      $('#earned-dragon').textContent = currentDigraph.island.icon + ' 🐉';
    } else {
      $('#complete-dragon').classList.add('hidden');
    }

    showScreen('complete');
  }

  $('#btn-continue').addEventListener('click', () => {
    if (currentDigraph) {
      openIsland(currentDigraph);
    } else {
      renderMap();
      showScreen('map');
    }
  });

  /* =============================================
     ANKI CARD REVIEW (unlocks after all dragons earned)
     ============================================= */
  let ankiDeck = [];
  let ankiIndex = 0;
  let ankiCorrect = 0;
  let ankiTotal = 0;

  function isAnkiUnlocked() {
    return save.dragonsEarned.length >= DIGRAPH_DATA.length;
  }

  function updateAnkiButton() {
    const btn = $('#btn-anki');
    if (isAnkiUnlocked()) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  function buildAnkiDeck() {
    const cards = [];
    DIGRAPH_DATA.forEach((dg) => {
      dg.stages.quiz.questions.forEach((q) => {
        cards.push({
          prompt: q.prompt,
          answer: q.answer,
          options: shuffle([...q.options]),
          fullWord: q.fullWord,
          image: q.image,
          digraph: dg.digraph,
          weight: 1  // higher = more likely to reappear
        });
      });
    });
    return shuffle(cards);
  }

  function pickNextAnkiCard() {
    // Weighted pick — hard cards appear more often
    const pool = [];
    ankiDeck.forEach((c, i) => {
      for (let w = 0; w < c.weight; w++) pool.push(i);
    });
    if (pool.length === 0) return -1;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function startAnki() {
    ankiDeck = buildAnkiDeck();
    ankiIndex = 0;
    ankiCorrect = 0;
    ankiTotal = 0;
    $('#anki-done').classList.add('hidden');
    showAnkiCard();
    showScreen('anki');
  }

  function showAnkiCard() {
    const idx = pickNextAnkiCard();
    if (idx === -1 || ankiTotal >= 20) {
      finishAnki();
      return;
    }
    ankiIndex = idx;
    const card = ankiDeck[idx];

    $('#anki-counter').textContent = `Card ${ankiTotal + 1} / 20`;
    $('#anki-card').querySelector('.anki-front').classList.remove('hidden');
    $('#anki-card').querySelector('.anki-back').classList.add('hidden');
    $('#anki-btns').classList.add('hidden');
    $('#anki-feedback').textContent = '';

    // Image
    const imgDiv = $('#anki-image');
    if (card.image) {
      imgDiv.innerHTML = `<img src="${card.image}" alt="${card.fullWord}">`;
    } else {
      imgDiv.innerHTML = '';
    }

    // Prompt
    $('#anki-prompt').textContent = card.prompt;

    // Options
    const grid = $('#anki-options');
    grid.innerHTML = '';
    card.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleAnkiAnswer(opt));
      grid.appendChild(btn);
    });
  }

  function handleAnkiAnswer(chosen) {
    const card = ankiDeck[ankiIndex];
    const correct = chosen === card.answer;
    ankiTotal++;

    // Disable option buttons
    $$('#anki-options .btn').forEach((b) => {
      b.disabled = true;
      if (b.textContent === card.answer) b.style.background = 'var(--success)';
      if (b.textContent === chosen && !correct) b.style.background = 'var(--danger)';
    });

    if (correct) {
      ankiCorrect++;
      $('#anki-feedback').textContent = '✅ Correct!';
      $('#anki-feedback').style.color = 'var(--success)';
    } else {
      $('#anki-feedback').textContent = `❌ It was "${card.answer}"`;
      $('#anki-feedback').style.color = 'var(--danger)';
    }

    // Flip to back
    const frontEl = $('#anki-card').querySelector('.anki-front');
    const backEl = $('#anki-card').querySelector('.anki-back');
    setTimeout(() => {
      frontEl.classList.add('hidden');
      backEl.classList.remove('hidden');
      $('#anki-answer-word').textContent = card.fullWord;
      $('#anki-answer-digraph').textContent = card.digraph;
      $('#anki-btns').classList.remove('hidden');
      if (typeof SpeechHelper !== 'undefined') SpeechHelper.speak(card.fullWord);
    }, 800);
  }

  // Hear button
  $('#btn-anki-hear').addEventListener('click', () => {
    const card = ankiDeck[ankiIndex];
    if (typeof SpeechHelper !== 'undefined') SpeechHelper.speak(card.fullWord);
  });

  // Easy — reduce card weight (less repetition)
  $('#btn-anki-easy').addEventListener('click', () => {
    ankiDeck[ankiIndex].weight = Math.max(0, ankiDeck[ankiIndex].weight - 1);
    showAnkiCard();
  });

  // Hard — increase card weight (more repetition)
  $('#btn-anki-hard').addEventListener('click', () => {
    ankiDeck[ankiIndex].weight += 2;
    showAnkiCard();
  });

  function finishAnki() {
    $('#anki-card').querySelector('.anki-front').classList.add('hidden');
    $('#anki-card').querySelector('.anki-back').classList.add('hidden');
    $('#anki-btns').classList.add('hidden');
    $('#anki-feedback').textContent = '';
    $('#anki-counter').textContent = '';
    $('#anki-done').classList.remove('hidden');
    $('#anki-summary').textContent = `You got ${ankiCorrect} out of ${ankiTotal} correct!`;
  }

  $('#btn-anki').addEventListener('click', () => startAnki());
  $('#btn-anki-restart').addEventListener('click', () => startAnki());
  $('#btn-anki-back').addEventListener('click', () => { renderMap(); showScreen('map'); });
  $('#btn-back-map3').addEventListener('click', () => { renderMap(); showScreen('map'); });

  /* =============================================
     INIT — always start on the title screen
     ============================================= */
  // Title screen is shown by default via the 'active' class in HTML.
  // The user must click "Play" to proceed.
})();
