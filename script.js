/**
 * ScholarAI — Main Application Script
 * Handles all UI logic, navigation, and feature implementations
 */

// ══════════════════════════════════════════════════════════
// GLOBALS & INIT
// ══════════════════════════════════════════════════════════
let currentPage = 'home';
let previousPage = 'home';
let calMonth, calYear;
let currentNoteFilter = 'all';
let currentTaskFilter = 'all';
let fileDB = null;
let obSubjects = [];
let deferredPrompt = null;
let studyGroupPollTimer = null;
let studyGroupPollInFlight = false;
let studyGroupLastActivityAt = Date.now();
let lastStudyGroupSyncError = '';
const STUDY_GROUP_API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '' : 'https://scholarai-api.onrender.com';
const STUDY_GROUP_POLL_FAST = 1500;
const STUDY_GROUP_POLL_SLOW = 5000;
const STUDY_GROUP_POLL_IDLE = 15000;
const STUDY_GROUP_POLL_SLOW_AFTER = 30000;
const STUDY_GROUP_POLL_IDLE_AFTER = 120000;
const THEME_STORAGE_KEY = 'scholarai-theme';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STUDY_TIPS = [
  'Use the Pomodoro technique: 25 min study, 5 min break.',
  'Teach what you learn to someone else — it reinforces memory.',
  'Review notes within 24 hours to boost retention by 60%.',
  'Stay hydrated — your brain is 75% water.',
  'Use active recall instead of re-reading notes.',
  'Sleep 7-8 hours before exams — memory consolidates during sleep.',
  'Break complex topics into smaller chunks.',
  'Create mind maps to visualize connections between concepts.',
  'Study in different locations to improve recall.',
  'Write summaries in your own words after each study session.',
  'Use spaced repetition for long-term memorization.',
  'Take short walks between study sessions to refresh your mind.',
  'Avoid multitasking — focus on one subject at a time.',
  'Quiz yourself regularly instead of passive reading.',
  'Color-code your notes by topic for better organization.',
  'Set specific, achievable goals for each study session.',
  'Practice past exam papers under timed conditions.',
  'Eat brain-boosting foods: nuts, berries, and dark chocolate.',
  'Minimize phone distractions — use Do Not Disturb mode.',
  'Start with the hardest subject when your energy is highest.',
  'Use acronyms and mnemonics for lists and sequences.',
  'Study groups help — explaining to peers deepens understanding.',
  'Take handwritten notes — they improve comprehension.',
  'Reward yourself after completing study goals.',
  'Listen to instrumental music for better focus.',
  'Keep your study space clean and well-lit.',
  'Use flashcards for quick review sessions.',
  'Exercise regularly — it improves cognitive function.',
  'Practice deep breathing before stressful exams.',
  'Review mistakes in previous tests — they show what to focus on.'
];

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  ScholarDB.init();
  initFileDB();
  const now = new Date();
  calMonth = now.getMonth();
  calYear = now.getFullYear();

  if (!ScholarDB.isOnboarded()) {
    document.getElementById('onboarding').classList.remove('hidden');
  } else {
    renderCurrentPage();
  }
  Notifications.init();
  Notifications.updateBadge();
  setupPWA();
  setupAriaInput();
  setupKeepAlivePing();
  startStudyGroupPolling();
  renderNavProfileIcon();
  updateStudyGroupNavLabel();

  // Check for shared note
  const params = new URLSearchParams(window.location.search);
  if (params.has('note')) {
    try {
      const noteData = JSON.parse(atob(params.get('note')));
      showToast('Shared note received: ' + noteData.title, 'success');
    } catch(e) {}
  }
});

function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, persist = true) {
  const isDark = theme === 'dark';
  document.documentElement.toggleAttribute('data-theme', isDark);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', isDark ? '#1A1025' : '#2D1B4E');
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch (e) {}
  }
}

function initThemeToggle() {
  applyTheme(getCurrentTheme(), false);
}

function toggleTheme() {
  applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
}

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════
function setupKeepAlivePing() {
  const ping = () => fetch('https://scholarai-api.onrender.com/health', { method: 'GET', cache: 'no-store' }).catch(() => {});
  ping();
  setInterval(ping, 4 * 60 * 1000);
}

function navigateTo(page) {
  if (page !== currentPage) previousPage = currentPage;
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  document.body.classList.toggle('profile-active', page === 'profile');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
    const icon = n.querySelector('.material-symbols-outlined');
    if (icon) icon.style.fontVariationSettings = n.dataset.page === page ? "'FILL' 1" : "'FILL' 0";
  });

  renderCurrentPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentPage() {
  switch(currentPage) {
    case 'home': renderHome(); break;
    case 'notes': renderNotes(); break;
    case 'files': renderFiles(); break;
    case 'tasks': renderTasks(); break;
    case 'calendar': renderCalendar(); renderTimetable(); renderEvents(); break;
    case 'studygroup': renderStudyGroup(); updateStudyGroupNavLabel(); break;
    case 'aria': renderAriaChips(); break;
    case 'settings': renderSettings(); break;
    case 'profile': renderProfile(); break;
  }
  renderNavProfileIcon();
}

// ══════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">' +
    (type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info') +
    '</span><span style="flex:1">' + msg + '</span>';
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function getDeviceId() {
  const key = 'scholarai_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem(key, id);
  }
  return id;
}

function getLocalMember() {
  const settings = ScholarDB.getSettings();
  return {
    deviceId: getDeviceId(),
    name: settings.name || 'Scholar',
    avatarColor: settings.avatarColor || '#7B3FA0'
  };
}

