const STORAGE_KEY = 'studyProgressTracker.v1';
const VERSION = '1.0.0';

const defaultData = () => ({
  startDate: '2026-08-17',
  targetDays: 90,
  courseCount: 5,
  lecturesPerCourse: 15,
  courses: Array.from({ length: 7 }, (_, i) => ({ name: `과목 ${i + 1}`, completed: 0 }))
});

let state = loadState();
let deferredInstallPrompt = null;

const $ = (id) => document.getElementById(id);
const els = {
  tabs: [...document.querySelectorAll('.tab')],
  dashboardTab: $('dashboardTab'), progressTab: $('progressTab'),
  completedValue: $('completedValue'), completedSub: $('completedSub'),
  targetValue: $('targetValue'), targetSub: $('targetSub'),
  deltaValue: $('deltaValue'), deltaSub: $('deltaSub'),
  requiredPaceValue: $('requiredPaceValue'),
  overallPct: $('overallPct'), overallText: $('overallText'), remainingText: $('remainingText'), overallFill: $('overallFill'),
  statusBox: $('statusBox'), statusDesc: $('statusDesc'), paceAch: $('paceAch'), heroStatus: $('heroStatus'),
  courseTableBody: $('courseTableBody'), courseInputs: $('courseInputs'),
  startDate: $('startDate'), targetDays: $('targetDays'), courseCount: $('courseCount'), lecturesPerCourse: $('lecturesPerCourse'),
  endDate: $('endDate'), totalLectures: $('totalLectures'),
  exportBtn: $('exportBtn'), importInput: $('importInput'), resetBtn: $('resetBtn'),
  aboutBtn: $('aboutBtn'), aboutDialog: $('aboutDialog'), installBtn: $('installBtn')
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultData();
  }
}

