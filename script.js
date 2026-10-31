/**
 * script.js — Student Task Manager
 * =========================================================
 * Architecture:
 *  - On first load: fetches tasks.json → seeds LocalStorage
 *  - Subsequent loads: reads data from LocalStorage only
 *  - All CRUD operations write back to LocalStorage
 *  - Views: Dashboard | Task List | Calendar | Analytics
 * =========================================================
 */

'use strict';

/* =========================================================
   CONSTANTS & STATE
   ========================================================= */
const LS_KEY = 'stm_tasks_v1';
const TASKS_JSON_PATH = 'tasks.json';

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const STATUS_ORDER   = { 'In Progress': 0, 'To Do': 1, Completed: 2 };

const DAY_NAMES  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

let tasks = [];          // working data array
let editingId = null;    // task id currently being edited
let deletingId = null;   // task id pending deletion
let calYear  = 0;
let calMonth = 0;        // 0-based month index

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem(LS_KEY);
  if (stored) {
    // LocalStorage already seeded — use it directly
    tasks = JSON.parse(stored);
    boot();
  } else {
    // First run — fetch tasks.json and seed LocalStorage
    fetch(TASKS_JSON_PATH)
      .then(r => {
        if (!r.ok) throw new Error('Could not load tasks.json');
        return r.json();
      })
      .then(data => {
        tasks = Array.isArray(data) ? data : (data.tasks || []);
        saveToStorage();
        boot();
      })
      .catch(err => {
        console.warn('tasks.json load failed, starting empty:', err.message);
        tasks = [];
        boot();
      });
  }
});

function boot() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();

  bindNav();
  bindTopbar();
  bindModal();
  bindFilters();
  bindCalendar();
  bindProgressSlider();

  renderAll();
  showView('dashboard');
}

/* =========================================================
   LOCAL STORAGE
   ========================================================= */
function saveToStorage() {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
}

/* =========================================================
   HELPERS — DATE & STATUS
   ========================================================= */
function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysDiff(dateStr) {
  const due  = new Date(dateStr + 'T00:00:00');
  const now  = new Date(); now.setHours(0,0,0,0);
  return Math.round((due - now) / 86400000);
}

function isOverdue(task) {
  return task.status !== 'Completed' && daysDiff(task.due_date) < 0;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function genId() {
  const nums = tasks.map(t => {
    const parts = t.id.split('-');
    return parseInt(parts[parts.length - 1]) || 0;
  });
  const max = nums.length ? Math.max(...nums) : 0;
  return 'TASK-' + String(max + 1).padStart(3, '0');
}

/* =========================================================
   DERIVED STATISTICS
   ========================================================= */
function calcStats() {
  const total      = tasks.length;
  const completed  = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const todo       = tasks.filter(t => t.status === 'To Do').length;
  const overdue    = tasks.filter(t => isOverdue(t)).length;
  const avgProgress = total
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / total)
    : 0;
  return { total, completed, inProgress, todo, overdue, avgProgress };
}

/* =========================================================
   RENDER ORCHESTRATOR
   ========================================================= */
function renderAll() {
  renderDashboard();
  renderTaskTable();
  renderCalendar();
  renderAnalytics();
  populateCourseFilter();
  populateCourseDatalist();
}

/* =========================================================
   VIEW: DASHBOARD
   ========================================================= */
function renderDashboard() {
  const stats = calcStats();
  document.getElementById('statTotal').textContent      = stats.total;
  document.getElementById('statCompleted').textContent  = stats.completed;
  document.getElementById('statInProgress').textContent = stats.inProgress;
  document.getElementById('statTodo').textContent       = stats.todo;
  document.getElementById('statOverdue').textContent    = stats.overdue;

  renderUpcoming();
  renderOverdueList();
  renderCourseBreakdown();
}