async function studyGroupRequest(path, options = {}) {
  const response = await fetch(STUDY_GROUP_API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Study group sync failed');
  return data;
}

function normalizeSyncedGroup(group) {
  if (!group) return null;
  return {
    code: String(group.code || '').toUpperCase(),
    groupName: String(group.groupName || '').trim(),
    members: Array.isArray(group.members) ? group.members : [],
    sharedNotes: Array.isArray(group.sharedNotes) ? group.sharedNotes : [],
    sharedFiles: Array.isArray(group.sharedFiles) ? group.sharedFiles : [],
    messages: Array.isArray(group.messages) ? group.messages : [],
    lastSynced: Date.now()
  };
}

function saveSyncedGroup(group) {
  const synced = normalizeSyncedGroup(group);
  ScholarDB.setStudyGroup(synced);
  lastStudyGroupSyncError = '';
  return synced;
}

function normalizeStudyGroupMessage(message) {
  return {
    id: String(message?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    senderId: String(message?.senderId || '').trim().slice(0, 120),
    senderName: String(message?.senderName || 'Scholar').trim().slice(0, 80) || 'Scholar',
    text: String(message?.text || '').trim().slice(0, 2000),
    timestamp: Number(message?.timestamp || Date.now()),
    pending: Boolean(message?.pending),
  };
}

function messageKey(message) {
  return String(message?.id || `${message?.senderId || ''}|${message?.timestamp || 0}|${message?.text || ''}`);
}

function messageSignature(messages) {
  return (Array.isArray(messages) ? messages : []).map(message => `${messageKey(message)}:${message.pending ? 1 : 0}`).join('||');
}

function mergeStudyGroupMessages(localMessages, remoteMessages) {
  const merged = [];
  const seen = new Map();

  const pushMessage = (message) => {
    const normalized = normalizeStudyGroupMessage(message);
    const key = messageKey(normalized);
    const index = seen.get(key);
    if (index === undefined) {
      seen.set(key, merged.length);
      merged.push(normalized);
      return;
    }
    merged[index] = normalized;
  };

  (Array.isArray(remoteMessages) ? remoteMessages : []).forEach(pushMessage);
  (Array.isArray(localMessages) ? localMessages : []).forEach(message => {
    const normalized = normalizeStudyGroupMessage(message);
    const key = messageKey(normalized);
    if (normalized.pending && seen.has(key)) return;
    if (!seen.has(key)) pushMessage(normalized);
  });

  merged.sort((a, b) => (Number(a.timestamp || 0) - Number(b.timestamp || 0)) || messageKey(a).localeCompare(messageKey(b)));
  return merged;
}

function setStudyGroupActivity(timestamp = Date.now()) {
  studyGroupLastActivityAt = timestamp;
}

function getStudyGroupPollDelay() {
  const idleFor = Date.now() - studyGroupLastActivityAt;
  if (idleFor >= STUDY_GROUP_POLL_IDLE_AFTER) return STUDY_GROUP_POLL_IDLE;
  if (idleFor >= STUDY_GROUP_POLL_SLOW_AFTER) return STUDY_GROUP_POLL_SLOW;
  return STUDY_GROUP_POLL_FAST;
}

function clearStudyGroupPolling() {
  if (studyGroupPollTimer) clearTimeout(studyGroupPollTimer);
  studyGroupPollTimer = null;
}

function scheduleStudyGroupPolling(delay = getStudyGroupPollDelay()) {
  clearStudyGroupPolling();
  const group = ScholarDB.getStudyGroup();
  if (!group?.code) return;
  studyGroupPollTimer = setTimeout(() => {
    refreshStudyGroupMessages().catch(() => {});
  }, delay);
}

function isStudyGroupViewVisible() {
  return currentPage === 'studygroup';
}

function updateStudyGroupMessages(messages) {
  const current = ScholarDB.getStudyGroup();
  if (!current) return null;
  const next = {
    ...current,
    messages: mergeStudyGroupMessages(current.messages || [], messages),
    lastSynced: Date.now()
  };
  ScholarDB.setStudyGroup(next);
  return next;
}

function removeStudyGroupMessage(messageId) {
  const current = ScholarDB.getStudyGroup();
  if (!current) return null;
  const next = {
    ...current,
    messages: (current.messages || []).filter(message => message.id !== messageId),
    lastSynced: Date.now()
  };
  ScholarDB.setStudyGroup(next);
  return next;
}

function getInitials(name) {
  const parts = String(name || 'Scholar').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
}

function ensureProfileJoinedAt(settings) {
  if (settings.profileJoinedAt) return settings.profileJoinedAt;
  settings.profileJoinedAt = Date.now();
  ScholarDB.updateSettings(settings);
  return settings.profileJoinedAt;
}

function renderAvatarHtml(settings, sizeClass) {
  if (settings.avatarPhoto) {
    return '<img class="' + sizeClass + '-img" src="' + escapeHtml(settings.avatarPhoto) + '" alt="Profile photo">';
  }
  return '<span style="color:' + escapeHtml(settings.avatarColor || '#7B3FA0') + '">' + escapeHtml(getInitials(settings.name)) + '</span>';
}

function renderNavProfileIcon() {
  const btn = document.getElementById('nav-profile-btn');
  if (!btn) return;
  const settings = ScholarDB.getSettings();
  btn.innerHTML = renderAvatarHtml(settings, 'nav-profile');
}

function openProfilePage() {
  previousPage = currentPage === 'profile' ? previousPage : currentPage;
  navigateTo('profile');
}

function goBackFromProfile() {
  navigateTo(previousPage && previousPage !== 'profile' ? previousPage : 'home');
}

function renderProfile() {
  const settings = ScholarDB.getSettings();
  const subjects = ScholarDB.getAll('subjects');
  ensureProfileJoinedAt(settings);

  const avatar = document.getElementById('profile-large-avatar');
  if (avatar) avatar.innerHTML = renderAvatarHtml(settings, 'profile-large-avatar');

  const editMode = document.getElementById('profile-edit-btn')?.dataset.editing === 'true';
  const display = document.getElementById('profile-display-area');
  if (display) {
    display.innerHTML = editMode
      ? '<div class="profile-edit-fields"><input id="profile-name-input" class="input profile-inline-input" value="' + escapeHtml(settings.name || '') + '" placeholder="Your name"><select id="profile-class-input" class="select profile-inline-input"><option>Class 9</option><option>Class 10</option><option>Class 11</option><option>Class 12</option><option>Undergraduate</option></select></div>'
      : '<h1 class="profile-name">' + escapeHtml(settings.name || 'Scholar') + '</h1><div class="profile-class-badge">' + escapeHtml(settings.class || 'Class 11') + '</div>';
    if (editMode && settings.class) document.getElementById('profile-class-input').value = settings.class;
  }

  const editBtn = document.getElementById('profile-edit-btn');
  if (editBtn) editBtn.textContent = editMode ? 'Save Profile' : 'Edit Profile';

  const list = document.getElementById('profile-subjects-list');
  if (list) {
    list.innerHTML = subjects.length ? subjects.map(sub =>
      '<div class="profile-subject-card" style="border-left-color:' + escapeHtml(sub.color || '#7B3FA0') + '">' +
      '<strong>' + escapeHtml(sub.name || 'Subject') + '</strong>' +
      (sub.teacher ? '<span>' + escapeHtml(sub.teacher) + '</span>' : '') +
      '</div>'
    ).join('') : '<div class="empty-state" style="padding:24px 12px"><p>No subjects added yet.</p></div>';
  }

  const joined = document.getElementById('profile-join-date');
  if (joined) joined.textContent = 'Member since ' + new Date(settings.profileJoinedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function toggleProfileEdit() {
  const btn = document.getElementById('profile-edit-btn');
  if (!btn) return;
  const isEditing = btn.dataset.editing === 'true';
  if (isEditing) {
    const name = document.getElementById('profile-name-input')?.value.trim();
    const cls = document.getElementById('profile-class-input')?.value;
    const settings = ScholarDB.getSettings();
    if (name) settings.name = name;
    if (cls) settings.class = cls;
    ScholarDB.updateSettings(settings);
    btn.dataset.editing = 'false';
    showToast('Profile updated', 'success');
  } else {
    btn.dataset.editing = 'true';
  }
  renderProfile();
  renderNavProfileIcon();
}

function openProfilePhotoSheet() {
  document.getElementById('profile-photo-sheet')?.classList.add('active');
}

function closeProfilePhotoSheet() {
  document.getElementById('profile-photo-sheet')?.classList.remove('active');
  document.getElementById('avatar-choice-panel')?.classList.add('hidden');
}

function handleProfilePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const settings = ScholarDB.getSettings();
    settings.avatarPhoto = e.target.result;
    ScholarDB.updateSettings(settings);
    renderProfile();
    renderNavProfileIcon();
    closeProfilePhotoSheet();
    showToast('Photo updated', 'success');
  };
  reader.readAsDataURL(file);
}

function showAvatarChoices() {
  const panel = document.getElementById('avatar-choice-panel');
  if (!panel) return;
  const colors = ['#7B3FA0', '#C4853A', '#4A7C59', '#C0392B', '#D4838A', '#5B7BA0'];
  panel.innerHTML = colors.map(color => '<button class="avatar-choice" style="background:' + color + '" onclick="chooseProfileAvatar(\'' + color + '\')" aria-label="Choose avatar color"></button>').join('');
  panel.classList.remove('hidden');
}

function chooseProfileAvatar(color) {
  const settings = ScholarDB.getSettings();
  settings.avatarColor = color;
  settings.avatarPhoto = '';
  ScholarDB.updateSettings(settings);
  renderProfile();
  renderNavProfileIcon();
  closeProfilePhotoSheet();
  showToast('Avatar updated', 'success');
}

// ══════════════════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════════════════
function showConfirm(title, msg, onConfirm) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-btn').onclick = () => { onConfirm(); closeConfirm(); };
  document.getElementById('confirm-overlay').classList.add('active');
}
function closeConfirm() { document.getElementById('confirm-overlay').classList.remove('active'); }

// ══════════════════════════════════════════════════════════
// HOME DASHBOARD
// ══════════════════════════════════════════════════════════
function renderHome() {
  const settings = ScholarDB.getSettings();
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('greeting').textContent = greet + ', ' + (settings.name || 'Scholar');
  document.getElementById('date-display').textContent = DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();

  // Stats
  const today = DAYS[now.getDay()];
  const classes = ScholarDB.getAll('timetable').filter(c => c.day === today);
  const todayStr = now.toISOString().split('T')[0];
  const dueTodayCount = ScholarDB.getAll('assignments').filter(a => a.dueDate === todayStr && a.status !== 'done').length;
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  const upcomingEvents = ScholarDB.getAll('events').filter(e => {
    const d = new Date(e.date);
    return d >= now && d <= weekFromNow;
  }).length;

  document.getElementById('today-stats').innerHTML =
    '<div class="card card-sand stat-card"><span class="stat-num" style="color:var(--color-accent)">' + classes.length + '</span><span class="stat-label">Classes Today</span></div>' +
    '<div class="card card-sand stat-card"><span class="stat-num" style="color:var(--color-gold)">' + dueTodayCount + '</span><span class="stat-label">Due Today</span></div>' +
    '<div class="card card-sand stat-card"><span class="stat-num" style="color:var(--color-accent)">' + upcomingEvents + '</span><span class="stat-label">Events This Week</span></div>';

  // Next Class
  renderNextClass(now, today, classes);

  // Urgent Assignments
  const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
  assignments.sort((a, b) => {
    const pa = {urgent:0,high:1,medium:2,low:3};
    const da = new Date(a.dueDate) - new Date();
    const db = new Date(b.dueDate) - new Date();
    return da - db + (pa[a.priority]||2) - (pa[b.priority]||2);
  });
  const urgent = assignments.slice(0, 3);
  document.getElementById('urgent-assignments').innerHTML = urgent.length ? urgent.map(a => {
    const sub = ScholarDB.getSubjectById(a.subjectId);
    const due = getDueText(a.dueDate);
    return '<div class="card" style="border-left:4px solid ' + (sub ? sub.color : 'var(--color-accent)') + ';display:flex;align-items:center;justify-content:space-between">' +
      '<div class="flex-row gap-sm"><div style="width:40px;height:40px;border-radius:10px;background:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="color:' + (sub?sub.color:'var(--color-accent)') + '">assignment</span></div>' +
      '<div><strong style="font-size:14px">' + a.title + '</strong><p class="text-xs text-muted">' + due.text + '</p></div></div>' +
      '<span class="pill priority-' + a.priority + '" style="font-size:9px">' + a.priority + '</span></div>';
  }).join('') : '<div class="empty-state"><span class="material-symbols-outlined">task_alt</span><p>All caught up!</p></div>';

  // Quick Actions
  document.getElementById('quick-actions').innerHTML =
    [{icon:'edit_note',label:'Add Note',action:"openNoteModal()"},{icon:'add_task',label:'New Task',action:"openTaskModal()"},{icon:'upload_file',label:'Upload File',action:"navigateTo('files')"},{icon:'auto_awesome',label:'Ask ARIA',action:"navigateTo('aria')"}]
    .map(q => '<button class="card card-sand" style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;border:none" onclick="' + q.action + '">' +
      '<div style="width:40px;height:40px;border-radius:50%;background:rgba(123,63,160,0.1);display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined" style="color:var(--color-accent)">' + q.icon + '</span></div>' +
      '<span style="font-size:12px;font-weight:600">' + q.label + '</span></button>').join('');

  // Study Tip
  document.getElementById('study-tip').textContent = STUDY_TIPS[now.getDate() % STUDY_TIPS.length];
}

function renderNextClass(now, today, classes) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let nextClass = null;
  let isTomorrow = false;

  classes.forEach(c => {
    const [h, m] = c.startTime.split(':').map(Number);
    const mins = h * 60 + m;
    if (mins > currentMinutes && (!nextClass || mins < nextClass._mins)) {
      nextClass = { ...c, _mins: mins };
    }
  });

  if (!nextClass) {
    const tomorrowIdx = (DAYS.indexOf(today) + 1) % 7;
    const tomorrow = DAYS[tomorrowIdx];
    const tClasses = ScholarDB.getAll('timetable').filter(c => c.day === tomorrow);
    tClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (tClasses.length) { nextClass = tClasses[0]; isTomorrow = true; }
  }

  if (!nextClass) {
    document.getElementById('next-class-card').innerHTML = '<div class="card card-dark" style="text-align:center;padding:24px"><span class="material-symbols-outlined" style="font-size:36px;opacity:.5;color:var(--color-gold)">weekend</span><p class="heading" style="margin-top:8px;font-size:16px">No upcoming classes</p><p class="text-xs" style="opacity:.6;margin-top:4px">Enjoy your free time!</p></div>';
    return;
  }

  const sub = ScholarDB.getSubjectById(nextClass.subjectId);
  const label = isTomorrow ? "Tomorrow's First Class" : 'Next Class';
  const badge = isTomorrow ? 'Tomorrow' : 'Starting Soon';

  document.getElementById('next-class-card').innerHTML =
    '<div class="card card-dark" style="position:relative;overflow:hidden;padding:20px">' +
    '<div style="position:absolute;right:-20px;top:-20px;width:80px;height:80px;background:var(--color-gold);opacity:0.08;border-radius:50%;filter:blur(20px)"></div>' +
    '<div style="position:relative;z-index:1">' +
    '<div class="flex-row gap-sm mb-sm"><span class="text-xs" style="text-transform:uppercase;letter-spacing:.08em;opacity:.7">' + label + '</span>' +
    '<span class="pill" style="background:var(--color-gold);color:var(--color-dark);font-size:9px">' + badge + '</span></div>' +
    '<h3 class="heading" style="font-size:22px;margin-bottom:12px">' + (sub ? sub.name : 'Class') + '</h3>' +
    '<div class="flex-row flex-wrap gap-md" style="opacity:.8">' +
    '<span class="flex-row gap-sm text-sm"><span class="material-symbols-outlined" style="font-size:16px">person</span>' + (sub ? sub.teacher : '') + '</span>' +
    '<span class="flex-row gap-sm text-sm"><span class="material-symbols-outlined" style="font-size:16px">location_on</span>' + nextClass.room + '</span>' +
    '<span class="flex-row gap-sm text-sm"><span class="material-symbols-outlined" style="font-size:16px">schedule</span>' + nextClass.startTime + '</span></div>' +
    (!isTomorrow ? '<p id="next-class-countdown" class="text-xs mt-sm" style="opacity:.6"></p>' : '') +
    '</div></div>';

  if (!isTomorrow) startCountdown(nextClass);
}

let countdownInterval;
function startCountdown(cls) {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const now = new Date();
    const [h, m] = cls.startTime.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const diff = target - now;
    if (diff <= 0) { clearInterval(countdownInterval); return; }
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const el = document.getElementById('next-class-countdown');
    if (el) el.textContent = 'Starts in ' + mins + 'm ' + secs + 's';
  }, 1000);
}

function getDueText(dateStr) {
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dateStr); due.setHours(0,0,0,0);
  const diff = Math.ceil((due - now) / 86400000);
  if (diff < 0) return { text: Math.abs(diff) + ' days overdue', class: 'text-danger' };
  if (diff === 0) return { text: 'Due Today', class: 'text-danger' };
  if (diff === 1) return { text: 'Due Tomorrow', class: 'text-gold' };
  return { text: 'In ' + diff + ' days', class: 'text-accent' };
}

