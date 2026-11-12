(() => {
  const TOTAL = 10;
  const DRAFT_KEY = 'littleSteps.mathsTest.draft.v1';
  const RECORDS_KEY = 'littleSteps.mathsTest.records.v1';
  const NAME_KEY = 'littleSteps.mathsTest.studentName.v1';
  const PROFILE_KEY = 'littleSteps.studentProfile.v1';
  const $ = (id) => document.getElementById(id);
  const screens = { welcome: $('welcome'), topics: document.querySelector('.topics-section'), footer: document.querySelector('.page-footer'), test: $('test-view'), result: $('result-view') };
  let questions = [];
  let answers = [];
  let current = 0;
  let reviewed = false;
  let currentSessionId = null;
  let savedRecords = readStored(RECORDS_KEY, []);
  let savedDraft = readStored(DRAFT_KEY, null);
  let studentProfile = readStored(PROFILE_KEY, null);
  $('student-name').value = localStorage.getItem(NAME_KEY) || '';

  function readStored(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  }

  function saveDraft() {
    if (!questions.length || !currentSessionId) return;
    const draft = { id: currentSessionId, questions, answers, current, studentName: $('student-name').value.trim(), updatedAt: new Date().toISOString() };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); savedDraft = draft; }
    catch { $('save-note').textContent = 'This browser could not save your progress. Try freeing some storage space.'; }
  }

  function renderSavedTests() {
    const section = $('records-section');
    const list = $('records-list');
    list.innerHTML = '';
    section.classList.toggle('hidden', !savedRecords.length);
    $('records-count').textContent = savedRecords.length ? `${savedRecords.length} saved` : '';
    savedRecords.slice(0, 10).forEach((record) => {
      const card = document.createElement('article'); card.className = 'record-card';
      const details = document.createElement('div'); details.className = 'record-details';
      const score = document.createElement('strong'); score.textContent = `${record.studentName || 'Student'} · ${record.score}/${record.total} correct`;
      const date = document.createElement('span'); date.textContent = new Date(record.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      const review = document.createElement('button'); review.className = 'record-review'; review.textContent = 'View answers'; review.type = 'button'; review.addEventListener('click', () => openSavedRecord(record.id));
      details.append(score, date); card.append(details, review); list.append(card);
    });
    const dashboardList = $('dashboard-records');
    if (dashboardList) {
      dashboardList.innerHTML = '';
      savedRecords.slice(0, 10).forEach((record) => {
        const card = document.createElement('article'); card.className = 'record-card';
        const details = document.createElement('div'); details.className = 'record-details';
        const score = document.createElement('strong'); score.textContent = `${record.score}/${record.total} correct · ${Math.round(record.score / record.total * 100)}%`;
        const date = document.createElement('span'); date.textContent = new Date(record.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        const review = document.createElement('button'); review.className = 'record-review'; review.textContent = 'View answers'; review.type = 'button'; review.addEventListener('click', () => openSavedRecord(record.id));
        details.append(score, date); card.append(details, review); dashboardList.append(card);
      });
      $('dashboard-record-count').textContent = savedRecords.length ? `${savedRecords.length} saved` : '';
    }
  }

  function updateWelcome() {
    savedDraft = readStored(DRAFT_KEY, null);
    $('resume-button').classList.toggle('hidden', !savedDraft || !Array.isArray(savedDraft.questions) || !savedDraft.questions.length);
    if (savedDraft) $('save-note').textContent = 'Your unfinished test is saved on this device.';
    $('dashboard-resume-button').classList.toggle('hidden', !savedDraft || !Array.isArray(savedDraft.questions) || !savedDraft.questions.length);
    renderSavedTests();
    updateProgress();
  }

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = (items) => items[rand(0, items.length - 1)];
  const makeOptions = (answer, range = 12) => {
    const values = new Set([answer]);
    while (values.size < 4) {
      const offset = rand(1, range);
      values.add(Math.max(0, answer + (Math.random() < .5 ? -offset : offset)));
    }
    return [...values].sort(() => Math.random() - .5).map(String);
  };
  const mc = (category, prompt, answer, explain, range) => ({ category, prompt, answer: String(answer), explain, options: makeOptions(Number(answer), range) });

  function subtraction() {
    const templates = [
      () => { const total = rand(45, 120), used = rand(12, total - 8); return { prompt: `Mia had ${total} stickers. She gave ${used} stickers to her friend. How many stickers does Mia have left?`, answer: total - used, explain: `${total} − ${used} = ${total - used} stickers.` }; },
      () => { const total = rand(70, 180), sold = rand(15, total - 10); return { prompt: `A library had ${total} storybooks. ${sold} books were borrowed. How many storybooks are still in the library?`, answer: total - sold, explain: `${total} − ${sold} = ${total - sold} storybooks.` }; },
      () => { const total = rand(35, 90), ate = rand(8, total - 5); return { prompt: `There were ${total} apples in a basket. The family ate ${ate} apples. How many apples are left?`, answer: total - ate, explain: `${total} − ${ate} = ${total - ate} apples.` }; },
      () => { const total = rand(80, 200), spent = rand(20, total - 10); return { prompt: `Sam saved ₹${total}. He spent ₹${spent} on a toy. How much money does he have left?`, answer: total - spent, explain: `₹${total} − ₹${spent} = ₹${total - spent}.` }; }
    ];
    const q = pick(templates)();
    return { category: 'SUBTRACTION · STORY SUM', prompt: q.prompt, answer: String(q.answer), explain: q.explain, numeric: true };
  }

  function shapeQuestion() {
    const pool = [
      ['How many sides does a hexagon have?', '6', 'A hexagon has 6 sides.'],
      ['Which plane shape has 4 equal sides and 4 corners?', 'Square', 'A square has 4 equal sides and 4 corners.'],
      ['Which solid shape looks like a ball?', 'Sphere', 'A sphere is round like a ball.'],
      ['Which solid shape has 6 square faces, like a dice?', 'Cube', 'A cube has 6 square faces.'],
      ['How many corners does a triangle have?', '3', 'A triangle has 3 corners.'],
      ['Which solid shape has one curved surface and two flat circular faces?', 'Cylinder', 'A cylinder has two flat circular faces and one curved surface.'],
      ['Which plane shape has no straight sides and no corners?', 'Circle', 'A circle has no straight sides or corners.'],
      ['Which solid shape has a point at the top and a circular base?', 'Cone', 'A cone has a circular base and one point.'],
      ['How many faces does a cuboid have?', '6', 'A cuboid has 6 faces.'],
      ['A rectangle has how many sides?', '4', 'A rectangle has 4 sides.']
    ];
    const [prompt, answer, explain] = pick(pool);
    const distractors = answer === '6' ? ['4', '5', '8'] : answer === '4' ? ['3', '5', '6'] : ['Triangle', 'Cube', 'Circle', 'Cone', 'Sphere'].filter((x) => x !== answer).slice(0, 3);
    return { category: 'SHAPES · PLANE & SOLID', prompt, answer, explain, options: [...new Set([answer, ...distractors])].sort(() => Math.random() - .5) };
  }

  function multiplication() {
    const type = rand(0, 5);
    if (type === 0) { const a = rand(2, 10), b = rand(2, 10); return mc('MULTIPLICATION · TABLES', `What is ${a} × ${b}?`, a * b, `${a} × ${b} = ${a * b}.`, 15); }
    if (type === 1) { const a = rand(2, 8), b = rand(2, 7); return mc('MULTIPLICATION · REPEATED ADDITION', `${a} groups of ${b} can be written as ${a} × ${b}. What is the answer?`, a * b, `${a} groups of ${b} means ${b} added ${a} times: ${a} × ${b} = ${a * b}.`, 12); }
    if (type === 2) { const a = rand(2, 9); return mc('MULTIPLICATION · DOUBLES', `What is double ${a}?`, a * 2, `Double ${a} means ${a} + ${a} = ${a * 2}.`, 8); }
    if (type === 3) { const a = rand(2, 9); return mc('MULTIPLICATION · BY 10', `${a} × 10 = ?`, a * 10, `When you multiply ${a} by 10, the answer is ${a * 10}.`, 25); }
    if (type === 4) { const a = rand(2, 9); return mc('MULTIPLICATION · BY 100', `${a} × 100 = ?`, a * 100, `${a} × 100 = ${a * 100}.`, 200); }
    const a = pick([2, 5, 10]), b = rand(2, 12);
    return mc(`MULTIPLICATION · ${a} TIMES TABLE`, `What is ${a} × ${b}?`, a * b, `${a} × ${b} = ${a * b}.`, 15);
  }

  function buildTest() {
    const list = [subtraction(), subtraction(), shapeQuestion(), shapeQuestion(), multiplication(), multiplication(), multiplication(), multiplication(), multiplication(), multiplication()];
    return list.sort(() => Math.random() - .5);
  }

  function showScreen(name) {
    const dashboard = $('student-dashboard');
    const onDashboard = name === 'welcome' && !!studentProfile;
    dashboard.classList.toggle('hidden', !onDashboard);
    screens.welcome.classList.toggle('hidden', name !== 'welcome');
    screens.welcome.classList.toggle('hidden', name !== 'welcome' || onDashboard);
    screens.topics.classList.toggle('hidden', name !== 'welcome' || onDashboard);
    screens.footer.classList.toggle('hidden', name !== 'welcome' || onDashboard);
    screens.test.classList.toggle('hidden', name !== 'test');
    screens.result.classList.toggle('hidden', name !== 'result');
    $('profile-setup').classList.add('hidden');
    if (onDashboard) showDashboardPanel('overview-panel');
    if (name === 'welcome') updateWelcome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startTest() {
    const name = $('student-name').value.trim();
    localStorage.setItem(NAME_KEY, name);
    questions = buildTest(); answers = Array(TOTAL).fill(null); current = 0; reviewed = false; currentSessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    renderQuestion(); showScreen('test');
  }

  function showDashboardPanel(id) {
    document.querySelectorAll('.dashboard-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== id));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    if (id === 'progress-panel') updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgress() {
    const scores = savedRecords.map((record) => Math.round(record.score / record.total * 100));
    const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    $('stat-tests').textContent = String(scores.length);
    $('stat-average').textContent = `${average}%`;
    $('stat-capability').textContent = `${average}%`;
    $('progress-ring-value').textContent = `${average}%`;
    $('progress-ring').style.setProperty('--progress', `${average * 3.6}deg`);
    $('progress-summary-title').textContent = scores.length ? (average >= 80 ? 'Your practice is paying off!' : average >= 50 ? 'You are building your skills.' : 'Keep practising, one step at a time.') : 'Your first test is a great place to begin.';
    $('progress-summary-copy').textContent = scores.length ? `Based on ${scores.length} completed maths test${scores.length === 1 ? '' : 's'}. Review answers and keep practising to see your progress.` : 'Complete a maths test to see your saved score and review your answers.';
    if (studentProfile) {
      $('dashboard-name').textContent = studentProfile.name.split(' ')[0];
      $('dashboard-school').textContent = `${studentProfile.grade} · ${studentProfile.school}`;
      $('header-name').textContent = studentProfile.name.split(' ')[0];
      $('header-avatar').textContent = studentProfile.photo ? '' : studentProfile.name.slice(0, 1).toUpperCase();
      $('header-avatar').style.backgroundImage = studentProfile.photo ? `url("${studentProfile.photo}")` : '';
    }
  }

  function openProfileSetup() {
    const form = $('profile-form');
    if (studentProfile) {
      form.elements.name.value = studentProfile.name || '';
      form.elements.age.value = studentProfile.age || '';
      form.elements.grade.value = studentProfile.grade || '';
      form.elements.school.value = studentProfile.school || '';
      if (studentProfile.photo) {
        $('photo-preview-image').src = studentProfile.photo;
        $('photo-preview').classList.remove('hidden');
      }
      $('setup-title').textContent = 'Your student profile';
      form.querySelector('.setup-submit').innerHTML = 'Save changes <span>✓</span>';
    }
    $('profile-setup').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const speakingPrompts = [
    ['Hello! What is your name?', 'Try saying: “Hello, my name is …”'],
    ['What do you like to do after school?', 'Try saying: “After school, I like to …”'],
    ['What is your favourite subject?', 'Try saying: “My favourite subject is … because …”'],
    ['Can you tell me about your school?', 'Try saying: “My school is … and I enjoy …”']
  ];
  let speakingIndex = 0;
  function renderSpeakingPrompt() {
    $('speaking-progress').textContent = `PROMPT ${speakingIndex + 1} OF ${speakingPrompts.length}`;
    $('speaking-prompt').textContent = speakingPrompts[speakingIndex][0];
    $('speaking-tip').textContent = speakingPrompts[speakingIndex][1];
    $('speech-transcript').textContent = 'Your spoken words will appear here.';
  }

  function resumeTest() {
    const draft = readStored(DRAFT_KEY, null);
    if (!draft || !Array.isArray(draft.questions) || draft.questions.length !== TOTAL) { updateWelcome(); return; }
    questions = draft.questions; answers = Array.isArray(draft.answers) ? draft.answers : Array(TOTAL).fill(null); current = Math.max(0, Math.min(TOTAL - 1, Number(draft.current) || 0));
    currentSessionId = draft.id; reviewed = false; $('student-name').value = draft.studentName || $('student-name').value;
    renderQuestion(); showScreen('test');
  }

  function renderQuestion() {
    const q = questions[current];
    $('test-number').textContent = `${String(current + 1).padStart(2, '0')} / ${TOTAL}`;
    $('question-progress').textContent = `QUESTION ${current + 1} OF ${TOTAL}`;
    $('progress-fill').style.width = `${((current + 1) / TOTAL) * 100}%`;
    $('category-pill').textContent = q.category;
    $('question-text').textContent = q.prompt;
    const area = $('answer-area'); area.innerHTML = '';
    if (q.options) {
      q.options.forEach((option, i) => {
        const label = document.createElement('label'); label.className = 'answer-option' + (answers[current] === option ? ' selected' : '');
        const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = option; input.checked = answers[current] === option;
        input.addEventListener('change', () => { answers[current] = option; area.querySelectorAll('.answer-option').forEach((el) => el.classList.remove('selected')); label.classList.add('selected'); saveDraft(); });
        label.append(input, document.createTextNode(option)); area.append(label);
      });
    } else {
      const input = document.createElement('input'); input.className = 'answer-input'; input.type = 'number'; input.inputMode = 'numeric'; input.placeholder = 'Type your answer'; input.setAttribute('aria-label', 'Your answer'); input.value = answers[current] ?? '';
      input.addEventListener('input', () => { answers[current] = input.value; saveDraft(); }); area.append(input);
      const hint = document.createElement('span'); hint.className = 'answer-hint'; hint.textContent = 'Write the number only'; area.append(hint);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') $('next-button').click(); });
    }
    $('next-button').innerHTML = current === TOTAL - 1 ? 'Finish my test <span>✓</span>' : 'Next question <span>→</span>';
    saveDraft();
  }

  function finishTest() {
    const score = questions.reduce((sum, q, i) => sum + (String(answers[i] ?? '').trim().toLowerCase() === q.answer.toLowerCase() ? 1 : 0), 0);
    const record = { id: currentSessionId || `test-${Date.now()}`, studentName: $('student-name').value.trim(), completedAt: new Date().toISOString(), score, total: TOTAL, questions: JSON.parse(JSON.stringify(questions)), answers: [...answers] };
    savedRecords = [record, ...savedRecords.filter((item) => item.id !== record.id)].slice(0, 30);
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(savedRecords)); localStorage.removeItem(DRAFT_KEY); savedDraft = null; }
    catch { $('save-note').textContent = 'Your score could not be saved in this browser.'; }
    currentSessionId = null;
    showResult(score, record.studentName, false, record.completedAt);
  }

  function showResult(score, studentName, saved, completedAt) {
    $('score-value').textContent = `${score}/${TOTAL}`; $('score-percent').textContent = `${score * 10}%`;
    const title = score === TOTAL ? 'Amazing work!' : score >= 7 ? 'You did so well!' : score >= 4 ? 'Look at you go!' : 'You did it!';
    $('result-title').textContent = saved ? 'Saved test record' : title;
    $('result-message').textContent = saved ? `${studentName || 'Student'} · Completed ${new Date(completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : score >= 7 ? 'You really know your stuff. Keep that brilliant brain growing!' : 'Every bit of practice helps you grow. Give yourself a little cheer!';
    $('result-medal').textContent = score >= 7 ? '★' : '✦';
    $('review-list').classList.add('hidden'); reviewed = false; $('review-button').textContent = 'Review my answers →'; showScreen('result');
  }

  function openSavedRecord(id) {
    const record = savedRecords.find((item) => item.id === id);
    if (!record) return;
    questions = record.questions; answers = record.answers; currentSessionId = null;
    showResult(record.score, record.studentName, true, record.completedAt);
  }

  function reviewAnswers() {
    const list = $('review-list'); list.innerHTML = '';
    questions.forEach((q, i) => {
      const isCorrect = String(answers[i] ?? '').trim().toLowerCase() === q.answer.toLowerCase();
      const row = document.createElement('article'); row.className = 'review-row';
      const title = document.createElement('h3'); title.textContent = `${i + 1}. ${q.prompt}`;
      const status = document.createElement('p'); status.className = isCorrect ? 'correct-label' : 'wrong-label';
      status.textContent = isCorrect ? `✓ Your answer: ${answers[i]}` : `Your answer: ${answers[i] ?? 'Not answered'} · Correct answer: ${q.answer}`;
      const explain = document.createElement('p'); explain.textContent = q.explain;
      row.append(title, status, explain); list.append(row);
    });
    list.classList.remove('hidden'); $('review-button').textContent = 'Hide answer review ↑'; reviewed = true;
  }

  $('start-button').addEventListener('click', startTest);
  $('resume-button').addEventListener('click', resumeTest);
  $('new-test-button').addEventListener('click', startTest);
  $('result-home-button').addEventListener('click', () => showScreen('welcome'));
  $('student-name').addEventListener('input', () => { localStorage.setItem(NAME_KEY, $('student-name').value); if (currentSessionId) saveDraft(); renderSavedTests(); });
  $('exit-button').addEventListener('click', () => { saveDraft(); showScreen('welcome'); });
  $('next-button').addEventListener('click', () => { if (current < TOTAL - 1) { current++; saveDraft(); renderQuestion(); window.scrollTo({ top: 0, behavior: 'smooth' }); } else finishTest(); });
  $('review-button').addEventListener('click', () => reviewed ? ($('review-list').classList.add('hidden'), $('review-button').textContent = 'Review my answers →', reviewed = false) : reviewAnswers());
  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => showDashboardPanel(button.dataset.panel)));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showDashboardPanel(button.dataset.go)));
  $('dashboard-test-button').addEventListener('click', startTest);
  $('course-test-button').addEventListener('click', startTest);
  $('dashboard-resume-button').addEventListener('click', resumeTest);
  $('profile-chip').addEventListener('click', openProfileSetup);
  $('edit-profile-button').addEventListener('click', openProfileSetup);
  $('google-signin-button').addEventListener('click', () => { $('auth-note').textContent = 'Google account sign-in is not connected yet. This site needs its owner to configure Google OAuth and secure account storage.'; });
  $('profile-photo').addEventListener('change', () => {
    const file = $('profile-photo').files[0];
    if (!file) return;
    if (file.size > 1200000) { $('auth-note').textContent = 'Please choose a picture smaller than 1.2 MB.'; $('profile-photo').value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { $('photo-preview-image').src = reader.result; $('photo-preview').classList.remove('hidden'); };
    reader.readAsDataURL(file);
  });
  $('remove-photo-button').addEventListener('click', () => { $('profile-photo').value = ''; $('photo-preview').classList.add('hidden'); if (studentProfile) studentProfile.photo = ''; });
  $('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    studentProfile = { name: form.elements.name.value.trim(), age: form.elements.age.value, grade: form.elements.grade.value.trim(), school: form.elements.school.value.trim(), photo: $('photo-preview').classList.contains('hidden') ? '' : $('photo-preview-image').src };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(studentProfile)); localStorage.setItem(NAME_KEY, studentProfile.name); $('student-name').value = studentProfile.name; }
    catch { $('auth-note').textContent = 'Your profile picture may be too large to save. Choose a smaller image and try again.'; return; }
    $('setup-title').textContent = 'Your student profile';
    showScreen('welcome');
  });
  $('hear-prompt-button').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) { $('speech-note').textContent = 'Prompt audio is not available in this browser.'; return; }
    const utterance = new SpeechSynthesisUtterance($('speaking-prompt').textContent); utterance.lang = 'en-IN'; window.speechSynthesis.speak(utterance);
  });
  $('listen-button').addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { $('speech-note').textContent = 'Voice input is not supported in this browser. You can still practise aloud and use Hear prompt.'; return; }
    const recognition = new Recognition(); recognition.lang = 'en-IN'; recognition.interimResults = false;
    $('speech-note').textContent = 'Listening… say your answer now.';
    recognition.onresult = (event) => { $('speech-transcript').textContent = event.results[0][0].transcript; $('speech-note').textContent = 'Nice practice! Try the phrase again or move to the next prompt.'; };
    recognition.onerror = () => { $('speech-note').textContent = 'The microphone could not start. Check browser microphone permission and try again.'; };
    recognition.start();
  });
  $('next-speaking-button').addEventListener('click', () => { speakingIndex = (speakingIndex + 1) % speakingPrompts.length; renderSpeakingPrompt(); });
  renderSpeakingPrompt();
  window.addEventListener('pagehide', saveDraft);
  updateWelcome();
  if (studentProfile && studentProfile.name) { updateProgress(); showScreen('welcome'); }
  else { $('profile-setup').classList.remove('hidden'); }
})();