function renderUpcoming() {
  const upcoming = tasks
    .filter(t => t.status !== 'Completed' && daysDiff(t.due_date) >= 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  const el = document.getElementById('upcomingList');
  document.getElementById('upcomingCount').textContent = upcoming.length + ' tugas';

  if (!upcoming.length) {
    el.innerHTML = '<div class="empty-state">Tidak ada tugas mendatang 🎉</div>';
    return;
  }
  el.innerHTML = upcoming.map(t => {
    const d = daysDiff(t.due_date);
    const dLabel = d === 0 ? 'Hari ini' : `${d} hari lagi`;
    return `
      <div class="task-mini-item">
        <span class="mini-title" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
        <span class="mini-meta">
          ${priorityBadge(t.priority)}
          <span class="mini-days">${dLabel}</span>
        </span>
      </div>`;
  }).join('');
}

function renderOverdueList() {
  const overdue = tasks
    .filter(t => isOverdue(t))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const el = document.getElementById('overdueList');
  document.getElementById('overdueCount').textContent = overdue.length + ' tugas';

  if (!overdue.length) {
    el.innerHTML = '<div class="empty-state">Tidak ada tugas terlambat ✅</div>';
    return;
  }
  el.innerHTML = overdue.map(t => {
    const d = Math.abs(daysDiff(t.due_date));
    return `
      <div class="task-mini-item">
        <span class="mini-title" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
        <span class="mini-meta">
          ${priorityBadge(t.priority)}
          <span class="mini-days overdue-tag">${d} hari lalu</span>
        </span>
      </div>`;
  }).join('');
}

function renderCourseBreakdown() {
  const courses = {};
  tasks.forEach(t => {
    if (!courses[t.course]) courses[t.course] = { total: 0, done: 0, progress: 0 };
    courses[t.course].total++;
    if (t.status === 'Completed') courses[t.course].done++;
    courses[t.course].progress += t.progress;
  });

  const el = document.getElementById('courseBreakdown');
  el.innerHTML = Object.entries(courses)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, info]) => {
      const avg = Math.round(info.progress / info.total);
      const isDone = avg === 100;
      return `
        <div class="course-row">
          <div class="course-row-header">
            <span class="course-row-name">${escHtml(name)}</span>
            <span class="course-row-meta">${info.done}/${info.total} selesai &bull; avg ${avg}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill${isDone?' done':''}" style="width:${avg}%"></div>
          </div>
        </div>`;
    }).join('');
}

/* =========================================================
   VIEW: TASK LIST
   ========================================================= */
function getFilteredTasks() {
  const search   = (document.getElementById('globalSearch')?.value || '').toLowerCase();
  const fStatus  = document.getElementById('filterStatus')?.value  || '';
  const fPrio    = document.getElementById('filterPriority')?.value || '';
  const fCourse  = document.getElementById('filterCourse')?.value  || '';
  const sortKey  = document.getElementById('sortBy')?.value        || 'due_date';

  let list = tasks.filter(t => {
    if (fStatus && t.status !== fStatus) return false;
    if (fPrio   && t.priority !== fPrio) return false;
    if (fCourse && t.course   !== fCourse) return false;
    if (search && !(
      t.title.toLowerCase().includes(search)    ||
      t.course.toLowerCase().includes(search)   ||
      t.description.toLowerCase().includes(search)
    )) return false;
    return true;
  });

  list.sort((a, b) => {
    if (sortKey === 'due_date')   return a.due_date.localeCompare(b.due_date);
    if (sortKey === 'priority')   return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sortKey === 'progress')   return b.progress - a.progress;
    if (sortKey === 'created_at') return b.created_at.localeCompare(a.created_at);
    return 0;
  });

  return list;
}