// ══════════════════════════════════════════════════════════
// EMPTY STATES
// ══════════════════════════════════════════════════════════
const EMPTY_SVGS = {
  notes: '<svg width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#E8D9C4" opacity="0.5"/><path d="M 25 30 h 20 a 5 5 0 0 1 5 5 v 40 a 5 5 0 0 0 -5 -5 h -20 a 5 5 0 0 1 -5 -5 v -30 a 5 5 0 0 1 5 -5 z" fill="#C4853A"/><path d="M 75 30 h -20 a 5 5 0 0 0 -5 5 v 40 a 5 5 0 0 1 5 -5 h 20 a 5 5 0 0 0 5 -5 v -30 a 5 5 0 0 0 -5 -5 z" fill="#D4838A"/></svg>',
  tasks: '<svg width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#E8D9C4" opacity="0.5"/><rect x="30" y="25" width="40" height="50" rx="6" fill="#C4853A"/><rect x="35" y="35" width="20" height="4" rx="2" fill="#FAF3E8"/><rect x="35" y="45" width="25" height="4" rx="2" fill="#FAF3E8"/><rect x="35" y="55" width="15" height="4" rx="2" fill="#FAF3E8"/><circle cx="70" cy="70" r="15" fill="#4A7C59"/><path d="M 64 70 l 4 4 l 8 -8" stroke="#FAF3E8" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  files: '<svg width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#E8D9C4" opacity="0.5"/><path d="M 20 35 v 40 a 5 5 0 0 0 5 5 h 50 a 5 5 0 0 0 5 -5 v -30 a 5 5 0 0 0 -5 -5 h -30 l -5 -10 h -15 a 5 5 0 0 0 -5 5 z" fill="#C4853A"/><path d="M 25 45 h 55 a 5 5 0 0 1 5 5 v 25 a 5 5 0 0 1 -5 5 h -50 a 5 5 0 0 1 -5 -5 z" fill="#D4838A" opacity="0.9"/></svg>',
  calendar: '<svg width="120" height="120" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#E8D9C4" opacity="0.5"/><rect x="25" y="30" width="50" height="45" rx="6" fill="#FAF3E8" stroke="#C4853A" stroke-width="4"/><path d="M 25 45 h 50" stroke="#C4853A" stroke-width="4"/><rect x="35" y="25" width="4" height="10" rx="2" fill="#D4838A"/><rect x="61" y="25" width="4" height="10" rx="2" fill="#D4838A"/><circle cx="40" cy="55" r="3" fill="#C4853A"/><circle cx="50" cy="55" r="3" fill="#C4853A"/><circle cx="60" cy="55" r="3" fill="#C4853A"/><circle cx="40" cy="65" r="3" fill="#C4853A"/><circle cx="50" cy="65" r="3" fill="#D4838A"/></svg>'
};

function renderEmptyState(type, title, subtitle, btnText, btnAction) {
  return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center">' +
    '<div style="margin-bottom:24px">' + (EMPTY_SVGS[type] || '') + '</div>' +
    '<h2 class="heading" style="font-size:24px;color:var(--color-heading);margin-bottom:8px">' + title + '</h2>' +
    '<p class="text-muted" style="font-size:15px;line-height:1.5;max-width:280px;margin:0 auto 24px">' + subtitle + '</p>' +
    '<button class="btn btn-primary" onclick="' + btnAction + '"><span class="material-symbols-outlined" style="font-size:18px;margin-right:6px">add</span>' + btnText + '</button>' +
  '</div>';
}

// ══════════════════════════════════════════════════════════
// NOTES
// ══════════════════════════════════════════════════════════
function renderNotes() {
  const subjects = ScholarDB.getAll('subjects');
  const tabs = document.getElementById('notes-tabs');
  tabs.innerHTML = '<button class="tab-btn ' + (currentNoteFilter==='all'?'active':'') + '" onclick="filterNotes(\'all\')">All</button>' +
    subjects.map(s => '<button class="tab-btn ' + (currentNoteFilter===s.id?'active':'') + '" onclick="filterNotes(\'' + s.id + '\')" style="' + (currentNoteFilter===s.id ? 'background:'+s.color+';border-color:'+s.color : '') + '">' + s.name + '</button>').join('');

  let notes = ScholarDB.getAll('notes');
  if (currentNoteFilter !== 'all') notes = notes.filter(n => n.subjectId === currentNoteFilter);
  const search = document.getElementById('notes-search').value.toLowerCase();
  if (search) notes = notes.filter(n => n.title.toLowerCase().includes(search) || n.content.toLowerCase().includes(search));
  notes.sort((a, b) => b.dateModified - a.dateModified);

  document.getElementById('notes-list').innerHTML = notes.length ? notes.map(n => {
    const sub = ScholarDB.getSubjectById(n.subjectId);
    const date = new Date(n.dateModified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return '<div class="card" style="border-left:4px solid ' + (sub?sub.color:'var(--color-accent)') + ';cursor:pointer" onclick="viewNote(\'' + n.id + '\')">' +
      '<div class="flex-between"><h3 class="heading" style="font-size:16px">' + n.title + '</h3><span class="text-xs text-muted">' + date + '</span></div>' +
      '<p class="text-sm text-muted line-clamp-2 mt-sm">' + n.content.substring(0, 150) + '...</p>' +
      '<div class="flex-between mt-sm">' +
      (sub ? '<span class="pill pill-plum" style="background:' + sub.color + '20;color:' + sub.color + '">' + sub.name + '</span>' : '<span></span>') +
      '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation();shareNoteToGroup(\'' + n.id + '\')"><span class="material-symbols-outlined" style="font-size:14px">group</span> Share to Group</button>' +
      '</div>' +
      '</div>';
  }).join('') : renderEmptyState('notes', 'Your notes await...', 'Capture your ideas, organize your subjects, and let ARIA summarize them for you.', 'Add Note', 'openNoteModal()');
}

function filterNotes(filter) { currentNoteFilter = filter; renderNotes(); }

document.getElementById('notes-search')?.addEventListener('input', () => renderNotes());

function viewNote(id) {
  const note = ScholarDB.getById('notes', id);
  if (!note) return;
  const sub = ScholarDB.getSubjectById(note.subjectId);
  document.getElementById('note-view-title').textContent = note.title;

  let html = '<div style="margin-bottom:12px">';
  if (sub) html += '<span class="pill" style="background:' + sub.color + '20;color:' + sub.color + '">' + sub.name + '</span> ';
  html += '<span class="text-xs text-muted">' + new Date(note.dateModified).toLocaleDateString() + '</span></div>';
  html += '<div style="white-space:pre-wrap;line-height:1.7;font-size:14px">' + note.content + '</div>';

  // AI Summary sections
  if (note.aiSummary) {
    html += '<div class="mt-md"><div class="collapsible-header" onclick="this.nextElementSibling.classList.toggle(\'open\')"><span class="flex-row gap-sm"><span class="material-symbols-outlined text-gold" style="font-size:18px">auto_awesome</span><strong>AI Summary</strong></span><span class="material-symbols-outlined">expand_more</span></div><div class="collapsible-content open" style="border-left:3px solid var(--color-gold);padding-left:14px;margin-top:8px">' + ARIA.parseMarkdown(note.aiSummary) + '</div></div>';
  }
  if (note.keyPoints && note.keyPoints.length) {
    html += '<div class="mt-sm"><strong class="text-sm">Key Concepts</strong><div class="flex-row flex-wrap gap-sm mt-sm">' + note.keyPoints.map(k => '<span class="pill pill-plum">' + k + '</span>').join('') + '</div></div>';
  }
  if (note.examQuestions && note.examQuestions.length) {
    html += '<div class="mt-md"><div class="collapsible-header" onclick="this.nextElementSibling.classList.toggle(\'open\')"><span class="flex-row gap-sm"><span class="material-symbols-outlined text-accent">quiz</span><strong>Exam Questions</strong></span><span class="material-symbols-outlined">expand_more</span></div><div class="collapsible-content" style="border-left:3px solid var(--color-accent);padding-left:14px;margin-top:8px"><ol style="padding-left:16px">' + note.examQuestions.map(q => '<li style="margin:6px 0">' + q + '</li>').join('') + '</ol></div></div>';
  }
  if (note.flashcards && note.flashcards.length) {
    html += '<div class="mt-md"><strong class="text-sm">Flashcards</strong><div class="grid-2 mt-sm">' + note.flashcards.map(f => '<div class="flashcard-container" onclick="this.classList.toggle(\'flipped\')"><div class="flashcard-inner"><div class="flashcard-front">' + f.term + '</div><div class="flashcard-back">' + f.definition + '</div></div></div>').join('') + '</div></div>';
  }

  // Action buttons
  html += '<div class="flex-row flex-wrap gap-sm mt-lg">';
  html += '<button class="btn btn-sm btn-primary" onclick="summarizeNote(\'' + id + '\')"><span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span> AI Summarize</button>';
  html += '<button class="btn btn-sm btn-outline" onclick="shareNote(\'' + id + '\')"><span class="material-symbols-outlined" style="font-size:14px">share</span> Share</button>';
  html += '<button class="btn btn-sm btn-outline" onclick="shareNoteToGroup(\'' + id + '\')"><span class="material-symbols-outlined" style="font-size:14px">group</span> Share to Group</button>';
  html += '<button class="btn btn-sm btn-secondary" onclick="closeNoteView();editNote(\'' + id + '\')"><span class="material-symbols-outlined" style="font-size:14px">edit</span> Edit</button>';
  html += '<button class="btn btn-sm btn-danger" onclick="deleteNote(\'' + id + '\')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button>';
  html += '</div>';

  document.getElementById('note-view-content').innerHTML = html;
  document.getElementById('note-view-overlay').classList.add('active');
}

function closeNoteView() { document.getElementById('note-view-overlay').classList.remove('active'); }

function openNoteModal(editId) {
  document.getElementById('note-edit-id').value = editId || '';
  document.getElementById('note-modal-title').textContent = editId ? 'Edit Note' : 'New Note';
  const subjects = ScholarDB.getAll('subjects');
  document.getElementById('note-subject-pills').innerHTML = subjects.map(s =>
    '<button type="button" class="pill" style="cursor:pointer;background:' + s.color + '20;color:' + s.color + '" data-id="' + s.id + '" onclick="selectNotePill(this)">' + s.name + '</button>'
  ).join('');
  if (editId) {
    const note = ScholarDB.getById('notes', editId);
    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').value = note.content;
    const pill = document.querySelector('#note-subject-pills [data-id="' + note.subjectId + '"]');
    if (pill) selectNotePill(pill);
  } else {
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
  }
  updateCharCount();
  document.getElementById('note-modal-overlay').classList.add('active');
}

function closeNoteModal() { document.getElementById('note-modal-overlay').classList.remove('active'); }

function editNote(id) { openNoteModal(id); }

let selectedNoteSubject = '';
function selectNotePill(el) {
  document.querySelectorAll('#note-subject-pills .pill').forEach(p => p.style.outline = 'none');
  el.style.outline = '2px solid var(--color-dark)';
  selectedNoteSubject = el.dataset.id;
}

function updateCharCount() {
  const c = document.getElementById('note-content').value.length;
  document.getElementById('note-char-count').textContent = c + ' characters';
}
document.getElementById('note-content')?.addEventListener('input', updateCharCount);

function saveNote() {
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value.trim();
  if (!title || !content) { showToast('Please fill title and content', 'error'); return; }
  const editId = document.getElementById('note-edit-id').value;
  if (editId) {
    ScholarDB.update('notes', editId, { title, content, subjectId: selectedNoteSubject, dateModified: Date.now() });
    showToast('Note updated!', 'success');
  } else {
    ScholarDB.add('notes', { subjectId: selectedNoteSubject, title, content, aiSummary: null, keyPoints: null, examQuestions: null, flashcards: null, dateCreated: Date.now(), dateModified: Date.now(), shared: false, shareId: null });
    showToast('Note saved!', 'success');
  }
  closeNoteModal();
  renderNotes();
}

function deleteNote(id) {
  showConfirm('Delete Note', 'Are you sure you want to delete this note?', () => {
    ScholarDB.remove('notes', id);
    closeNoteView();
    renderNotes();
    showToast('Note deleted', 'success');
  });
}

async function summarizeNote(id) {
  const note = ScholarDB.getById('notes', id);
  showToast('AI is analyzing your note...', 'info');
  try {
    const result = await ARIA.summarizeNote(note.content);
    const parsed = parseAISummary(result);
    ScholarDB.update('notes', id, { aiSummary: parsed.summary, keyPoints: parsed.keyPoints, examQuestions: parsed.examQuestions, flashcards: parsed.flashcards });
    viewNote(id);
    showToast('AI analysis complete!', 'success');
  } catch(e) { showToast('AI Error: ' + e.message, 'error'); }
}

function parseAISummary(text) {
  const result = { summary: '', keyPoints: [], examQuestions: [], flashcards: [] };
  const sections = text.split(/(?=SUMMARY:|KEY CONCEPTS:|EXAM QUESTIONS:|FLASHCARDS:)/i);
  sections.forEach(s => {
    if (/^SUMMARY:/i.test(s)) result.summary = s.replace(/^SUMMARY:\s*/i, '').trim();
    else if (/^KEY CONCEPTS:/i.test(s)) result.keyPoints = s.replace(/^KEY CONCEPTS:\s*/i, '').trim().split(/\n/).map(l => l.replace(/^[-•*\d.]\s*/, '').trim()).filter(Boolean);
    else if (/^EXAM QUESTIONS:/i.test(s)) result.examQuestions = s.replace(/^EXAM QUESTIONS:\s*/i, '').trim().split(/\n/).map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
    else if (/^FLASHCARDS:/i.test(s)) {
      s.replace(/^FLASHCARDS:\s*/i, '').trim().split(/\n/).forEach(l => {
        const parts = l.split('|||');
        if (parts.length === 2) result.flashcards.push({ term: parts[0].replace(/^[-•*\d.)\s]+/, '').trim(), definition: parts[1].trim() });
      });
    }
  });
  return result;
}

