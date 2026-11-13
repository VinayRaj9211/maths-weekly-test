import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, browserLocalPersistence, setPersistence, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const firebaseConfig = {
  projectId: 'riya-maths-learning-2026',
  appId: '1:616031513067:web:5f798f78d44edd0eda51ae',
  storageBucket: 'riya-maths-learning-2026.firebasestorage.app',
  apiKey: 'AIzaSyBNYjh35jjLPioKld4-5HdydbviCV9sEos',
  authDomain: 'riya-maths-learning-2026.firebaseapp.com',
  messagingSenderId: '616031513067'
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => console.info('Using Firebase Auth default persistence.', error.code || error.message));
const db = getFirestore(firebaseApp);
const COURSE_ADMIN_EMAIL = 'hansaaytech@gmail.com';
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

(() => {
  const TOTAL = 10;
  const DRAFT_KEY = 'littleSteps.mathsTest.draft.v1';
  const RECORDS_KEY = 'littleSteps.mathsTest.records.v1';
  const NAME_KEY = 'littleSteps.mathsTest.studentName.v1';
  const PROFILE_KEY = 'littleSteps.studentProfile.v1';
  let activeRecordsKey = RECORDS_KEY;
  let activeDraftKey = DRAFT_KEY;
  let activeNameKey = NAME_KEY;
  const $ = (id) => document.getElementById(id);
  const screens = { welcome: $('welcome'), topics: document.querySelector('.topics-section'), footer: document.querySelector('.page-footer'), test: $('test-view'), result: $('result-view') };
  let questions = [];
  let answers = [];
  let current = 0;
  let reviewed = false;
  let currentSessionId = null;
  let savedRecords = readStored(activeRecordsKey, []);
  let savedDraft = readStored(activeDraftKey, null);
  let studentProfile = readStored(PROFILE_KEY, null);
  let signedInUser = null;
  let authMode = 'signin';
  $('student-name').value = localStorage.getItem(activeNameKey) || '';

  function readStored(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  }

  async function saveProfileToCloud(profile) {
    if (!signedInUser) return;
    const { uid, name, age, grade, school, curriculum, medium, photo } = profile;
    await setDoc(doc(db, 'students', signedInUser.uid), { uid, email: signedInUser.email || '', name, age: Number(age), grade, school, curriculum, medium: medium || 'English', photo, updatedAt: serverTimestamp() }, { merge: true });
  }

  async function loadCloudRecords() {
    if (!signedInUser) return;
    try {
      const result = await getDocs(query(collection(db, 'students', signedInUser.uid, 'testRecords'), orderBy('completedAt', 'desc')));
      const cloudRecords = result.docs.map((item) => { const data = item.data(); return { ...data, completedAt: data.completedAt?.toDate?.().toISOString?.() || data.completedAt, id: item.id }; });
      const localOnly = savedRecords.filter((record) => !cloudRecords.some((cloudRecord) => cloudRecord.id === record.id));
      savedRecords = [...cloudRecords, ...localOnly].slice(0, 30);
      localStorage.setItem(activeRecordsKey, JSON.stringify(savedRecords));
      renderSavedTests();
    } catch (error) {
      console.info('Cloud test history is unavailable until Firestore is enabled and secured.', error.code || error.message);
    }
  }

  function saveDraft() {
    if (!questions.length || !currentSessionId) return;
    const draft = { id: currentSessionId, questions, answers, current, studentName: $('student-name').value.trim(), updatedAt: new Date().toISOString() };
    try { localStorage.setItem(activeDraftKey, JSON.stringify(draft)); savedDraft = draft; }
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
    savedDraft = readStored(activeDraftKey, null);
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
    if (!signedInUser) {
      $('auth-page').classList.remove('hidden');
      dashboard.classList.add('hidden');
      screens.welcome.classList.add('hidden'); screens.topics.classList.add('hidden'); screens.footer.classList.add('hidden'); screens.test.classList.add('hidden'); screens.result.classList.add('hidden');
      $('profile-setup').classList.add('hidden');
      return;
    }
    $('auth-page').classList.add('hidden');
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

  function startTest(chapterTitle = '', courseQuestionBank = null) {
    const name = $('student-name').value.trim();
    localStorage.setItem(activeNameKey, name);
    if (Array.isArray(courseQuestionBank) && courseQuestionBank.length) {
      questions = Array.from({ length: TOTAL }, () => {
        const source = pick(courseQuestionBank);
        return { category: String(source.category || chapterTitle || 'COURSE PRACTICE').toUpperCase(), prompt: String(source.prompt || ''), answer: String(source.answer ?? ''), explain: String(source.explain || 'Review the lesson and try another question.'), ...(Array.isArray(source.options) && source.options.length ? { options: source.options.map(String) } : {}) };
      });
    } else if (/subtraction/i.test(chapterTitle)) questions = Array.from({ length: TOTAL }, subtraction);
    else if (/shape/i.test(chapterTitle)) questions = Array.from({ length: TOTAL }, shapeQuestion);
    else if (/multiplication/i.test(chapterTitle)) questions = Array.from({ length: TOTAL }, multiplication);
    else questions = buildTest();
    answers = Array(TOTAL).fill(null); current = 0; reviewed = false; currentSessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    renderQuestion(); showScreen('test');
  }

  function showDashboardPanel(id) {
    document.querySelectorAll('.dashboard-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== id));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    if (id === 'progress-panel') updateProgress();
    if (id === 'courses-panel') loadSchoolCourseware();
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
      $('dashboard-school').textContent = `${studentProfile.grade} · ${studentProfile.school} · ${studentProfile.curriculum || 'School syllabus'}`;
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
      form.elements.curriculum.value = studentProfile.curriculum || 'School syllabus';
      form.elements.medium.value = studentProfile.medium || 'English';
      if (studentProfile.photo) {
        $('photo-preview-image').src = studentProfile.photo;
        $('photo-preview').classList.remove('hidden');
      }
      $('setup-title').textContent = 'Your student profile';
      form.querySelector('.setup-submit').innerHTML = 'Save changes <span>✓</span>';
    }
    if (signedInUser && !form.elements.name.value) form.elements.name.value = signedInUser.displayName || '';
    $('sign-out-button').classList.toggle('hidden', !signedInUser);
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

  const officialBooksUrl = 'https://epathshala.nic.in/wp-content/doc/book/btextbook/textbook.htm';
  let courseSubjects = [
    { name: 'Mathematics', books: [{ name: 'School test syllabus · Term 2', chapters: [
      { title: 'Subtraction story sums', summary: 'Find what remains by subtracting the part taken away from the starting amount.', lessons: ['Underline the starting amount.', 'Find the amount that is taken away or used.', 'Subtract and write the answer with its unit.'], videoQuery: 'primary school subtraction word problems', worksheet: ['Aarav had 68 marbles and gave 24 away. How many remain?', 'There were 95 books. 37 were borrowed. How many are still there?'] },
      { title: 'Plane and solid shapes', summary: 'Notice the sides, corners, faces and curved surfaces that make shapes different.', lessons: ['Name flat shapes by their sides and corners.', 'Name solid shapes by their faces and curved surfaces.', 'Connect solids to familiar objects around you.'], videoQuery: 'primary school plane solid shapes faces edges vertices', worksheet: ['Name a solid shape that looks like a ball.', 'How many equal sides does a square have?'] },
      { title: 'Multiplication', summary: 'Multiplication counts equal groups quickly and can be shown as repeated addition.', lessons: ['Make equal groups to model a multiplication fact.', 'Practise the 2, 5 and 10 times tables.', 'Use doubles and multiplication by 10 or 100.'], videoQuery: 'primary school multiplication repeated addition tables 2 5 10', worksheet: ['Write 4 groups of 5 as repeated addition.', 'What is double 8?'] }
    ] }] },
    { name: 'English', books: [
      { name: 'Grammar & language practice', chapters: [
        { title: 'Build a clear sentence', summary: 'A sentence shares a complete idea and begins with a capital letter.', lessons: ['Choose who or what the sentence is about.', 'Add an action or useful detail.', 'Begin with a capital and finish with punctuation.'], videoQuery: 'primary English sentence building grammar', worksheet: ['Write one sentence about your favourite game.', 'Add the missing full stop: I like reading'] },
        { title: 'Naming and action words', summary: 'Naming words tell who or what; action words tell what someone or something does.', lessons: ['Spot people, places, animals and things.', 'Find the action in a sentence.', 'Read the sentence again to check that it makes sense.'], videoQuery: 'primary English nouns verbs action words', worksheet: ['Circle the naming word: The dog runs.', 'Write one action word for a bird.'] }
      ] },
      { name: 'Literature · school reader', chapters: [] },
      { name: 'Speaking course', chapters: speakingPrompts.map(([title, summary]) => ({ title, summary, lessons: [summary], videoQuery: 'beginner English speaking practice for children', worksheet: ['Say your answer aloud, then try once more using a complete sentence.'] })) }
    ] },
    { name: 'Hindi', books: [{ name: 'Hindi · school textbook', chapters: [] }, { name: 'Hindi grammar', chapters: [] }] },
    { name: 'Environmental Studies / Science', books: [{ name: 'School textbook', chapters: [] }, { name: 'Science practice', chapters: [] }] },
    { name: 'Social Studies', books: [{ name: 'School textbook', chapters: [] }] },
    { name: 'Computer Studies', books: [{ name: 'School textbook', chapters: [] }] },
    { name: 'General Knowledge', books: [{ name: 'School workbook', chapters: [] }] },
    { name: 'Art & Craft', books: [{ name: 'Activities', chapters: [] }] },
    { name: 'Physical Education', books: [{ name: 'Activities', chapters: [] }] }
  ];
  const defaultCourseSubjects = courseSubjects;
  let courseSelection = { subject: 'Mathematics', book: 'School test syllabus · Term 2', chapter: 'Subtraction story sums' };

  function schoolCurriculumKey(profile = studentProfile || {}) {
    return [profile.school, profile.grade, profile.curriculum, profile.medium || 'English'].map((part) => String(part || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join('--');
  }

  function legacySchoolCurriculumKey(profile = studentProfile || {}) {
    return [profile.school, profile.grade, profile.curriculum].map((part) => String(part || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).join('--');
  }

  async function loadSchoolCourseware() {
    const profile = studentProfile || {};
    if (!signedInUser || !profile.school || !profile.grade) {
      $('course-library-note').textContent = 'Add your school and class to look for its confirmed chapter list.';
      renderCourseware();
      return;
    }
    $('course-library-note').textContent = 'Checking the course catalogue for your school and class…';
    try {
      let snapshot = await getDoc(doc(db, 'schoolCurricula', schoolCurriculumKey(profile)));
      if (!snapshot.exists()) snapshot = await getDoc(doc(db, 'schoolCurricula', legacySchoolCurriculumKey(profile)));
      if (!snapshot.exists() || !Array.isArray(snapshot.data().subjects)) {
        courseSubjects = defaultCourseSubjects;
        $('course-library-note').textContent = `No confirmed course map is saved for ${profile.school} · ${profile.grade} yet. The school syllabus needs to be added before all subjects can be matched.`;
      } else {
        const data = snapshot.data();
        courseSubjects = data.subjects;
        $('course-library-note').textContent = `Course map matched to ${data.school || profile.school} · ${data.grade || profile.grade}${data.sourceName ? ` · Source: ${data.sourceName}` : ''}.`;
      }
    } catch {
      $('course-library-note').textContent = 'The school course catalogue could not be reached. Your current practice remains available.';
    }
    courseSelection = { subject: courseSubjects[0]?.name || 'Mathematics', book: '', chapter: '' };
    renderCourseware();
  }

  function fillSelect(select, values, chosen) {
    select.innerHTML = '';
    values.forEach((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); });
    if (values.includes(chosen)) select.value = chosen;
  }

  function renderCourseware() {
    const profile = studentProfile || {};
    $('course-match-title').textContent = profile.school ? `Course list for ${profile.school}` : 'Match a course to your school';
    $('course-match-copy').textContent = profile.school ? `${profile.grade || 'Your class'} · ${profile.curriculum || 'School syllabus'} · ${profile.medium || 'English'} medium. School-specific chapters appear once the syllabus has been confirmed.` : 'Add your school and class to match lessons and tests to the right syllabus.';
    $('course-subject-count').textContent = `${courseSubjects.length} subject areas`;
    const courseAdmin = $('course-map-admin');
    if (courseAdmin) courseAdmin.classList.toggle('hidden', (signedInUser?.email || '').toLowerCase() !== COURSE_ADMIN_EMAIL);
    const subjectNames = courseSubjects.map((subject) => subject.name);
    if (!subjectNames.includes(courseSelection.subject)) courseSelection.subject = subjectNames[0];
    fillSelect($('course-subject-select'), subjectNames, courseSelection.subject);
    const subject = courseSubjects.find((item) => item.name === courseSelection.subject) || courseSubjects[0];
    const bookNames = subject.books.map((book) => book.name);
    if (!bookNames.includes(courseSelection.book)) courseSelection.book = bookNames[0];
    fillSelect($('course-book-select'), bookNames, courseSelection.book);
    const book = subject.books.find((item) => item.name === courseSelection.book) || subject.books[0];
    const chapterNames = book.chapters.map((chapter) => chapter.title);
    if (!chapterNames.includes(courseSelection.chapter)) courseSelection.chapter = chapterNames[0] || '';
    fillSelect($('course-chapter-select'), chapterNames.length ? chapterNames : ['Waiting for school syllabus'], courseSelection.chapter);
    $('course-chapter-select').disabled = !chapterNames.length;
    const chapter = book.chapters.find((item) => item.title === courseSelection.chapter);
    $('course-path-label').textContent = `${subject.name.toUpperCase()} · ${book.name.toUpperCase()}`;
    $('course-source-tag').textContent = chapter ? (subject.name === 'Mathematics' ? 'From your supplied test syllabus' : 'Original practice lesson') : 'School source needed';
    $('course-chapter-title').textContent = chapter?.title || `No ${subject.name} chapters matched yet`;
    $('course-chapter-summary').textContent = chapter?.summary || `Add the ${profile.grade || 'student class'} ${subject.name} book or syllabus for ${profile.school || 'your school'} to load its chapter list. The official reference catalogue is available below.`;
    const outline = $('course-lesson-outline'); outline.innerHTML = '';
    (chapter?.lessons || []).forEach((lesson, index) => { const row = document.createElement('div'); row.className = 'lesson-step'; const number = document.createElement('b'); number.textContent = String(index + 1).padStart(2, '0'); const text = document.createElement('span'); text.textContent = lesson; row.append(number, text); outline.append(row); });
    const chapterList = $('course-chapter-list'); chapterList.innerHTML = '';
    chapterNames.forEach((title) => { const item = document.createElement('button'); item.type = 'button'; item.className = `chapter-list-item${title === courseSelection.chapter ? ' active' : ''}`; item.textContent = title; item.addEventListener('click', () => { courseSelection.chapter = title; renderCourseware(); }); chapterList.append(item); });
    const worksheet = $('course-worksheet-preview'); worksheet.classList.add('hidden'); worksheet.innerHTML = '';
    $('course-video-link').href = chapter?.videoUrl || (chapter ? `https://www.youtube.com/results?search_query=${encodeURIComponent(chapter.videoQuery || chapter.title)}` : 'https://diksha.gov.in/');
    $('course-book-link').href = chapter?.bookUrl || book?.officialUrl || officialBooksUrl;
    const diksha = $('course-diksha-link');
    if (diksha) diksha.href = chapter?.dikshaUrl || 'https://diksha.gov.in/explore';
    $('course-worksheet-button').disabled = !chapter;
    const hasChapterQuestions = Array.isArray(chapter?.questions) && chapter.questions.length > 0;
    $('course-chapter-test-button').disabled = !chapter || (subject.name !== 'Mathematics' && !hasChapterQuestions);
    $('course-worksheet-button').textContent = chapter ? `Open ${subject.name} worksheet` : 'Worksheet not available yet';
    $('course-chapter-test-button').innerHTML = chapter && (subject.name === 'Mathematics' || hasChapterQuestions) ? 'Start chapter practice <span>→</span>' : 'Chapter test not available yet';
  }

  function resumeTest() {
    const draft = readStored(activeDraftKey, null);
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
      const input = document.createElement('input'); input.className = 'answer-input'; input.type = q.numeric || /^-?\d+(\.\d+)?$/.test(q.answer) ? 'number' : 'text'; input.inputMode = input.type === 'number' ? 'numeric' : 'text'; input.placeholder = 'Type your answer'; input.setAttribute('aria-label', 'Your answer'); input.value = answers[current] ?? '';
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
    try { localStorage.setItem(activeRecordsKey, JSON.stringify(savedRecords)); localStorage.removeItem(activeDraftKey); savedDraft = null; }
    catch { $('save-note').textContent = 'Your score could not be saved in this browser.'; }
    if (signedInUser) { const localRecordId = record.id; addDoc(collection(db, 'students', signedInUser.uid, 'testRecords'), { studentName: record.studentName, completedAt: new Date(record.completedAt), score: record.score, total: record.total, questions: record.questions, answers: record.answers })
      .then((saved) => { record.id = saved.id; savedRecords = savedRecords.map((item) => item.id === localRecordId ? record : item); localStorage.setItem(activeRecordsKey, JSON.stringify(savedRecords)); renderSavedTests(); $('save-note').textContent = 'Your test record is saved to your account.'; })
      .catch(() => { $('save-note').textContent = 'This test is saved on this device. Cloud history will sync after database setup.'; });
    }
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
  $('student-name').addEventListener('input', () => { localStorage.setItem(activeNameKey, $('student-name').value); if (currentSessionId) saveDraft(); renderSavedTests(); });
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
  $('profile-photo').addEventListener('change', () => {
    const file = $('profile-photo').files[0];
    if (!file) return;
    if (file.size > 500000) { $('auth-note').textContent = 'Please choose a picture smaller than 500 KB.'; $('profile-photo').value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { $('photo-preview-image').src = reader.result; $('photo-preview').classList.remove('hidden'); };
    reader.readAsDataURL(file);
  });
  $('remove-photo-button').addEventListener('click', () => { $('profile-photo').value = ''; $('photo-preview').classList.add('hidden'); if (studentProfile) studentProfile.photo = ''; });
  $('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!signedInUser) { $('auth-note').textContent = 'Please sign in with Google before creating a profile.'; return; }
    const form = event.currentTarget;
    studentProfile = { uid: signedInUser?.uid || studentProfile?.uid || null, email: signedInUser?.email || studentProfile?.email || '', name: form.elements.name.value.trim(), age: form.elements.age.value, grade: form.elements.grade.value.trim(), school: form.elements.school.value.trim(), curriculum: form.elements.curriculum.value, medium: form.elements.medium.value, photo: $('photo-preview').classList.contains('hidden') ? (signedInUser?.photoURL || '') : $('photo-preview-image').src };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(studentProfile)); localStorage.setItem(activeNameKey, studentProfile.name); $('student-name').value = studentProfile.name; }
    catch { $('auth-note').textContent = 'Your profile picture may be too large to save. Choose a smaller image and try again.'; return; }
    $('setup-title').textContent = 'Your student profile';
    if (signedInUser) saveProfileToCloud(studentProfile).then(() => { $('auth-note').textContent = 'Your profile is saved to your account.'; }).catch(() => { $('auth-note').textContent = 'Your profile is saved in this browser. Cloud sync could not finish; try again shortly.'; });
    loadSchoolCourseware();
    showScreen('welcome');
  });
  $('auth-mode-signin').addEventListener('click', () => setAuthMode('signin'));
  $('auth-mode-signup').addEventListener('click', () => setAuthMode('signup'));
  function setAuthMode(mode) {
    authMode = mode;
    $('auth-mode-signin').classList.toggle('active', mode === 'signin');
    $('auth-mode-signup').classList.toggle('active', mode === 'signup');
    $('email-auth-submit').textContent = mode === 'signup' ? 'Create account with email link' : 'Send me a sign-in link';
    $('auth-page-title').textContent = mode === 'signup' ? 'Create your learning account' : 'Welcome back';
    $('auth-page-copy').textContent = mode === 'signup' ? 'We’ll email you a secure one-time link to verify your address and sign in.' : 'Sign in to continue your learning and saved progress.';
  }
  $('auth-email-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('auth-email').value.trim();
    const button = $('email-auth-submit'); button.disabled = true;
    $('email-auth-note').textContent = 'Sending your secure sign-in link…';
    try {
      await authPersistenceReady;
      await sendSignInLinkToEmail(auth, email, { url: 'https://vinayraj9211.github.io/maths-weekly-test/', handleCodeInApp: true });
      localStorage.setItem('littleSteps.emailForSignIn', email);
      $('email-auth-note').textContent = `A one-time sign-in link was sent to ${email}. Open it on this device to continue.`;
      $('complete-email-row').classList.remove('hidden');
      $('complete-email').value = email;
    } catch (error) {
      $('email-auth-note').textContent = error.code === 'auth/operation-not-allowed' ? 'Email link sign-in is not enabled in Firebase Authentication yet.' : error.code === 'auth/unauthorized-continue-uri' || error.code === 'auth/unauthorized-domain' ? 'This website domain needs to be authorized in Firebase Authentication.' : 'We could not send the sign-in link. Check the email address and try again.';
    } finally { button.disabled = false; }
  });
  async function completeEmailLinkSignIn() {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const email = $('complete-email').value.trim() || localStorage.getItem('littleSteps.emailForSignIn') || '';
    if (!email) { $('complete-email-row').classList.remove('hidden'); $('email-auth-note').textContent = 'Enter the same email address that received this link to finish signing in.'; $('complete-email').focus(); return; }
    $('email-auth-note').textContent = 'Verifying your email…';
    try {
      await authPersistenceReady;
      await signInWithEmailLink(auth, email, window.location.href);
      localStorage.removeItem('littleSteps.emailForSignIn');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      $('email-auth-note').textContent = 'This sign-in link is invalid or expired. Request a new one and open it on this device.';
    }
  }
  $('complete-email-button').addEventListener('click', completeEmailLinkSignIn);
  $('google-signin-button').addEventListener('click', async () => {
    $('google-signin-button').disabled = true;
    $('email-auth-note').textContent = 'Opening secure Google sign-in…';
    try {
      await authPersistenceReady;
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) await signInWithRedirect(auth, googleProvider);
      else await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const messages = {
        'auth/unauthorized-domain': 'This site domain still needs to be added to Firebase Authentication’s authorized domains.',
        'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
        'auth/popup-closed-by-user': 'Sign-in was closed before it finished. You can try again whenever you are ready.'
      };
      $('email-auth-note').textContent = messages[error.code] || 'Google sign-in could not finish. Please try again.';
      $('google-signin-button').disabled = false;
    }
  });
  onAuthStateChanged(auth, async (user) => {
    await authPersistenceReady;
    const previousUser = signedInUser;
    signedInUser = user;
    if (!user) {
      if (previousUser || studentProfile?.uid) {
        studentProfile = null;
        activeRecordsKey = RECORDS_KEY;
        activeDraftKey = DRAFT_KEY;
        activeNameKey = NAME_KEY;
        savedRecords = readStored(RECORDS_KEY, []);
        savedDraft = readStored(DRAFT_KEY, null);
        $('student-name').value = localStorage.getItem(NAME_KEY) || '';
        updateProgress();
        showScreen('auth');
      }
      else showScreen('auth');
      return;
    }
    $('auth-page').classList.add('hidden');
    activeRecordsKey = `${RECORDS_KEY}.${user.uid}`;
    activeDraftKey = `${DRAFT_KEY}.${user.uid}`;
    activeNameKey = `${NAME_KEY}.${user.uid}`;
    savedRecords = readStored(activeRecordsKey, []);
    savedDraft = readStored(activeDraftKey, null);
    $('student-name').value = localStorage.getItem(activeNameKey) || '';
    renderSavedTests();
    studentProfile = readStored(PROFILE_KEY, null);
    if (studentProfile && studentProfile.uid && studentProfile.uid !== user.uid) studentProfile = null;
    try {
      const profileSnapshot = await getDoc(doc(db, 'students', user.uid));
      if (profileSnapshot.exists()) {
        studentProfile = { ...profileSnapshot.data(), photo: profileSnapshot.data().photo || user.photoURL || '' };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(studentProfile));
        localStorage.setItem(activeNameKey, studentProfile.name);
        $('student-name').value = studentProfile.name;
      } else if (studentProfile) await saveProfileToCloud({ ...studentProfile, uid: user.uid, email: user.email || '' });
    } catch (error) { console.info('Cloud profile is unavailable until Firestore is enabled and secured.', error.code || error.message); }
    $('profile-form').elements.name.value = studentProfile?.name || user.displayName || '';
    $('header-name').textContent = studentProfile?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Your profile';
    $('header-avatar').textContent = studentProfile?.photo || user.photoURL ? '' : (user.displayName || user.email || 'S').slice(0, 1).toUpperCase();
    $('header-avatar').style.backgroundImage = studentProfile?.photo ? `url("${studentProfile.photo}")` : user.photoURL ? `url("${user.photoURL}")` : '';
    $('auth-note').textContent = `Signed in as ${user.email}. Your profile and saved test history are connected to your account.`;
    $('save-note').textContent = 'Your saved test history syncs to your account across devices.';
    loadCloudRecords();
    loadSchoolCourseware();
    if (studentProfile) { updateProgress(); showScreen('welcome'); }
    else openProfileSetup();
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
  $('course-subject-select').addEventListener('change', () => { courseSelection.subject = $('course-subject-select').value; courseSelection.book = ''; courseSelection.chapter = ''; renderCourseware(); });
  $('course-book-select').addEventListener('change', () => { courseSelection.book = $('course-book-select').value; courseSelection.chapter = ''; renderCourseware(); });
  $('course-chapter-select').addEventListener('change', () => { courseSelection.chapter = $('course-chapter-select').value; renderCourseware(); });
  $('course-edit-profile').addEventListener('click', openProfileSetup);
  $('course-library-refresh').addEventListener('click', loadSchoolCourseware);
  $('course-map-save-button').addEventListener('click', async () => {
    if ((signedInUser?.email || '').toLowerCase() !== COURSE_ADMIN_EMAIL) return;
    const status = $('course-map-admin-status');
    try {
      const map = JSON.parse($('course-map-json').value);
      if (!map || typeof map !== 'object' || !Array.isArray(map.subjects) || !map.school || !map.grade || !map.curriculum || !map.medium) throw new Error('Include school, grade, curriculum, medium, and a subjects list.');
      if (JSON.stringify(map).length > 450000) throw new Error('This course map is too large. Keep it under 450 KB.');
      const profile = { school: map.school, grade: map.grade, curriculum: map.curriculum, medium: map.medium };
      await setDoc(doc(db, 'schoolCurricula', schoolCurriculumKey(profile)), { school: map.school, grade: map.grade, curriculum: map.curriculum, medium: map.medium, sourceName: String(map.sourceName || 'Teacher-approved course map').slice(0, 100), subjects: map.subjects, updatedAt: serverTimestamp() });
      status.textContent = 'Course map saved. Matching students can now open its subjects and chapters.';
      await loadSchoolCourseware();
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'That file is not valid JSON. Check its brackets and commas, then try again.' : error.message || 'The course map could not be saved.';
    }
  });
  $('course-chapter-test-button').addEventListener('click', () => {
    const subject = courseSubjects.find((item) => item.name === courseSelection.subject);
    const book = subject?.books.find((item) => item.name === courseSelection.book);
    const chapter = book?.chapters.find((item) => item.title === courseSelection.chapter);
    startTest(courseSelection.chapter, chapter?.questions || null);
  });
  $('course-worksheet-button').addEventListener('click', () => {
    const subject = courseSubjects.find((item) => item.name === courseSelection.subject);
    const book = subject?.books.find((item) => item.name === courseSelection.book);
    const chapter = book?.chapters.find((item) => item.title === courseSelection.chapter);
    if (!chapter) return;
    const preview = $('course-worksheet-preview'); preview.innerHTML = '';
    const title = document.createElement('h3'); title.textContent = `${chapter.title} · Practice sheet`;
    const list = document.createElement('ol'); chapter.worksheet.forEach((prompt) => { const item = document.createElement('li'); item.textContent = prompt; list.append(item); });
    preview.append(title, list); preview.classList.remove('hidden');
    $('course-library-note').textContent = 'Worksheet opened below the lesson.';
  });
  $('sign-out-button').addEventListener('click', async () => { try { await signOut(auth); $('profile-setup').classList.add('hidden'); } catch { $('auth-note').textContent = 'Sign-out could not finish. Please try again.'; } });
  renderSpeakingPrompt();
  setAuthMode('signin');
  if (isSignInWithEmailLink(auth, window.location.href)) {
    $('complete-email-row').classList.remove('hidden');
    $('complete-email').value = localStorage.getItem('littleSteps.emailForSignIn') || '';
    if ($('complete-email').value) completeEmailLinkSignIn();
    else $('email-auth-note').textContent = 'Enter the same email address that received this link to finish signing in.';
  }
  window.addEventListener('pagehide', saveDraft);
  updateWelcome();
  showScreen('auth');
})();

