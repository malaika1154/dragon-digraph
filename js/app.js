/* ==========================================
   Dragon Digraph — Main Application
   ========================================== */

(async function () {
  'use strict';

  /* ---- Load data files ---- */
  const [configRes, blendsRes] = await Promise.all([
    fetch('data/config.json'),
    fetch('data/blends.json')
  ]);
  const CONFIG = await configRes.json();
  const BLEND_DATA = (await blendsRes.json()).blends;

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
      // stageProgress[blendId][stageType] = { completed: bool, score: n }
      stageProgress: {},
      dragonsEarned: [] // blend ids with all 4 stages done
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
    const prevBlend = BLEND_DATA[index - 1];
    return save.dragonsEarned.includes(prevBlend.id);
  }

  function isIslandComplete(blendId) {
    return save.dragonsEarned.includes(blendId);
  }

  function renderMap() {
    const av = getAvatar();
    $('#player-avatar-icon').textContent = av.emoji;
    $('#player-name').textContent = av.name;
    $('#dragon-count').textContent = save.dragonsEarned.length;

    const grid = $('#island-grid');
    grid.innerHTML = '';

    BLEND_DATA.forEach((blend, idx) => {
      const unlocked = isIslandUnlocked(idx);
      const complete = isIslandComplete(blend.id);
      const card = document.createElement('div');
      card.className = 'island-card' + (unlocked ? '' : ' locked');
      card.style.background = blend.island.background;
      card.style.color = blend.island.color;
      card.innerHTML = `
        <div class="icon">${blend.island.icon}</div>
        <h3>${blend.island.name}</h3>
        <div class="blend-label">${blend.blend}</div>
        ${complete ? '<span class="check-badge">✅</span>' : ''}
        ${!unlocked ? '<span class="lock-badge">🔒</span>' : ''}`;
      if (unlocked) {
        card.addEventListener('click', () => openIsland(blend));
      }
      grid.appendChild(card);
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
    BLEND_DATA.forEach((blend) => {
      const earned = save.dragonsEarned.includes(blend.id);
      const cell = document.createElement('div');
      cell.className = 'dragon-cell' + (earned ? '' : ' empty');
      cell.innerHTML = `
        <div class="dragon-emoji">${earned ? blend.island.icon : '❓'}</div>
        <h4>${blend.island.name}</h4>
        <p>${earned ? 'Earned!' : 'Locked'}</p>`;
      container.appendChild(cell);
    });
  }

  /* =============================================
     STAGE SELECT for an island
     ============================================= */
  let currentBlend = null;

  function getStageProgress(blendId, stageType) {
    return (save.stageProgress[blendId] && save.stageProgress[blendId][stageType]) || null;
  }

  function isStageUnlocked(blendId, stageIdx) {
    if (stageIdx === 0) return true;
    const prevType = CONFIG.stageTypes[stageIdx - 1].id;
    const prev = getStageProgress(blendId, prevType);
    return prev && prev.completed;
  }

  function openIsland(blend) {
    currentBlend = blend;
    $('#island-title').textContent = `${blend.island.icon} ${blend.island.name}`;

    const list = $('#stage-list');
    list.innerHTML = '';

    CONFIG.stageTypes.forEach((st, idx) => {
      const prog = getStageProgress(blend.id, st.id);
      const unlocked = isStageUnlocked(blend.id, idx);
      const card = document.createElement('div');
      card.className = 'stage-card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="stage-icon">${st.icon}</div>
        <div class="stage-info">
          <h3>${st.name}</h3>
          <p>${st.description}</p>
        </div>
        <div class="stage-status">${prog && prog.completed ? '✅' : unlocked ? '▶️' : '🔒'}</div>`;
      if (unlocked) {
        card.addEventListener('click', () => launchStage(blend, st.id));
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
      if (currentBlend) openIsland(currentBlend);
    }
  });

  /* =============================================
     STAGE LAUNCHER
     ============================================= */
  function launchStage(blend, stageType) {
    currentBlend = blend;
    switch (stageType) {
      case 'listen': startListen(blend); break;
      case 'quiz': startQuiz(blend); break;
      case 'dragdrop': startDragDrop(blend); break;
      case 'speech': startSpeech(blend); break;
    }
  }

  function markStageComplete(blendId, stageType, score) {
    if (!save.stageProgress[blendId]) save.stageProgress[blendId] = {};
    save.stageProgress[blendId][stageType] = { completed: true, score };

    // Check if all stages done → earn dragon
    const allDone = CONFIG.stageTypes.every((st) => {
      const p = getStageProgress(blendId, st.id);
      return p && p.completed;
    });
    if (allDone && !save.dragonsEarned.includes(blendId)) {
      save.dragonsEarned.push(blendId);
    }
    writeSave(save);
    return allDone && save.dragonsEarned.includes(blendId);
  }

  /* =============================================
     LISTEN & LEARN
     ============================================= */
  function startListen(blend) {
    $('#listen-blend').textContent = blend.blend;
    $('#listen-pronunciation').textContent = blend.pronunciation;

    const container = $('#listen-words');
    container.innerHTML = '';

    blend.stages.listen.words.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'listen-word-card';
      let inner = '';
      if (w.image) inner += `<img src="${encodeURI(w.image)}" alt="${w.word}">`;
      inner += `<div class="word-label">${highlightBlend(w.word, blend.blend)}</div>`;
      card.innerHTML = inner;
      card.addEventListener('click', () => Speech.speak(w.word));
      container.appendChild(card);
    });

    // Mark listen stage as complete immediately (it's informational)
    markStageComplete(blend.id, 'listen', 0);
    showScreen('listen');
  }

  function highlightBlend(word, blend) {
    const idx = word.toLowerCase().indexOf(blend.toLowerCase());
    if (idx === -1) return word;
    return word.substring(0, idx) +
      `<strong style="color:var(--primary)">${word.substring(idx, idx + blend.length)}</strong>` +
      word.substring(idx + blend.length);
  }

  /* =============================================
     QUIZ
     ============================================= */
  let quizState = {};

  function startQuiz(blend) {
    const questions = shuffle(blend.stages.quiz.questions).slice(0, CONFIG.questionsPerStage);
    quizState = { blend, questions, idx: 0, score: 0 };
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
      $('#quiz-feedback').textContent = `✅ Correct! The word is "${question.fullWord}"`;
      $('#quiz-feedback').className = 'feedback correct';
      Speech.speak(question.fullWord);
    } else {
      // Highlight correct
      $$('#quiz-options .option-btn').forEach((b) => {
        if (b.textContent === question.answer) b.classList.add('correct');
      });
      $('#quiz-feedback').textContent = `❌ The answer was "${question.answer}" → "${question.fullWord}"`;
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

  function startDragDrop(blend) {
    const questions = shuffle(blend.stages.dragdrop.questions).slice(0, CONFIG.questionsPerStage);
    ddState = { blend, questions, idx: 0, score: 0 };
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
      $('#dd-feedback').textContent = `✅ Correct! "${question.fullWord}"`;
      $('#dd-feedback').className = 'feedback correct';
      Speech.speak(question.fullWord);
    } else {
      $('#dd-feedback').textContent = `❌ The answer was "${question.answer}" → "${question.fullWord}"`;
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

  function startSpeech(blend) {
    const words = shuffle(blend.stages.speech.words).slice(0, CONFIG.questionsPerStage);
    spState = { blend, words, idx: 0, score: 0 };

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
    btn.classList.add('recording');
    btn.disabled = true;
    $('#sp-heard').textContent = 'Listening...';

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
        $('#sp-feedback').textContent = '✅ Great job!';
        $('#sp-feedback').className = 'feedback correct';
      } else {
        $('#sp-feedback').textContent = `❌ Try again! The word is "${target}"`;
        $('#sp-feedback').className = 'feedback wrong';
      }
    } catch {
      btn.classList.remove('recording');
      $('#sp-heard').textContent = 'Could not hear you — try again!';
    }

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
    const earnedDragon = passed ? markStageComplete(currentBlend.id, stageType, score) : false;

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
      $('#earned-dragon').textContent = currentBlend.island.icon + ' 🐉';
    } else {
      $('#complete-dragon').classList.add('hidden');
    }

    showScreen('complete');
  }

  $('#btn-continue').addEventListener('click', () => {
    if (currentBlend) {
      openIsland(currentBlend);
    } else {
      renderMap();
      showScreen('map');
    }
  });

  /* =============================================
     INIT — restore session on reload
     ============================================= */
  if (save.avatar) {
    renderMap();
    showScreen('map');
  } else {
    showScreen('welcome');
  }
})();