async function enhanceNoteContent() {
  const content = document.getElementById('note-content').value;
  if (!content.trim()) { showToast('Write some notes first', 'error'); return; }
  showToast('Enhancing your notes...', 'info');
  try {
    const result = await ARIA.enhanceNote(content);
    document.getElementById('note-content').value = result;
    updateCharCount();
    showToast('Notes enhanced!', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function shareNote(id) {
  const note = ScholarDB.getById('notes', id);
  const data = btoa(JSON.stringify({ title: note.title, content: note.content, subject: note.subjectId }));
  const url = window.location.origin + window.location.pathname + '?note=' + data;
  navigator.clipboard.writeText(url).then(() => showToast('Share link copied!', 'success')).catch(() => showToast('Could not copy link', 'error'));
}

async function shareNoteToGroup(id) {
  const group = ScholarDB.getStudyGroup();
  if (!group?.code) { showToast('Join a study group first', 'error'); return; }
  const note = ScholarDB.getById('notes', id);
  if (!note) return;
  const sub = ScholarDB.getSubjectById(note.subjectId);
  const member = getLocalMember();
  showToast('Sharing note to group...', 'info');
  try {
    const synced = await studyGroupRequest('/api/group/' + encodeURIComponent(group.code) + '/share-note', {
      method: 'POST',
      body: JSON.stringify({
        id: 'note-' + id + '-' + member.deviceId,
        title: note.title,
        content: note.content,
        subject: sub ? sub.name : 'General',
        sharerName: member.name
      })
    });
    if (synced.group) saveSyncedGroup(synced.group);
    if (currentPage === 'studygroup') renderStudyGroup();
    showToast('Note shared to group', 'success');
  } catch (error) {
    lastStudyGroupSyncError = error.message;
    showToast(error.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════
// TASKS / ASSIGNMENTS
// ══════════════════════════════════════════════════════════
function renderTasks() {
  const all = ScholarDB.getAll('assignments');
  const todayStr = new Date().toISOString().split('T')[0];
  const done = all.filter(a => a.status === 'done').length;
  const overdue = all.filter(a => a.status !== 'done' && a.dueDate < todayStr).length;

  document.getElementById('task-stats').innerHTML =
    '<div class="card card-sand stat-card"><span class="stat-num" style="color:var(--color-accent)">' + all.length + '</span><span class="stat-label">Total</span></div>' +
    '<div class="card card-sand stat-card"><span class="stat-num" style="color:var(--color-success)">' + done + '</span><span class="stat-label">Done</span></div>' +
    '<div class="card card-sand stat-card"><span class="stat-num" style="color:var(--color-danger)">' + overdue + '</span><span class="stat-label">Overdue</span></div>';

  const filters = ['all','today','week','overdue','done'];
  document.getElementById('task-filters').innerHTML = filters.map(f =>
    '<button class="tab-btn ' + (currentTaskFilter===f?'active':'') + '" onclick="filterTasks(\'' + f + '\')">' + f.charAt(0).toUpperCase() + f.slice(1) + '</button>'
  ).join('');

  let tasks = [...all];
  const now = new Date(); now.setHours(0,0,0,0);
  const weekEnd = new Date(now.getTime() + 7 * 86400000);
  if (currentTaskFilter === 'today') tasks = tasks.filter(a => a.dueDate === todayStr);
  else if (currentTaskFilter === 'week') tasks = tasks.filter(a => { const d = new Date(a.dueDate); return d >= now && d <= weekEnd; });
  else if (currentTaskFilter === 'overdue') tasks = tasks.filter(a => a.status !== 'done' && a.dueDate < todayStr);
  else if (currentTaskFilter === 'done') tasks = tasks.filter(a => a.status === 'done');
  tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  document.getElementById('tasks-list').innerHTML = tasks.length ? tasks.map(a => {
    const sub = ScholarDB.getSubjectById(a.subjectId);
    const due = getDueText(a.dueDate);
    const isDone = a.status === 'done';
    const isOverdue = !isDone && new Date(a.dueDate) < now;
    return '<div class="card" style="border-left:4px solid ' + (sub?sub.color:'var(--color-accent)') + ';' + (isDone?'opacity:.6':'') + '">' +
      '<div class="flex-between"><h3 class="heading" style="font-size:15px;' + (isDone?'text-decoration:line-through':'') + '">' + a.title + '</h3><span class="pill priority-' + a.priority + '" style="font-size:9px">' + a.priority + '</span></div>' +
      (a.description ? '<p class="text-sm text-muted mt-sm line-clamp-2">' + a.description + '</p>' : '') +
      '<div class="flex-between mt-sm"><span class="text-xs ' + due.class + '">' + due.text + (isOverdue ? ' <span class="pill pill-danger" style="animation:pulse 1.5s infinite;font-size:9px;margin-left:4px">OVERDUE</span>' : '') + '</span>' +
      (a.estimatedTime ? '<span class="text-xs text-muted">⏱ ' + a.estimatedTime + '</span>' : '') + '</div>' +
      '<div class="flex-row gap-sm mt-sm">' +
      (a.status === 'todo' ? '<button class="btn btn-sm btn-outline" onclick="updateTaskStatus(\'' + a.id + '\',\'in-progress\')">Start</button>' : '') +
      (a.status === 'in-progress' ? '<button class="btn btn-sm btn-primary" onclick="updateTaskStatus(\'' + a.id + '\',\'done\')">Complete</button>' : '') +
      (isDone ? '<span class="pill pill-sage">Completed</span>' : '') +
      '<button class="btn btn-sm btn-outline" onclick="editTask(\'' + a.id + '\')"><span class="material-symbols-outlined" style="font-size:14px">edit</span></button>' +
      '<button class="btn btn-sm" style="color:var(--color-danger)" onclick="deleteTask(\'' + a.id + '\')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button>' +
      '</div></div>';
  }).join('') : renderEmptyState('tasks', 'No assignments yet...', 'Stay on top of your coursework by tracking your assignments and tasks here.', 'Add Assignment', 'openTaskModal()');
}

function filterTasks(f) { currentTaskFilter = f; renderTasks(); }

function openTaskModal(editId) {
  document.getElementById('task-edit-id').value = editId || '';
  document.getElementById('task-modal-heading').textContent = editId ? 'Edit Assignment' : 'New Assignment';
  const subjects = ScholarDB.getAll('subjects');
  document.getElementById('task-subject').innerHTML = subjects.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
  if (editId) {
    const a = ScholarDB.getById('assignments', editId);
    document.getElementById('task-title').value = a.title;
    document.getElementById('task-desc').value = a.description || '';
    document.getElementById('task-due').value = a.dueDate;
    document.getElementById('task-priority').value = a.priority;
    document.getElementById('task-time').value = a.estimatedTime || '';
    document.getElementById('task-subject').value = a.subjectId;
  } else {
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-due').value = '';
    document.getElementById('task-time').value = '';
  }
  document.getElementById('task-modal-overlay').classList.add('active');
}
function closeTaskModal() { document.getElementById('task-modal-overlay').classList.remove('active'); }
function editTask(id) { openTaskModal(id); }

function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  const due = document.getElementById('task-due').value;
  if (!title || !due) { showToast('Title and due date required', 'error'); return; }
  const data = {
    subjectId: document.getElementById('task-subject').value,
    title, description: document.getElementById('task-desc').value.trim(),
    dueDate: due, priority: document.getElementById('task-priority').value,
    estimatedTime: document.getElementById('task-time').value, status: 'todo', dateCreated: Date.now()
  };
  const editId = document.getElementById('task-edit-id').value;
  if (editId) { ScholarDB.update('assignments', editId, data); showToast('Assignment updated!', 'success'); }
  else { ScholarDB.add('assignments', data); showToast('Assignment added!', 'success'); }
  closeTaskModal(); renderTasks(); if (currentPage === 'home') renderHome();
}

function updateTaskStatus(id, status) {
  ScholarDB.update('assignments', id, { status });
  if (status === 'done') { triggerConfetti(); showToast('Assignment completed! Great work!', 'success'); }
  renderTasks();
}

function deleteTask(id) {
  showConfirm('Delete Assignment', 'Remove this assignment?', () => {
    ScholarDB.remove('assignments', id);
    renderTasks(); showToast('Deleted', 'success');
  });
}

async function aiEstimateTime() {
  const title = document.getElementById('task-title').value;
  const desc = document.getElementById('task-desc').value;
  if (!title) { showToast('Enter a title first', 'error'); return; }
  showToast('Estimating time...', 'info');
  try {
    const result = await ARIA.estimateTime(title, desc);
    document.getElementById('task-time').value = result.trim();
    showToast('Time estimated!', 'success');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function triggerConfetti() {
  const colors = ['#C4853A', '#7B3FA0', '#4A7C59', '#2D1B4E', '#FAF3E8'];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-10px';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    el.style.animationDuration = (1.5 + Math.random()) + 's';
    el.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

// ══════════════════════════════════════════════════════════
// CALENDAR & TIMETABLE
// ══════════════════════════════════════════════════════════
function showCalView(view) {
  document.getElementById('calview-calendar').classList.add('hidden');
  document.getElementById('calview-timetable').classList.add('hidden');
  document.getElementById('calview-events').classList.add('hidden');
  document.getElementById('calview-' + view).classList.remove('hidden');
  
  const btns = document.querySelectorAll('#page-calendar .tab-btn');
  btns.forEach(b => b.classList.remove('active'));
  if (view === 'calendar') btns[0].classList.add('active');
  if (view === 'timetable') btns[1].classList.add('active');
  if (view === 'events') { btns[2].classList.add('active'); renderEvents(); }
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  document.getElementById('cal-month-title').textContent = MONTHS[calMonth] + ' ' + calYear;
  
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  
  let html = '';
  ['S','M','T','W','T','F','S'].forEach(d => html += '<div class="cal-header">' + d + '</div>');
  
  const today = new Date();
  const assignments = ScholarDB.getAll('assignments');
  const events = ScholarDB.getAll('events');
  
  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    html += '<div class="cal-day other-month">' + (prevMonthDays - i) + '</div>';
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    
    let dots = '';
    const dayAsgns = assignments.filter(a => a.dueDate === dateStr && a.status !== 'done');
    const dayEvts = events.filter(e => e.date === dateStr);
    
    if (dayAsgns.length) dots += '<span class="cal-dot" style="background:var(--color-danger)"></span>';
    dayEvts.forEach(e => {
      const c = e.type === 'exam' ? 'var(--color-gold)' : e.type === 'holiday' ? '#D4838A' : 'var(--color-success)';
      dots += '<span class="cal-dot" style="background:' + c + '"></span>';
    });
    
    html += '<div class="cal-day ' + (isToday ? 'today' : '') + '" onclick="showDayEvents(\'' + dateStr + '\')">' + i + (dots ? '<div class="cal-dots mt-sm">' + dots + '</div>' : '') + '</div>';
  }
  grid.innerHTML = html;
  
  // Upcoming list
  const upcoming = [...events, ...assignments.filter(a => a.status !== 'done').map(a => ({...a, date: a.dueDate, type: 'assignment'}))]
    .filter(e => new Date(e.date) >= new Date().setHours(0,0,0,0))
    .sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 5);
    
  document.getElementById('cal-events').innerHTML = upcoming.length ? upcoming.map(e => {
    const sub = ScholarDB.getSubjectById(e.subjectId);
    const d = new Date(e.date).toLocaleDateString('en-US', {month:'short', day:'numeric'});
    const c = e.type === 'exam' ? 'var(--color-gold)' : e.type === 'assignment' ? 'var(--color-danger)' : 'var(--color-success)';
    return '<div class="card card-sand" style="display:flex;align-items:center;gap:12px;padding:12px;border-left:4px solid ' + c + '">' +
      '<div style="flex:1"><strong style="font-size:14px;display:block">' + e.title + '</strong><span class="text-xs text-muted">' + (sub?sub.name+' • ':'') + d + (e.time?' '+e.time:'') + '</span></div>' +
      '<span class="pill" style="font-size:9px;background:' + c + '20;color:' + c + '">' + e.type + '</span></div>';
  }).join('') : renderEmptyState('calendar', 'A clear schedule...', 'Keep track of exams, classes, and important academic events.', 'Add Event', 'openEventModal()');
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function showDayEvents(dateStr) {
  // Can be expanded to show a modal for the specific day's events
  showToast('Viewing events for ' + dateStr);
}

function openEventModal() {
  const subjects = ScholarDB.getAll('subjects');
  document.getElementById('event-subject').innerHTML = '<option value="">None</option>' + subjects.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
  document.getElementById('event-title').value = '';
  document.getElementById('event-desc').value = '';
  document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('event-time').value = '';
  document.getElementById('event-modal-overlay').classList.add('active');
}
function closeEventModal() { document.getElementById('event-modal-overlay').classList.remove('active'); }

function saveEvent() {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  if (!title || !date) { showToast('Title and date required', 'error'); return; }
  ScholarDB.add('events', {
    type: document.getElementById('event-type').value, title, date,
    time: document.getElementById('event-time').value,
    subjectId: document.getElementById('event-subject').value,
    description: document.getElementById('event-desc').value
  });
  closeEventModal(); renderCalendar(); if(currentPage==='home') renderHome();
  showToast('Event added!', 'success');
}

// ── Timetable ──────────────────────────────────────────────
function renderTimetable() {
  const classes = ScholarDB.getAll('timetable');
  const times = ['08:00','09:15','11:00','12:15','14:00','15:15','16:30'];
  const tDays = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = '<div class="tt-header">Time</div>';
  tDays.forEach(d => html += '<div class="tt-header">' + d + '</div>');
  
  times.forEach(time => {
    html += '<div class="tt-time">' + time + '</div>';
    tDays.forEach(d => {
      const cls = classes.find(c => c.day.startsWith(d) && c.startTime === time);
      if (cls) {
        const sub = ScholarDB.getSubjectById(cls.subjectId);
        html += '<div class="tt-cell"><div class="tt-block" style="background:' + (sub?sub.color:'var(--color-dark)') + '" onclick="deleteClass(\'' + cls.id + '\')">' + (sub?sub.name:cls.subjectId) + '<br><span style="opacity:.8;font-size:8px">' + cls.room + '</span></div></div>';
      } else {
        html += '<div class="tt-cell"></div>';
      }
    });
  });
  document.getElementById('timetable-grid').innerHTML = html;
  
  // Today Timeline
  const today = DAYS[new Date().getDay()];
  const tClasses = classes.filter(c => c.day === today).sort((a,b) => a.startTime.localeCompare(b.startTime));
  
  const now = new Date();
  const currMins = now.getHours() * 60 + now.getMinutes();
  
  document.getElementById('today-timeline').innerHTML = tClasses.length ? tClasses.map((c, i) => {
    const sub = ScholarDB.getSubjectById(c.subjectId);
    const [sh, sm] = c.startTime.split(':').map(Number);
    const [eh, em] = c.endTime.split(':').map(Number);
    const sMins = sh * 60 + sm;
    const eMins = eh * 60 + em;
    
    let dotClass = '';
    if (currMins > eMins) dotClass = 'past';
    else if (currMins >= sMins && currMins <= eMins) dotClass = 'current';
    
    return '<div class="timeline-item">' +
      '<div class="timeline-dot ' + dotClass + '" style="background:' + (dotClass?null:(sub?sub.color:'var(--color-accent)')) + '"></div>' +
      (i < tClasses.length - 1 ? '<div class="timeline-line"></div>' : '') +
      '<div style="flex:1"><strong style="font-size:14px;color:' + (sub?sub.color:'var(--color-text)') + '">' + (sub?sub.name:'Class') + '</strong>' +
      '<div class="text-xs text-muted mt-sm">' + c.startTime + ' - ' + c.endTime + ' • ' + c.room + '</div></div></div>';
  }).join('') : '<p class="text-muted text-sm text-center">No classes today</p>';
}

function openClassModal() {
  const subjects = ScholarDB.getAll('subjects');
  document.getElementById('class-subject').innerHTML = subjects.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
  document.getElementById('class-modal-overlay').classList.add('active');
}
function closeClassModal() { document.getElementById('class-modal-overlay').classList.remove('active'); }

function saveClass() {
  const startTime = document.getElementById('class-start').value;
  const endTime = document.getElementById('class-end').value;
  if (!startTime || !endTime) { showToast('Start and end time required', 'error'); return; }
  
  ScholarDB.add('timetable', {
    subjectId: document.getElementById('class-subject').value,
    day: document.getElementById('class-day').value,
    startTime, endTime, room: document.getElementById('class-room').value
  });
  closeClassModal(); renderTimetable(); if(currentPage==='home') renderHome();
  showToast('Class added!', 'success');
}

function deleteClass(id) {
  showConfirm('Delete Class', 'Remove this class from the timetable?', () => {
    ScholarDB.remove('timetable', id); renderTimetable(); showToast('Class removed', 'success');
  });
}

// ── Events Sub-tab ─────────────────────────────────────────
function renderEvents() {
  const events = ScholarDB.getAll('events');
  const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
  const all = [...events, ...assignments.map(a => ({...a, date: a.dueDate, type: 'assignment'}))];
  all.sort((a,b) => new Date(a.date) - new Date(b.date));
  const el = document.getElementById('events-list');
  if (!el) return;
  el.innerHTML = all.length ? all.map(e => {
    const sub = ScholarDB.getSubjectById(e.subjectId);
    const d = new Date(e.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
    const c = e.type === 'exam' ? 'var(--color-gold)' : e.type === 'assignment' ? 'var(--color-danger)' : e.type === 'holiday' ? '#D4838A' : 'var(--color-success)';
    return '<div class="card card-sand" style="display:flex;align-items:center;gap:12px;padding:12px;border-left:4px solid ' + c + '">' +
      '<div style="flex:1"><strong style="font-size:14px;display:block">' + escapeHtml(e.title) + '</strong><span class="text-xs text-muted">' + (sub?escapeHtml(sub.name)+' • ':'') + d + (e.time?' '+e.time:'') + '</span>' + (e.description ? '<p class="text-xs text-muted mt-sm">' + escapeHtml(e.description) + '</p>' : '') + '</div>' +
      '<span class="pill" style="font-size:9px;background:' + c + '20;color:' + c + '">' + escapeHtml(e.type) + '</span></div>';
  }).join('') : '<div class="empty-state"><span class="material-symbols-outlined">event</span><p>No events yet</p></div>';
}

// ══════════════════════════════════════════════════════════
// STUDY GROUP
// ══════════════════════════════════════════════════════════
function updateStudyGroupNavLabel() {
  const label = document.getElementById('nav-studygroup-label');
  if (!label) return;
  const group = ScholarDB.getStudyGroup();
  if (group && group.groupName) {
    label.textContent = group.groupName;
  } else if (group && group.code) {
    label.textContent = 'Group';
  } else {
    label.textContent = 'Study Group';
  }
}

function renderStudyGroup() {
  const group = ScholarDB.getStudyGroup();
  const c = document.getElementById('group-content');
  if (!c) return;
  updateStudyGroupNavLabel();
  if (!group) {
    c.innerHTML = '<h1 class="heading" style="font-size:24px;margin-bottom:16px">Study Group</h1>' +
      '<div class="empty-state"><span class="material-symbols-outlined">group_add</span><p>No study group yet</p><p class="text-xs text-muted mt-sm">Create or join a group to share notes, files, and chat in real-time.</p></div>' +
      '<div class="grid-2 mt-md"><button class="btn btn-primary" onclick="createStudyGroup()"><span class="material-symbols-outlined" style="font-size:18px">add</span> Create Group</button><button class="btn btn-outline" onclick="joinStudyGroup()"><span class="material-symbols-outlined" style="font-size:18px">login</span> Join Group</button></div>';
    return;
  }

  const sUrl = window.location.origin + window.location.pathname;
  const msg = 'Join my ScholarAI study group! Code: ' + group.code + ' Link: ' + sUrl;
  const members = group.members || [];
  const sharedNotes = group.sharedNotes || [];
  const sharedFiles = group.sharedFiles || [];
  const messages = group.messages || [];
  const syncText = group.lastSynced ? 'Synced ' + new Date(group.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sync pending';
  const syncStatus = lastStudyGroupSyncError ? '<p class="text-xs mt-sm" style="color:var(--color-danger)">Sync issue: ' + escapeHtml(lastStudyGroupSyncError) + '</p>' : '<p class="text-xs text-muted mt-sm">' + syncText + '</p>';
  
  const groupTitle = group.groupName ? escapeHtml(group.groupName) : 'Study Group';
  c.innerHTML = '<h1 class="heading" style="font-size:24px;margin-bottom:16px">' + groupTitle + '</h1>' +
    '<div class="card card-dark" style="text-align:center;padding:30px 20px"><p class="text-xs" style="color:var(--color-gold);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Group Code</p>' +
    '<div class="group-code">' + escapeHtml(group.code) + '</div>' +
    '<div class="flex-row gap-sm mt-lg" style="justify-content:center"><button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText(\'' + group.code + '\');showToast(\'Code copied!\',\'success\')"><span class="material-symbols-outlined" style="font-size:16px">content_copy</span> Copy</button>' +
    '<a href="https://wa.me/?text=' + encodeURIComponent(msg) + '" target="_blank" class="btn btn-sm btn-outline" style="border-color:#25D366;color:#25D366"><span class="material-symbols-outlined" style="font-size:16px">chat</span> WhatsApp</a></div></div>' +
    syncStatus +
    '<h3 class="section-title mt-lg mb-sm">Members</h3><div class="group-members-grid">' + (members.length ? members.map(m => '<div class="member-profile"><div class="member-avatar" style="background:' + escapeHtml(m.color || '#7B3FA0') + '" title="' + escapeHtml(m.name || 'Scholar') + '">' + escapeHtml(getInitials(m.name || 'Scholar')) + '</div><span>' + escapeHtml(m.name || 'Scholar') + '</span></div>').join('') : '<span class="text-sm text-muted">No members yet</span>') + '</div>' +
    '<h3 class="section-title mt-lg mb-sm">Group Chat</h3><div class="group-chat-panel"><div id="group-chat-messages" class="group-chat-messages">' + renderGroupMessages(messages) + '</div><div class="group-chat-input-row"><textarea id="group-chat-input" class="group-chat-input" placeholder="Type a message..." rows="2"></textarea><button class="btn btn-primary btn-pill group-chat-send" onclick="sendGroupMessage()">Send</button></div></div>' +
    '<h3 class="section-title mt-lg mb-sm">Shared Notes</h3><div class="space-y">' + renderSharedNotes(sharedNotes) + '</div>' +
    '<h3 class="section-title mt-lg mb-sm">Shared Files</h3><div class="space-y">' + renderSharedFiles(sharedFiles) + '</div>' +
    '<button class="btn btn-danger btn-sm mt-lg" style="width:100%" onclick="leaveStudyGroup()">Leave Group</button>';
  requestAnimationFrame(() => scrollGroupChatToBottom(false));
}

function renderGroupMessages(messages) {
  if (!messages.length) return '<div class="group-chat-empty">No messages yet — say hello!</div>';
  const localId = getDeviceId();
  return messages.map(message => {
    const mine = message.senderId === localId;
    const time = formatRelativeTime(message.timestamp || Date.now());
    return '<div class="group-message ' + (mine ? 'mine' : 'theirs') + '">' +
      (!mine ? '<span class="group-message-sender">' + escapeHtml(message.senderName || 'Scholar') + '</span>' : '') +
      '<div class="group-message-bubble"><p>' + escapeHtml(message.text || '') + '</p><time>' + escapeHtml(time) + (message.pending ? '<span class="group-message-pending" title="Sending"></span>' : '') + '</time></div>' +
      '</div>';
  }).join('');
}

function renderGroupChatMessages() {
  const area = document.getElementById('group-chat-messages');
  const group = ScholarDB.getStudyGroup();
  if (!area || !group) return;
  area.innerHTML = renderGroupMessages(group.messages || []);
  scrollGroupChatToBottom(true);
}

function scrollGroupChatToBottom(smooth = true) {
  const area = document.getElementById('group-chat-messages');
  if (area) area.scrollTo({ top: area.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function formatRelativeTime(timestamp) {
  const diffMs = Math.max(0, Date.now() - Number(timestamp || 0));
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes === 1 ? '1 min ago' : minutes + ' mins ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : hours + ' hours ago';
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : days + ' days ago';
}

async function sendGroupMessage() {
  const group = ScholarDB.getStudyGroup();
  const input = document.getElementById('group-chat-input');
  const text = input?.value.trim();
  if (!group?.code || !text) return;
  const member = getLocalMember();
  const message = normalizeStudyGroupMessage({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    senderId: member.deviceId,
    senderName: member.name,
    text,
    timestamp: Date.now(),
    pending: true
  });
  // Optimistic UI — show message instantly
  input.value = '';
  updateStudyGroupMessages([message]);
  renderGroupChatMessages();
  scrollGroupChatToBottom(true);
  setStudyGroupActivity();
  try {
    await studyGroupRequest('/api/group/' + encodeURIComponent(group.code) + '/message', {
      method: 'POST',
      body: JSON.stringify({
        senderId: member.deviceId,
        senderName: member.name,
        text: message.text,
        timestamp: message.timestamp
      })
    });
    // Mark as confirmed
    const current = ScholarDB.getStudyGroup();
    if (current) {
      const msgs = (current.messages || []).map(m => m.id === message.id ? { ...m, pending: false } : m);
      ScholarDB.setStudyGroup({ ...current, messages: msgs });
    }
    if (isStudyGroupViewVisible()) renderGroupChatMessages();
    setStudyGroupActivity();
  } catch (error) {
    lastStudyGroupSyncError = error.message;
    removeStudyGroupMessage(message.id);
    if (input) input.value = text;
    if (isStudyGroupViewVisible()) renderGroupChatMessages();
    showToast(error.message, 'error');
  }
}

function renderSharedNotes(notes) {
  if (!notes.length) return '<div class="empty-state" style="padding:24px 12px"><p>No shared notes yet.</p></div>';
  return notes.map(n => '<div class="card" style="border-left:4px solid var(--color-accent)">' +
    '<div class="flex-between"><h3 class="heading" style="font-size:15px">' + escapeHtml(n.title || 'Untitled note') + '</h3><span class="text-xs text-muted">' + new Date(n.sharedAt || Date.now()).toLocaleDateString() + '</span></div>' +
    '<p class="text-xs text-muted mt-sm">' + escapeHtml(n.subject || 'General') + ' • Shared by ' + escapeHtml(n.sharerName || 'Scholar') + '</p>' +
    '<p class="text-sm mt-sm" style="white-space:pre-wrap;line-height:1.6">' + escapeHtml(n.content || '') + '</p></div>').join('');
}

function renderSharedFiles(files) {
  if (!files.length) return '<div class="empty-state" style="padding:24px 12px"><p>No shared files yet.</p></div>';
  return files.map(f => '<div class="card flex-between" style="padding:12px 16px">' +
    '<div class="flex-row gap-md"><div style="width:40px;height:40px;border-radius:8px;background:var(--color-accent)20;color:var(--color-accent);display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined">folder_shared</span></div>' +
    '<div><strong style="font-size:14px;display:block;margin-bottom:2px" class="truncate">' + escapeHtml(f.name || 'Shared file') + '</strong><span class="text-xs text-muted">' + escapeHtml(f.subject || 'General') + ' • Shared by ' + escapeHtml(f.sharerName || 'Scholar') + '</span></div></div>' +
    '<button class="btn btn-sm btn-outline" onclick="downloadSharedFile(\'' + escapeHtml(f.id) + '\')"><span class="material-symbols-outlined" style="font-size:14px">download</span></button></div>').join('');
}

async function createStudyGroup() {
  const groupName = prompt('Enter a name for your study group (e.g. Warriors, Physics Squad):');
  if (!groupName || !groupName.trim()) return;
  const c = document.getElementById('group-content');
  if (c) c.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px"><div class="sg-spinner"></div><p class="text-muted mt-md">Creating group...</p></div>';
  try {
    const member = getLocalMember();
    const group = await studyGroupRequest('/api/group/create', {
      method: 'POST',
      body: JSON.stringify({ memberName: member.name, memberId: member.deviceId, memberColor: member.avatarColor, groupName: groupName.trim() })
    });
    saveSyncedGroup(group);
    startStudyGroupPolling();
    renderStudyGroup();
    updateStudyGroupNavLabel();
    showToast('Group "' + group.groupName + '" created!', 'success');
  } catch (error) {
    lastStudyGroupSyncError = error.message;
    renderStudyGroup();
    showToast(error.message, 'error');
  }
}

async function joinStudyGroup() {
  const code = prompt('Enter 6-character group code:');
  if (code && code.trim().length === 6) {
    const c = document.getElementById('group-content');
    if (c) c.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px"><div class="sg-spinner"></div><p class="text-muted mt-md">Joining group...</p></div>';
    try {
      const member = getLocalMember();
      const group = await studyGroupRequest('/api/group/join', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim().toUpperCase(), memberName: member.name, memberId: member.deviceId, memberColor: member.avatarColor })
      });
      saveSyncedGroup(group);
      startStudyGroupPolling();
      renderStudyGroup();
      updateStudyGroupNavLabel();
      showToast('Joined group!', 'success');
    } catch (error) {
      lastStudyGroupSyncError = error.message;
      renderStudyGroup();
      showToast(error.message, 'error');
    }
  } else if (code) showToast('Invalid code — must be 6 characters', 'error');
}

function leaveStudyGroup() {
  showConfirm('Leave Group', 'Are you sure you want to leave this study group?', () => { ScholarDB.setStudyGroup(null); clearStudyGroupPolling(); renderStudyGroup(); updateStudyGroupNavLabel(); showToast('Left group', 'success'); });
}

async function refreshStudyGroup(silent = true) {
  const group = ScholarDB.getStudyGroup();
  if (!group?.code) return;
  try {
    const synced = await studyGroupRequest('/api/group/' + encodeURIComponent(group.code));
    saveSyncedGroup(synced);
    if (isStudyGroupViewVisible()) renderStudyGroup();
  } catch (error) {
    lastStudyGroupSyncError = error.message;
    if (!silent) showToast(error.message, 'error');
    if (isStudyGroupViewVisible()) renderStudyGroup();
  }
}

function startStudyGroupPolling() {
  clearStudyGroupPolling();
  const group = ScholarDB.getStudyGroup();
  if (!group?.code) return;
  setStudyGroupActivity();
  refreshStudyGroupMessages().catch(() => {});
}

async function refreshStudyGroupMessages(silent = true) {
  const group = ScholarDB.getStudyGroup();
  if (!group?.code) return;
  if (studyGroupPollInFlight) {
    scheduleStudyGroupPolling();
    return;
  }
  studyGroupPollInFlight = true;
  try {
    const synced = await studyGroupRequest('/api/group/' + encodeURIComponent(group.code));
    const remoteMessages = Array.isArray(synced.messages) ? synced.messages : [];
    const latestGroup = ScholarDB.getStudyGroup();
    const beforeSignature = messageSignature(latestGroup?.messages || []);
    const mergedMessages = mergeStudyGroupMessages(latestGroup?.messages || [], remoteMessages);
    const afterSignature = messageSignature(mergedMessages);
    if (afterSignature !== beforeSignature) {
      const next = updateStudyGroupMessages(mergedMessages);
      if (next && isStudyGroupViewVisible()) renderGroupChatMessages();
      setStudyGroupActivity();
    }
    // Also sync members, notes, files
    if (synced.members || synced.sharedNotes || synced.sharedFiles) {
      const current = ScholarDB.getStudyGroup();
      if (current) {
        const updated = { ...current, members: synced.members || current.members, sharedNotes: synced.sharedNotes || current.sharedNotes, sharedFiles: synced.sharedFiles || current.sharedFiles, groupName: synced.groupName || current.groupName, lastSynced: Date.now() };
        ScholarDB.setStudyGroup(updated);
      }
    }
    lastStudyGroupSyncError = '';
  } catch (error) {
    lastStudyGroupSyncError = error.message;
    if (!silent) showToast(error.message, 'error');
  } finally {
    studyGroupPollInFlight = false;
    scheduleStudyGroupPolling();
  }
}

function downloadSharedFile(id) {
  const group = ScholarDB.getStudyGroup();
  const file = (group?.sharedFiles || []).find(f => f.id === id);
  if (!file) return;
  const a = document.createElement('a');
  a.href = 'data:' + (file.type || 'application/octet-stream') + ';base64,' + file.base64;
  a.download = file.name || 'shared-file';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ══════════════════════════════════════════════════════════
// ARIA CHAT
// ══════════════════════════════════════════════════════════
function setupAriaInput() {
  const input = document.getElementById('aria-input');
  if (!input) return;
  input.addEventListener('input', autoResizeAriaInput);
  input.addEventListener('keydown', (e) => {
    const isDesktop = window.matchMedia('(min-width: 768px) and (pointer: fine)').matches;
    if (isDesktop && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAriaMessage();
    }
  });
  autoResizeAriaInput();
}

function autoResizeAriaInput() {
  const input = document.getElementById('aria-input');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
}

function renderAriaChips() {
  const chips = [
    { label: 'Study Plan', type: 'study-plan' },
    { label: 'Summarize Notes', type: 'summarize' },
    { label: 'Quiz Me', type: 'quiz' },
    { label: 'What\'s Due', type: 'whats-due' },
    { label: 'Explain Topic', type: 'explain' }
  ];
  document.getElementById('aria-chips').innerHTML = chips.map(c => '<button class="chat-chip" onclick="triggerAriaAction(\'' + c.type + '\')">' + c.label + '</button>').join('');
}

function triggerAriaAction(type) {
  const prompt = ARIA.getQuickPrompt(type);
  if (prompt) {
    document.getElementById('aria-input').value = prompt;
    autoResizeAriaInput();
    sendAriaMessage();
  }
}

async function sendAriaMessage() {
  const input = document.getElementById('aria-input');
  const msg = input.value.trim();
  if (!msg) return;

  appendChatMessage(msg, 'user');
  input.value = '';
  autoResizeAriaInput();
  document.getElementById('aria-chips').style.display = 'none';

  const typingId = appendTypingIndicator();
  const area = document.getElementById('chat-area');
  area.scrollTop = area.scrollHeight;

  try {
    const response = await ARIA.chat(msg);
    document.getElementById(typingId).remove();
    appendChatMessage(ARIA.parseMarkdown(response), 'aria', response);
  } catch (e) {
    document.getElementById(typingId).remove();
    appendChatMessage('<span style="color:var(--color-danger)">Error: ' + e.message + '</span>', 'aria', 'Error: ' + e.message);
  }
}

function appendChatMessage(html, type, rawText) {
  const area = document.getElementById('chat-area');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + type;
  if (type === 'user') {
    const s = ScholarDB.getSettings();
    div.innerHTML = '<div class="chat-avatar user-avatar" style="background:' + (s.avatarColor || 'var(--color-gold)') + '">' + (s.name ? s.name.charAt(0) : 'U') + '</div><div class="chat-bubble user">' + html + '</div>';
  } else {
    const copyId = 'copy-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    div.innerHTML = '<div class="chat-avatar aria-avatar"><span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:\'FILL\' 1">auto_awesome</span></div><div class="chat-content"><div class="chat-bubble aria">' + html + '</div><button id="' + copyId + '" class="chat-copy-btn" onclick="copyAriaMessage(this)"><span class="material-symbols-outlined">content_copy</span><span>Copy</span></button></div>';
    div.dataset.copyText = rawText || div.textContent || '';
  }
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function copyAriaMessage(btn) {
  const msg = btn.closest('.chat-msg');
  const text = msg?.dataset.copyText || msg?.querySelector('.chat-bubble')?.innerText || '';
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '<span class="material-symbols-outlined">check</span><span>Copied</span>';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = old;
    }, 2000);
  }).catch(() => showToast('Could not copy response', 'error'));
}

function appendTypingIndicator() {
  const id = 'typing-' + Date.now();
  const area = document.getElementById('chat-area');
  const div = document.createElement('div');
  div.id = id;
  div.className = 'chat-msg aria';
  div.innerHTML = '<div class="chat-avatar aria-avatar"><span class="material-symbols-outlined" style="font-size:18px">auto_awesome</span></div><div class="chat-bubble aria" style="padding:10px 16px"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  area.appendChild(div);
  return id;
}

// ══════════════════════════════════════════════════════════
// FILES (INDEXEDDB)
// ══════════════════════════════════════════════════════════
function initFileDB() {
  const req = indexedDB.open('ScholarVaultDB', 1);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('files')) {
      const store = db.createObjectStore('files', { keyPath: 'id' });
      store.createIndex('subjectId', 'subjectId', { unique: false });
    }
  };
  req.onsuccess = e => { fileDB = e.target.result; renderFiles(); };
  req.onerror = e => console.error('IndexedDB error', e);
}

function renderFiles() {
  if (!fileDB) return;
  const subjects = ScholarDB.getAll('subjects');
  let totalSize = 0;
  
  const tx = fileDB.transaction('files', 'readonly');
  const store = tx.objectStore('files');
  const req = store.getAll();
  
  req.onsuccess = () => {
    const files = req.result;
    const search = document.getElementById('files-search')?.value.toLowerCase();
    
    files.forEach(f => totalSize += f.size);
    updateStorageDisplay(totalSize);
    
    if (search) {
      document.getElementById('files-folder-view').classList.add('hidden');
      const lv = document.getElementById('files-list-view');
      lv.classList.remove('hidden');
      
      const filtered = files.filter(f => f.name.toLowerCase().includes(search));
      lv.innerHTML = filtered.length ? filtered.map(f => renderFileItem(f)).join('') : '<div class="empty-state"><p>No files match search</p></div>';
    } else {
      document.getElementById('files-list-view').classList.add('hidden');
      const fv = document.getElementById('files-folder-view');
      fv.classList.remove('hidden');
      
      fv.innerHTML = subjects.map(s => {
        const count = files.filter(f => f.subjectId === s.id).length;
        return '<div class="card" style="text-align:center;cursor:pointer;border-top:4px solid ' + s.color + '" onclick="viewFolder(\'' + s.id + '\')">' +
          '<span class="material-symbols-outlined" style="font-size:36px;color:' + s.color + ';margin-bottom:8px">folder</span>' +
          '<h3 class="heading" style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.name + '</h3>' +
          '<p class="text-xs text-muted mt-sm">' + count + ' files</p></div>';
      }).join('');
      fv.innerHTML += '<div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:rgba(123,63,160,0.05);border:2px dashed var(--color-border)" onclick="openFileModal()"><span class="material-symbols-outlined text-muted" style="font-size:32px">add</span><p class="text-xs text-muted mt-sm font-semibold uppercase tracking-wider">Upload File</p></div>';
    }
  };
}

function viewFolder(subId) {
  const sub = ScholarDB.getSubjectById(subId);
  const tx = fileDB.transaction('files', 'readonly');
  const files = [];
  tx.objectStore('files').index('subjectId').openCursor(subId).onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) { files.push(cursor.value); cursor.continue(); }
    else {
      document.getElementById('files-folder-view').classList.add('hidden');
      const lv = document.getElementById('files-list-view');
      lv.classList.remove('hidden');
      lv.innerHTML = '<div class="flex-between mb-md"><div class="flex-row gap-sm"><button class="icon-btn" onclick="renderFiles()"><span class="material-symbols-outlined">arrow_back</span></button><h2 class="heading" style="font-size:18px">' + sub.name + '</h2></div><button class="btn btn-sm btn-primary" onclick="openFileModal(\'' + subId + '\')">Upload</button></div>' +
        (files.length ? files.map(f => renderFileItem(f)).join('') : renderEmptyState('files', 'Folder is empty', 'Upload lecture slides, reading materials, or reference documents here.', 'Upload File', 'openFileModal(\'' + subId + '\')'));
    }
  };
}

function renderFileItem(f) {
  let icon = 'insert_drive_file'; let c = 'var(--color-muted)';
  if (f.type.includes('pdf')) { icon = 'picture_as_pdf'; c = 'var(--color-danger)'; }
  else if (f.type.includes('image')) { icon = 'image'; c = 'var(--color-gold)'; }
  else if (f.type.includes('word') || f.type.includes('document')) { icon = 'description'; c = 'var(--color-accent)'; }
  const sizeStr = (f.size / 1024 / 1024).toFixed(2) + ' MB';
  const dateStr = new Date(f.dateUploaded).toLocaleDateString();
  
  return '<div class="card flex-between" style="padding:12px 16px"><div class="flex-row gap-md">' +
    '<div style="width:40px;height:40px;border-radius:8px;background:' + c + '20;color:' + c + ';display:flex;align-items:center;justify-content:center"><span class="material-symbols-outlined">' + icon + '</span></div>' +
    '<div><strong style="font-size:14px;display:block;margin-bottom:2px" class="truncate">' + f.name + '</strong><span class="text-xs text-muted">' + sizeStr + ' • ' + dateStr + '</span></div></div>' +
    '<div class="flex-row gap-sm"><button class="btn btn-sm btn-outline" onclick="shareFileToGroup(\'' + f.id + '\')"><span class="material-symbols-outlined" style="font-size:14px">group</span> Share to Group</button><button class="btn btn-sm btn-outline" onclick="downloadFile(\'' + f.id + '\')"><span class="material-symbols-outlined" style="font-size:14px">download</span></button><button class="btn btn-sm" style="color:var(--color-danger)" onclick="deleteFile(\'' + f.id + '\')"><span class="material-symbols-outlined" style="font-size:14px">delete</span></button></div></div>';
}

function updateStorageDisplay(sizeBytes) {
  const maxSize = 50 * 1024 * 1024; // 50MB quota for demo
  const perc = Math.min((sizeBytes / maxSize) * 100, 100);
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
  const elText = document.getElementById('storage-text');
  const elFill = document.getElementById('storage-fill');
  if (elText) elText.textContent = sizeMB + ' MB / 50 MB Used';
  if (elFill) elFill.style.width = perc + '%';
  if (perc > 90 && elFill) elFill.style.background = 'var(--color-danger)';
}

document.getElementById('files-search')?.addEventListener('input', renderFiles);
document.getElementById('file-input')?.addEventListener('change', uploadFile);

function openFileModal(subId) {
  const subjects = ScholarDB.getAll('subjects');
  document.getElementById('file-subject').innerHTML = subjects.map(s => '<option value="' + s.id + '" ' + (s.id===subId?'selected':'') + '>' + s.name + '</option>').join('');
  document.getElementById('file-input').value = '';
  document.getElementById('upload-progress-bar').classList.add('hidden');
  document.getElementById('upload-progress').style.width = '0%';
  document.getElementById('file-modal-overlay').classList.add('active');
}
function closeFileModal() { document.getElementById('file-modal-overlay').classList.remove('active'); }

function chooseUploadType(accept) {
  const fileInput = document.getElementById('file-input');
  fileInput.accept = accept;
  fileInput.value = '';
  fileInput.click();
}

function uploadFile() {
  const fileInput = document.getElementById('file-input');
  if (!fileInput.files.length) { showToast('Select a file first', 'error'); return; }
  const file = fileInput.files[0];
  if (file.size > 10 * 1024 * 1024) { showToast('File exceeds 10MB limit', 'error'); return; }
  
  document.getElementById('upload-progress-bar').classList.remove('hidden');
  document.getElementById('upload-progress').style.width = '50%';
  
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('upload-progress').style.width = '100%';
    const data = { id: ScholarDB.uid(), subjectId: document.getElementById('file-subject').value, name: file.name, type: file.type, size: file.size, data: e.target.result, dateUploaded: Date.now() };
    const tx = fileDB.transaction('files', 'readwrite');
    tx.objectStore('files').add(data);
    tx.oncomplete = () => { showToast('File uploaded', 'success'); closeFileModal(); renderFiles(); };
    tx.onerror = () => { showToast('Upload failed', 'error'); document.getElementById('upload-progress-bar').classList.add('hidden'); };
  };
  reader.readAsDataURL(file);
}

function downloadFile(id) {
  const tx = fileDB.transaction('files', 'readonly');
  tx.objectStore('files').get(id).onsuccess = e => {
    const f = e.target.result;
    if (!f) return;
    const a = document.createElement('a');
    a.href = f.data;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
}

async function shareFileToGroup(id) {
  const group = ScholarDB.getStudyGroup();
  if (!group?.code) { showToast('Join a study group first', 'error'); return; }
  const tx = fileDB.transaction('files', 'readonly');
  tx.objectStore('files').get(id).onsuccess = async e => {
    const f = e.target.result;
    if (!f) return;
    const sub = ScholarDB.getSubjectById(f.subjectId);
    const member = getLocalMember();
    const base64 = String(f.data || '').includes(',') ? String(f.data).split(',')[1] : String(f.data || '');
    showToast('Sharing file to group...', 'info');
    try {
      const synced = await studyGroupRequest('/api/study-groups/' + encodeURIComponent(group.code) + '/shared-files', {
        method: 'POST',
        body: JSON.stringify({
          id: 'file-' + id + '-' + member.deviceId,
          name: f.name,
          type: f.type,
          subject: sub ? sub.name : 'General',
          base64,
          size: f.size,
          sharerName: member.name
        })
      });
      saveSyncedGroup(synced);
      if (currentPage === 'calendar') renderStudyGroup();
      showToast('File shared to group', 'success');
    } catch (error) {
      lastStudyGroupSyncError = error.message;
      showToast(error.message, 'error');
    }
  };
}

function deleteFile(id) {
  showConfirm('Delete File', 'Remove this file from your vault?', () => {
    const tx = fileDB.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = () => { showToast('File deleted', 'success'); renderFiles(); };
  });
}

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════
function renderSettings() {
  const s = ScholarDB.getSettings();
  if (s.ariaPersonality) document.getElementById('set-personality').value = s.ariaPersonality;
  
  const colors = ['#7B3FA0', '#C4853A', '#4A7C59', '#C0392B', '#D4838A', '#5B7BA0'];
  document.getElementById('set-subject-color').innerHTML = colors.map(c => 
    '<div class="color-swatch ' + (c === '#7B3FA0' ? 'selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></div>'
  ).join('');
  
  setupColorPicker('set-subject-color');
  
  const subs = ScholarDB.getAll('subjects');
  document.getElementById('set-subjects-list').innerHTML = subs.map(sub => 
    '<div class="card flex-between" style="padding:10px 14px;border-left:4px solid ' + sub.color + '"><span>' + sub.name + '</span><button class="btn btn-sm" style="color:var(--color-danger)" onclick="deleteSubject(\'' + sub.id + '\')"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></div>'
  ).join('');
  
  if (s.notifications) {
    document.getElementById('tog-class').className = 'toggle ' + (s.notifications.classReminders ? 'on' : '');
    document.getElementById('tog-assign').className = 'toggle ' + (s.notifications.assignmentReminders ? 'on' : '');
    document.getElementById('tog-weekly').className = 'toggle ' + (s.notifications.weeklyDigest ? 'on' : '');
  }
  
  // Storage
  let totalBytes = 0;
  for (let key in localStorage) { if (localStorage.hasOwnProperty(key)) { totalBytes += ((localStorage[key].length + key.length) * 2); } }
  document.getElementById('storage-display').textContent = 'Local Storage Used: ' + (totalBytes / 1024).toFixed(2) + ' KB';
  const sharePreview = document.getElementById('share-message-preview');
  if (sharePreview) sharePreview.textContent = getScholarAIShareMessage();
  
  // Add listeners for auto-save
  document.getElementById('set-personality').onchange = (e) => updateSettings('ariaPersonality', e.target.value);
}

function updateSettings(key, val) {
  const s = ScholarDB.getSettings();
  s[key] = val;
  ScholarDB.updateSettings(s);
  renderNavProfileIcon();
  if (key !== 'ariaPersonality') showToast('Settings updated', 'success');
}

function getScholarAIAppUrl() {
  return window.location.origin + window.location.pathname;
}

function getScholarAIShareMessage() {
  return "Hey! I've been using ScholarAI — a free AI-powered student productivity app. It has smart notes with AI summaries, assignment tracker, timetable, file vault, and an AI study companion called ARIA. Try it free here: " + getScholarAIAppUrl() + " ";
}

function shareScholarAIWhatsApp() {
  window.open('https://wa.me/?text=' + encodeURIComponent(getScholarAIShareMessage()), '_blank', 'noopener');
}

function copyScholarAILink() {
  navigator.clipboard.writeText(getScholarAIAppUrl()).then(() => showToast('Link copied', 'success')).catch(() => showToast('Could not copy link', 'error'));
}

function shareScholarAIMore() {
  if (!navigator.share) {
    showToast('Native sharing is not available here', 'error');
    return;
  }
  navigator.share({ text: getScholarAIShareMessage(), url: getScholarAIAppUrl(), title: 'ScholarAI' }).catch(() => {});
}

function toggleSetting(el, key) {
  el.classList.toggle('on');
  const s = ScholarDB.getSettings();
  if (!s.notifications) s.notifications = {};
  s.notifications[key] = el.classList.contains('on');
  ScholarDB.updateSettings(s);
}

async function testGroqConnection() {
  showToast('Testing connection...', 'info');
  try {
    const res = await ARIA.testConnection();
    showToast('Success! ' + res, 'success');
  } catch (e) { showToast('Connection failed: ' + e.message, 'error'); }
}

function addSubjectFromSettings() {
  const name = document.getElementById('set-new-subject').value.trim();
  if (!name) return;
  const swatches = document.getElementById('set-subject-color').querySelectorAll('.color-swatch');
  let color = '#7B3FA0';
  swatches.forEach(s => { if (s.classList.contains('selected')) color = s.dataset.color; });
  ScholarDB.add('subjects', { name, color, teacher: '', room: '' });
  document.getElementById('set-new-subject').value = '';
  renderSettings(); showToast('Subject added', 'success');
}

function deleteSubject(id) {
  showConfirm('Delete Subject', 'Are you sure? This will not delete related notes or assignments.', () => {
    ScholarDB.remove('subjects', id); renderSettings(); showToast('Subject deleted', 'success');
  });
}

function clearAllData() {
  showConfirm('WARNING', 'This will delete ALL your notes, assignments, schedule, and settings. This cannot be undone. Proceed?', () => {
    ScholarDB.clearAll(); window.location.reload();
  });
}

function exportData() {
  const data = ScholarDB.exportAll();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'scholarai-backup-' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      ScholarDB.importAll(data);
      showToast('Data imported successfully!', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { showToast('Invalid backup file', 'error'); }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════
function setupColorPicker(id) {
  const swatches = document.getElementById(id).querySelectorAll('.color-swatch');
  swatches.forEach(s => s.addEventListener('click', () => {
    swatches.forEach(sw => sw.classList.remove('selected'));
    s.classList.add('selected');
  }));
}

function showObSlide(num) {
  document.querySelectorAll('.onboarding-slide').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-slide-' + num).classList.add('active');
  if (num === 2) setupColorPicker('ob-color-picker');
}

function renderObSubjects() {
  document.getElementById('ob-subjects-list').innerHTML = obSubjects.map((s, i) => 
    '<div class="ob-subject-item"><div class="color-dot" style="background:' + s.color + '"></div><span style="flex:1">' + s.name + '</span><span class="material-symbols-outlined" style="cursor:pointer;color:var(--color-danger)" onclick="obRemoveSubject(' + i + ')">close</span></div>'
  ).join('');
  document.getElementById('ob-next-2').disabled = obSubjects.length < 3;
}

function obAddSubject() {
  const input = document.getElementById('ob-subject-name');
  const name = input.value.trim();
  if (!name) return;
  
  let color = '#7B3FA0';
  document.getElementById('ob-color-picker').querySelectorAll('.color-swatch').forEach(s => {
    if (s.classList.contains('selected')) color = s.dataset.color;
  });
  
  obSubjects.push({ id: ScholarDB.uid(), name, color, teacher: '', room: '' });
  input.value = '';
  renderObSubjects();
}

function obRemoveSubject(idx) {
  obSubjects.splice(idx, 1);
  renderObSubjects();
}

function finishOnboarding(skip) {
  if (!skip) {
    if (!document.getElementById('ob-disclaimer').checked) { showToast('Please accept the disclaimer', 'error'); return; }
    const name = document.getElementById('ob-name').value;
    const cls = document.getElementById('ob-class').value;
    
    const settings = ScholarDB.getSettings();
    if (name) settings.name = name;
    if (cls) settings.class = cls;
    ScholarDB.updateSettings(settings);
    
    // Replace default subjects if user added custom ones
    if (obSubjects.length >= 3) {
      localStorage.setItem('scholarai_subjects', JSON.stringify(obSubjects));
    }
  }
  
  ScholarDB.setOnboarded();
  document.getElementById('onboarding').classList.add('hidden');
  renderCurrentPage();
  showToast('Welcome to ScholarAI!', 'success');
}

document.getElementById('ob-disclaimer')?.addEventListener('change', e => {
  document.getElementById('ob-finish').disabled = !e.target.checked;
});

// ══════════════════════════════════════════════════════════
// NOTIFICATION DROPDOWN
// ══════════════════════════════════════════════════════════
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('active');
  if (panel.classList.contains('active')) Notifications.renderDropdown();
}
function markAllRead() {
  ScholarDB.markAllNotificationsRead();
  Notifications.updateBadge();
  Notifications.renderDropdown();
}
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  if (panel && panel.classList.contains('active') && !e.target.closest('#notif-panel') && !e.target.closest('.icon-btn')) {
    panel.classList.remove('active');
  }
});

// ══════════════════════════════════════════════════════════
// PWA
// ══════════════════════════════════════════════════════════
function setupPWA() {
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    let waitingServiceWorker = null;

    const ensureUpdateBannerStyles = () => {
      if (document.getElementById('sw-update-banner-styles')) return;
      const style = document.createElement('style');
      style.id = 'sw-update-banner-styles';
      style.textContent = `
        :root{--sw-update-banner-height:0px}
        body.sw-update-visible{--sw-update-banner-height:58px}
        .sw-update-banner{position:fixed;top:0;left:0;right:0;z-index:500;min-height:58px;padding:10px 14px;background:#C4853A;color:#2D1B4E;font-family:var(--font-body,'Plus Jakarta Sans',sans-serif);box-shadow:0 8px 24px rgba(45,27,78,.18);transform:translateY(-100%);transition:transform .32s ease;display:flex;align-items:center;justify-content:center}
        .sw-update-banner.active{transform:translateY(0)}
        .sw-update-inner{width:100%;max-width:600px;display:flex;align-items:center;gap:12px}
        .sw-update-message{flex:1;font-size:14px;font-weight:700;line-height:1.35}
        .sw-update-refresh{flex-shrink:0;border:0;border-radius:10px;background:#fff;color:#2D1B4E;font-family:inherit;font-size:13px;font-weight:800;padding:9px 14px;cursor:pointer;box-shadow:0 2px 10px rgba(45,27,78,.12)}
        .sw-update-dismiss{flex-shrink:0;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#2D1B4E;font-family:inherit;font-size:24px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
        body.sw-update-visible .top-bar{top:var(--sw-update-banner-height)}
        body.sw-update-visible .main-content{padding-top:calc(76px + var(--sw-update-banner-height))}
        @media(max-width:430px){
          body.sw-update-visible{--sw-update-banner-height:76px}
          .sw-update-banner{min-height:76px;padding:10px 12px}
          .sw-update-inner{gap:8px}
          .sw-update-message{font-size:13px}
          .sw-update-refresh{padding:8px 12px}
          .sw-update-dismiss{width:32px;height:32px;font-size:22px}
          body.sw-update-visible .main-content{padding-top:calc(70px + var(--sw-update-banner-height))}
        }
      `;
      document.head.appendChild(style);
    };

    const showUpdateBanner = (serviceWorker) => {
      if (!serviceWorker || document.getElementById('sw-update-banner')) return;
      waitingServiceWorker = serviceWorker;
      ensureUpdateBannerStyles();

      const banner = document.createElement('div');
      banner.id = 'sw-update-banner';
      banner.className = 'sw-update-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.innerHTML = '<div class="sw-update-inner"><span class="sw-update-message">New update available! Tap to refresh</span><button class="sw-update-refresh" type="button">Refresh</button><button class="sw-update-dismiss" type="button" aria-label="Dismiss update notification">&times;</button></div>';
      document.body.prepend(banner);

      requestAnimationFrame(() => {
        document.body.classList.add('sw-update-visible');
        banner.classList.add('active');
      });

      banner.querySelector('.sw-update-refresh')?.addEventListener('click', () => {
        if (!waitingServiceWorker) return;
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      });

      banner.querySelector('.sw-update-dismiss')?.addEventListener('click', () => {
        banner.classList.remove('active');
        document.body.classList.remove('sw-update-visible');
        setTimeout(() => banner.remove(), 320);
      });
    };

    const watchRegistrationForUpdates = (registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('service-worker.js?v=4')
      .then(r => {
        console.log('SW Registered', r.scope);
        watchRegistrationForUpdates(r);
        r.update();
      })
      .catch(e => console.error('SW Error', e));
  }
  
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwa-banner').style.display = 'flex';
  });
  
  document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    document.getElementById('pwa-banner').style.display = 'none';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('User response to the install prompt: ' + outcome);
    deferredPrompt = null;
  });
}