function normalizeState(input) {
  const d = defaultData();
  const courseCount = clamp(Number(input?.courseCount ?? d.courseCount), 1, 7);
  const lecturesPerCourse = clamp(Number(input?.lecturesPerCourse ?? d.lecturesPerCourse), 1, 999);
  const targetDays = clamp(Number(input?.targetDays ?? d.targetDays), 1, 999);
  const courses = Array.from({ length: 7 }, (_, i) => ({
    name: String(input?.courses?.[i]?.name || d.courses[i].name).slice(0, 80),
    completed: clamp(Number(input?.courses?.[i]?.completed ?? 0), 0, lecturesPerCourse)
  }));
  return {
    startDate: isDateString(input?.startDate) ? input.startDate : d.startDate,
    targetDays,
    courseCount,
    lecturesPerCourse,
    courses
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isDateString(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function localDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function dateDiffDays(a, b) {
  const ms = new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor(ms / 86400000);
}

function addDays(dateString, days) {
  const d = localDate(dateString);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function metrics() {
  const total = state.courseCount * state.lecturesPerCourse;
  const today = new Date();
  const start = localDate(state.startDate);
  const elapsed = Math.max(0, Math.min(state.targetDays, dateDiffDays(today, start) + 1));
  const target = Math.min(total, (elapsed / state.targetDays) * total);
  const completed = state.courses.slice(0, state.courseCount).reduce((sum, c) => sum + c.completed, 0);
  const delta = completed - target;
  const overallRate = total ? completed / total : 0;
  const paceAchievement = target ? completed / target : 0;
  const remainingDays = Math.max(0, state.targetDays - elapsed);
  const remainingLectures = Math.max(0, total - completed);
  const requiredPace = completed >= total ? 0 : (remainingDays > 0 ? remainingLectures / remainingDays : remainingLectures);
  let status = '페이스 조정 필요';
  let statusClass = 'status-bad';
  if (completed >= total && total > 0) { status = '완강 완료'; statusClass = 'status-good'; }
  else if (delta >= 0) { status = '정상 페이스'; statusClass = 'status-good'; }
  else if (completed >= target * 0.9) { status = '조금 밀림'; statusClass = 'status-warn'; }
  return { total, elapsed, target, completed, delta, overallRate, paceAchievement, remainingDays, remainingLectures, requiredPace, status, statusClass };
}

function render() {
  const m = metrics();
  els.completedValue.textContent = m.completed;
  els.completedSub.textContent = `/ ${m.total}강`;
  els.targetValue.textContent = m.target.toFixed(1);
  els.targetSub.textContent = `현재 ${m.elapsed}일 경과`;
  els.deltaValue.textContent = `${m.delta >= 0 ? '+' : ''}${m.delta.toFixed(1)}`;
  els.deltaValue.classList.toggle('green', m.delta >= 0);
  els.deltaValue.classList.toggle('red', m.delta < 0);
  els.deltaSub.textContent = m.delta >= 0 ? '계획보다 앞섬' : '계획보다 뒤처짐';
  els.requiredPaceValue.textContent = m.requiredPace.toFixed(2);

  const pct = Math.max(0, Math.min(100, Math.round(m.overallRate * 100)));
  els.overallPct.textContent = `${pct}%`;
  els.overallText.textContent = `${m.completed}강 / ${m.total}강 수강 완료`;
  els.remainingText.textContent = `남은 강의 ${m.remainingLectures}강 · 남은 기간 ${m.remainingDays}일`;
  els.overallFill.style.width = `${pct}%`;

  els.statusBox.className = `status-box ${m.statusClass}`;
  els.statusBox.textContent = m.status;
  els.heroStatus.textContent = m.status;
  els.heroStatus.style.background = m.statusClass === 'status-good' ? 'var(--green-bg)' : m.statusClass === 'status-warn' ? 'var(--amber-bg)' : 'var(--red-bg)';
  els.heroStatus.style.color = m.statusClass === 'status-good' ? 'var(--green)' : m.statusClass === 'status-warn' ? 'var(--amber)' : 'var(--red)';
  els.statusDesc.textContent = m.delta >= 0
    ? `현재 목표보다 ${m.delta.toFixed(1)}강 앞서 있습니다.`
    : `현재 목표보다 ${Math.abs(m.delta).toFixed(1)}강 뒤처져 있습니다.`;
  els.paceAch.textContent = `현재 페이스 달성률 ${Math.round(m.paceAchievement * 100)}%`;

  renderCourseTable();
  renderCourseInputs();
  renderSettings();
}

function renderCourseTable() {
  els.courseTableBody.innerHTML = '';
  for (let i = 0; i < state.courseCount; i++) {
    const c = state.courses[i];
    const rate = state.lecturesPerCourse ? Math.round(c.completed / state.lecturesPerCourse * 100) : 0;
    const remain = Math.max(0, state.lecturesPerCourse - c.completed);
    const [status, statusClass] = c.completed >= state.lecturesPerCourse
      ? ['완료', 'status-complete']
      : c.completed === 0
        ? ['미시작', 'status-not-started']
        : ['진행중', 'status-in-progress'];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td>${c.completed} / ${state.lecturesPerCourse}강</td>
      <td>${remain}강</td>
      <td>
        <div class="course-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${rate}%"></div></div>
          <span class="course-percent">${rate}%</span>
        </div>
      </td>
      <td><span class="status-text ${statusClass}">${status}</span></td>`;
    els.courseTableBody.appendChild(tr);
  }
}

function renderCourseInputs() {
  const active = document.activeElement;
  const activeId = active?.dataset?.key;
  els.courseInputs.innerHTML = '';
  state.courses.forEach((course, i) => {
    const enabled = i < state.courseCount;
    const rate = state.lecturesPerCourse ? Math.round(course.completed / state.lecturesPerCourse * 100) : 0;
    const row = document.createElement('div');
    row.className = `course-input-row${enabled ? '' : ' inactive'}`;
    row.innerHTML = `
      <input data-key="name-${i}" data-index="${i}" data-field="name" type="text" maxlength="80" value="${escapeAttr(course.name)}" ${enabled ? '' : 'disabled'} />
      <input data-key="completed-${i}" data-index="${i}" data-field="completed" type="number" min="0" max="${state.lecturesPerCourse}" value="${course.completed}" ${enabled ? '' : 'disabled'} />
      <div class="input-pct">${rate}%</div>`;
    els.courseInputs.appendChild(row);
  });
  if (activeId) document.querySelector(`[data-key="${CSS.escape(activeId)}"]`)?.focus();
}

function renderSettings() {
  els.startDate.value = state.startDate;
  els.targetDays.value = state.targetDays;
  els.courseCount.value = state.courseCount;
  els.lecturesPerCourse.value = state.lecturesPerCourse;
  els.endDate.value = addDays(state.startDate, state.targetDays - 1);
  els.endDate.textContent = addDays(state.startDate, state.targetDays - 1);
  els.totalLectures.value = state.courseCount * state.lecturesPerCourse;
  els.totalLectures.textContent = `${state.courseCount * state.lecturesPerCourse}강`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function escapeAttr(s) { return escapeHtml(s); }

els.tabs.forEach(btn => btn.addEventListener('click', () => {
  els.tabs.forEach(b => b.classList.toggle('active', b === btn));
  els.dashboardTab.classList.toggle('active', btn.dataset.tab === 'dashboard');
  els.progressTab.classList.toggle('active', btn.dataset.tab === 'progress');
}));

els.startDate.addEventListener('change', e => { if (isDateString(e.target.value)) { state.startDate = e.target.value; commit(); } });
els.targetDays.addEventListener('input', e => { state.targetDays = clamp(Number(e.target.value), 1, 999); commit(); });
els.courseCount.addEventListener('input', e => { state.courseCount = clamp(Number(e.target.value), 1, 7); commit(); });
els.lecturesPerCourse.addEventListener('input', e => {
  state.lecturesPerCourse = clamp(Number(e.target.value), 1, 999);
  state.courses.forEach(c => c.completed = clamp(c.completed, 0, state.lecturesPerCourse));
  commit();
});

els.courseInputs.addEventListener('input', e => {
  const input = e.target.closest('input[data-index]');
  if (!input) return;
  const i = Number(input.dataset.index);
  if (input.dataset.field === 'name') state.courses[i].name = input.value.slice(0, 80);
  if (input.dataset.field === 'completed') state.courses[i].completed = clamp(Number(input.value), 0, state.lecturesPerCourse);
  saveState();
  renderCourseTable();
  renderDashboardOnly();
  const pct = Math.round(state.courses[i].completed / state.lecturesPerCourse * 100);
  input.parentElement.querySelector('.input-pct').textContent = `${pct}%`;
});

function renderDashboardOnly() {
  const m = metrics();
  els.completedValue.textContent = m.completed;
  els.completedSub.textContent = `/ ${m.total}강`;
  els.targetValue.textContent = m.target.toFixed(1);
  els.targetSub.textContent = `현재 ${m.elapsed}일 경과`;
  els.deltaValue.textContent = `${m.delta >= 0 ? '+' : ''}${m.delta.toFixed(1)}`;
  els.deltaValue.classList.toggle('green', m.delta >= 0);
  els.deltaValue.classList.toggle('red', m.delta < 0);
  els.deltaSub.textContent = m.delta >= 0 ? '계획보다 앞섬' : '계획보다 뒤처짐';
  els.requiredPaceValue.textContent = m.requiredPace.toFixed(2);
  const pct = Math.max(0, Math.min(100, Math.round(m.overallRate * 100)));
  els.overallPct.textContent = `${pct}%`;
  els.overallText.textContent = `${m.completed}강 / ${m.total}강 수강 완료`;
  els.remainingText.textContent = `남은 강의 ${m.remainingLectures}강 · 남은 기간 ${m.remainingDays}일`;
  els.overallFill.style.width = `${pct}%`;
  els.statusBox.className = `status-box ${m.statusClass}`;
  els.statusBox.textContent = m.status;
  els.heroStatus.textContent = m.status;
  els.statusDesc.textContent = m.delta >= 0 ? `현재 목표보다 ${m.delta.toFixed(1)}강 앞서 있습니다.` : `현재 목표보다 ${Math.abs(m.delta).toFixed(1)}강 뒤처져 있습니다.`;
  els.paceAch.textContent = `현재 페이스 달성률 ${Math.round(m.paceAchievement * 100)}%`;
}

function commit() { state = normalizeState(state); saveState(); render(); }

els.exportBtn.addEventListener('click', () => {
  const payload = { app: 'Study Progress Tracker', version: VERSION, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `StudyProgressTracker_Backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

els.importInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed.data ?? parsed);
    saveState(); render();
    alert('백업을 불러왔습니다.');
  } catch {
    alert('올바른 Study Progress Tracker 백업 파일이 아닙니다.');
  } finally { e.target.value = ''; }
});

els.resetBtn.addEventListener('click', () => {
  if (!confirm('모든 학습 데이터를 초기화하시겠습니까?')) return;
  state = defaultData(); saveState(); render();
});

els.aboutBtn.addEventListener('click', () => els.aboutDialog.showModal());

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstallPrompt = e; els.installBtn.classList.remove('hidden');
});
els.installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBtn.classList.add('hidden');
});
window.addEventListener('appinstalled', () => els.installBtn.classList.add('hidden'));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

render();