function renderTaskTable() {
  const list = getFilteredTasks();
  const tbody = document.getElementById('taskTableBody');
  document.getElementById('taskCount').textContent = `Menampilkan ${list.length} dari ${tasks.length} tugas`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--color-muted)">Tidak ada tugas yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => {
    const overdue    = isOverdue(t);
    const diff       = daysDiff(t.due_date);
    const dueCls     = overdue ? 'due-overdue' : diff <= 3 && t.status !== 'Completed' ? 'due-soon' : '';
    const doneClass  = t.progress === 100 ? ' done' : '';
    return `
      <tr>
        <td class="task-title-cell">
          <span class="task-title-main" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
          <span class="task-course-sub">${escHtml(t.course)}</span>
        </td>
        <td>${escHtml(t.course)}</td>
        <td class="due-date-cell ${dueCls}">${formatDate(t.due_date)}${overdue ? ' ⚠️' : ''}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${statusBadge(t.status, overdue)}</td>
        <td class="progress-cell">
          <div class="progress-mini-wrap">
            <div class="progress-mini-bar"><div class="progress-mini-fill${doneClass}" style="width:${t.progress}%"></div></div>
            <span class="progress-pct">${t.progress}%</span>
          </div>
        </td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Edit" onclick="openEditModal('${t.id}')">✏️</button>
            <button class="btn-icon delete" title="Hapus" onclick="openDeleteModal('${t.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* =========================================================
   VIEW: CALENDAR
   ========================================================= */
function renderCalendar() {
  const el = document.getElementById('calendarGrid');
  document.getElementById('calMonthYear').textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  // Build task map: YYYY-MM-DD → [task, ...]
  const taskMap = {};
  tasks.forEach(t => {
    if (!taskMap[t.due_date]) taskMap[t.due_date] = [];
    taskMap[t.due_date].push(t);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = today();

  let html = DAY_NAMES.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  // leading empty cells
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day other-month"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayTasks = taskMap[dateStr] || [];
    const hasTasks = dayTasks.length > 0;

    const dots = dayTasks.map(t => {
      let cls = 'dot-medium';
      if (t.status === 'Completed')          cls = 'dot-completed';
      else if (isOverdue(t))                 cls = 'dot-overdue';
      else if (t.priority === 'High')        cls = 'dot-high';
      else if (t.priority === 'Low')         cls = 'dot-low';
      return `<span class="dot ${cls}" title="${escHtml(t.title)}"></span>`;
    }).join('');

    const classes = ['cal-day', isToday ? 'today' : '', hasTasks ? 'has-tasks' : '', 'other-month-false'].filter(Boolean).join(' ');
    html += `<div class="${classes}" ${hasTasks ? `onclick="showCalDay('${dateStr}')"` : ''}>
      <span class="cal-day-num">${d}</span>
      ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
    </div>`;
  }

  el.innerHTML = html;
}

function showCalDay(dateStr) {
  const dayTasks = tasks.filter(t => t.due_date === dateStr);
  if (!dayTasks.length) return;

  const [y, m, d] = dateStr.split('-');
  document.getElementById('calDayTitle').textContent =
    `Tugas pada ${d} ${MONTH_NAMES[parseInt(m)-1]} ${y} (${dayTasks.length} tugas)`;

  document.getElementById('calDayList').innerHTML = dayTasks.map(t => `
    <div class="task-mini-item" style="margin-bottom:6px">
      <span class="mini-title" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
      <span class="mini-meta">
        ${priorityBadge(t.priority)}
        ${statusBadge(t.status, isOverdue(t))}
      </span>
    </div>`).join('');

  document.getElementById('calDayDetail').style.display = 'block';
}

/* =========================================================
   VIEW: ANALYTICS
   ========================================================= */
function renderAnalytics() {
  const stats = calcStats();
  renderDonut('chartStatus', 'chartStatusLegend', [
    { label: 'Selesai',       value: stats.completed,  color: '#10b981' },
    { label: 'In Progress',   value: stats.inProgress, color: '#3b82f6' },
    { label: 'To Do',         value: stats.todo,       color: '#6b7280' },
  ]);

  const high   = tasks.filter(t => t.priority === 'High').length;
  const medium = tasks.filter(t => t.priority === 'Medium').length;
  const low    = tasks.filter(t => t.priority === 'Low').length;
  renderDonut('chartPriority', 'chartPriorityLegend', [
    { label: 'High',   value: high,   color: '#ef4444' },
    { label: 'Medium', value: medium, color: '#f59e0b' },
    { label: 'Low',    value: low,    color: '#10b981' },
  ]);

  renderCourseBar();
  renderAnalyticsSummary(stats);
}

function renderDonut(svgId, legendId, segments) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 80, cx = 110, cy = 110, stroke = 32;
  const circum = 2 * Math.PI * r;

  let offset = 0;
  const svgEl = document.getElementById(svgId);
  if (!svgEl) return;

  let paths = '';
  let legendHtml = '';

  if (total === 0) {
    svgEl.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>
      <text x="${cx}" y="${cy+6}" text-anchor="middle" font-size="13" fill="#57606a">Tidak ada data</text>`;
    document.getElementById(legendId).innerHTML = '';
    return;
  }

  segments.forEach(seg => {
    const pct  = seg.value / total;
    const dash = pct * circum;
    const gap  = circum - dash;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset * circum / 1).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    legendHtml += `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${seg.color}"></span>${seg.label} (${seg.value})</span>`;
    offset += pct;
  });

  const pctDone = total ? Math.round(segments[0].value / total * 100) : 0;
  svgEl.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>
    ${paths}
    <text x="${cx}" y="${cy-6}" text-anchor="middle" font-size="22" font-weight="bold" fill="#1f2328">${pctDone}%</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="11" fill="#57606a">${total} total</text>`;

  document.getElementById(legendId).innerHTML = legendHtml;
}

function renderCourseBar() {
  const courses = {};
  tasks.forEach(t => {
    if (!courses[t.course]) courses[t.course] = 0;
    courses[t.course]++;
  });

  const sorted = Object.entries(courses).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;
  const el = document.getElementById('chartCourseBar');
  if (!el) return;

  el.innerHTML = sorted.map(([name, count]) => `
    <div class="bar-row">
      <div class="bar-label" title="${escHtml(name)}">${escHtml(name)}</div>
      <div class="bar-wrap"><div class="bar-fill" style="width:${Math.round(count/max*100)}%"></div></div>
      <div class="bar-val">${count}</div>
    </div>`).join('');
}

function renderAnalyticsSummary(stats) {
  const completionRate = stats.total
    ? Math.round(stats.completed / stats.total * 100)
    : 0;
  const avgProg = stats.total
    ? Math.round(tasks.reduce((s, t) => s + t.progress, 0) / stats.total)
    : 0;
  const highPrio = tasks.filter(t => t.priority === 'High' && t.status !== 'Completed').length;
  const courses  = new Set(tasks.map(t => t.course)).size;

  const el = document.getElementById('analyticsSummary');
  if (!el) return;
  el.innerHTML = [
    { val: completionRate + '%', lbl: 'Tingkat Penyelesaian' },
    { val: avgProg + '%',        lbl: 'Rata-rata Progress' },
    { val: stats.overdue,        lbl: 'Tugas Terlambat' },
    { val: highPrio,             lbl: 'High Priority Aktif' },
    { val: courses,              lbl: 'Mata Kuliah' },
    { val: stats.total,          lbl: 'Total Tugas' },
  ].map(x => `
    <div class="summary-item">
      <div class="summary-val">${x.val}</div>
      <div class="summary-lbl">${x.lbl}</div>
    </div>`).join('');
}

/* =========================================================
   BADGE HELPERS
   ========================================================= */
function priorityBadge(priority) {
  const cls = {
    High: 'badge-priority-high',
    Medium: 'badge-priority-medium',
    Low: 'badge-priority-low'
  }[priority] || 'badge-priority-low';
  return `<span class="badge ${cls}">${priority}</span>`;
}

function statusBadge(status, overdue) {
  if (overdue) return `<span class="badge badge-status-overdue">Terlambat</span>`;
  const cls = {
    'Completed':  'badge-status-completed',
    'In Progress':'badge-status-inprogress',
    'To Do':      'badge-status-todo'
  }[status] || 'badge-status-todo';
  const label = { 'Completed': 'Selesai', 'In Progress': 'In Progress', 'To Do': 'To Do' }[status] || status;
  return `<span class="badge ${cls}">${label}</span>`;
}

/* =========================================================
   POPULATE FILTER DROPDOWNS
   ========================================================= */
function populateCourseFilter() {
  const sel = document.getElementById('filterCourse');
  if (!sel) return;
  const currentVal = sel.value;
  const courses = [...new Set(tasks.map(t => t.course))].sort();
  // keep first option, rebuild rest
  while (sel.options.length > 1) sel.remove(1);
  courses.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
  sel.value = currentVal;
}

function populateCourseDatalist() {
  const dl = document.getElementById('courseList');
  if (!dl) return;
  const courses = [...new Set(tasks.map(t => t.course))].sort();
  dl.innerHTML = courses.map(c => `<option value="${escHtml(c)}">`).join('');
}

/* =========================================================
   MODAL: ADD / EDIT TASK
   ========================================================= */
function openAddModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Tambah Tugas Baru';
  document.getElementById('taskForm').reset();
  document.getElementById('fieldId').value = '';
  document.getElementById('progressVal').textContent = '0';
  clearFieldErrors();
  document.getElementById('taskModal').classList.add('open');
}

function openEditModal(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Tugas';
  document.getElementById('fieldId').value       = t.id;
  document.getElementById('fieldTitle').value    = t.title;
  document.getElementById('fieldCourse').value   = t.course;
  document.getElementById('fieldDesc').value     = t.description;
  document.getElementById('fieldDue').value      = t.due_date;
  document.getElementById('fieldPriority').value = t.priority;
  document.getElementById('fieldStatus').value   = t.status;
  document.getElementById('fieldProgress').value = t.progress;
  document.getElementById('progressVal').textContent = t.progress;
  clearFieldErrors();
  document.getElementById('taskModal').classList.add('open');
}

function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
  editingId = null;
}

function clearFieldErrors() {
  ['errTitle','errCourse','errDue','errPriority','errStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

/* =========================================================
   FORM SUBMISSION
   ========================================================= */
function bindProgressSlider() {
  const progressSlider = document.getElementById('fieldProgress');
  if (progressSlider) {
    progressSlider.addEventListener('input', () => {
      document.getElementById('progressVal').textContent = progressSlider.value;
    });
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  clearFieldErrors();

  const title    = document.getElementById('fieldTitle').value.trim();
  const course   = document.getElementById('fieldCourse').value.trim();
  const desc     = document.getElementById('fieldDesc').value.trim();
  const due      = document.getElementById('fieldDue').value;
  const priority = document.getElementById('fieldPriority').value;
  const status   = document.getElementById('fieldStatus').value;
  let   progress = parseInt(document.getElementById('fieldProgress').value, 10);

  let valid = true;
  if (!title)    { document.getElementById('errTitle').textContent    = 'Judul wajib diisi.';        valid = false; }
  if (!course)   { document.getElementById('errCourse').textContent   = 'Mata kuliah wajib diisi.';  valid = false; }
  if (!due)      { document.getElementById('errDue').textContent      = 'Deadline wajib diisi.';     valid = false; }
  if (!priority) { document.getElementById('errPriority').textContent = 'Prioritas wajib dipilih.';  valid = false; }
  if (!status)   { document.getElementById('errStatus').textContent   = 'Status wajib dipilih.';     valid = false; }
  if (!valid) return;

  // Enforce progress ↔ status consistency
  if (status === 'Completed') progress = 100;
  if (status === 'To Do')     progress = 0;
  if (status === 'In Progress') {
    if (progress === 0)   progress = 10;
    if (progress === 100) progress = 99;
  }

  if (editingId) {
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], title, course, description: desc, due_date: due, priority, status, progress };
    }
    showToast('Tugas berhasil diperbarui.', 'success');
  } else {
    const newTask = {
      id: genId(),
      title,
      course,
      description: desc,
      due_date: due,
      priority,
      status,
      progress,
      created_at: today()
    };
    tasks.push(newTask);
    showToast('Tugas baru berhasil ditambahkan.', 'success');
  }

  saveToStorage();
  renderAll();
  closeTaskModal();
}

/* =========================================================
   MODAL: DELETE
   ========================================================= */
function openDeleteModal(id) {
  deletingId = id;
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  deletingId = null;
}

function confirmDelete() {
  if (!deletingId) return;
  tasks = tasks.filter(t => t.id !== deletingId);
  saveToStorage();
  renderAll();
  closeDeleteModal();
  showToast('Tugas berhasil dihapus.', 'success');
}

/* =========================================================
   TOAST
   ========================================================= */
let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

/* =========================================================
   NAVIGATION
   ========================================================= */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById('view-' + name);
  if (viewEl) viewEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', tasks: 'Daftar Tugas', calendar: 'Kalender', analytics: 'Statistik' };
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = titles[name] || '';
}

function bindNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      showView(view);
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('mobile-open');
    });
  });
}

/* =========================================================
   TOPBAR BINDINGS
   ========================================================= */
function bindTopbar() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  const menuBtn       = document.getElementById('menuBtn');
  const sidebar       = document.getElementById('sidebar');
  const mainContent   = document.getElementById('mainContent');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('expanded');
    });
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  const addBtn = document.getElementById('addTaskBtn');
  if (addBtn) addBtn.addEventListener('click', openAddModal);

  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderTaskTable();
      // Auto-switch to task list view when searching
      showView('tasks');
    });
  }
}

/* =========================================================
   FILTER BINDINGS
   ========================================================= */
function bindFilters() {
  ['filterStatus','filterPriority','filterCourse','sortBy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderTaskTable);
  });

  const clearBtn = document.getElementById('clearFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('filterStatus').value   = '';
      document.getElementById('filterPriority').value = '';
      document.getElementById('filterCourse').value   = '';
      document.getElementById('sortBy').value         = 'due_date';
      document.getElementById('globalSearch').value   = '';
      renderTaskTable();
    });
  }
}

/* =========================================================
   MODAL BINDINGS
   ========================================================= */
function bindModal() {
  document.getElementById('modalClose').addEventListener('click', closeTaskModal);
  document.getElementById('modalCancel').addEventListener('click', closeTaskModal);
  document.getElementById('taskModal').addEventListener('click', e => {
    if (e.target === document.getElementById('taskModal')) closeTaskModal();
  });
  document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);

  document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
  });

  document.getElementById('calDayClose').addEventListener('click', () => {
    document.getElementById('calDayDetail').style.display = 'none';
  });
}

/* =========================================================
   CALENDAR BINDINGS
   ========================================================= */
function bindCalendar() {
  document.getElementById('calPrev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
    document.getElementById('calDayDetail').style.display = 'none';
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
    document.getElementById('calDayDetail').style.display = 'none';
  });
}

/* =========================================================
   UTILITY
   ========================================================= */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}
