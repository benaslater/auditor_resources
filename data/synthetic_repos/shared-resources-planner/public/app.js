'use strict';

const ROW_PX = 48; // pixel height of one hour row in the calendar grid
const HOURS = 24;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Monday-first, matches getMonday()
const USER_COLORS = ['#2563eb', '#d97706', '#059669', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#4d7c0f'];
const USER_STORAGE_KEY = 'srp:userName';

const state = {
  config: null,
  currentUser: null,
  currentResourceId: null,
  weekStart: getMonday(new Date()),
  occurrences: [],
  myBookings: []
};

// ---------- date helpers ----------

function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isSameDate(a, b) {
  return toISODate(a) === toISODate(b);
}

function formatDayHeader(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// ---------- rendering helpers ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function userColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length];
}

function resourceName(resourceId) {
  const r = state.config.resources.find((r) => r.id === resourceId);
  return r ? r.name : resourceId;
}

function resourceColor(resourceId) {
  const r = state.config.resources.find((r) => r.id === resourceId);
  return (r && r.color) || '#2563eb';
}

// ---------- API ----------

async function api(path, options) {
  const res = await fetch(path, options);
  let body = null;
  try { body = await res.json(); } catch { /* e.g. 204 No Content */ }
  return { status: res.status, body };
}

async function loadConfig() {
  const { body } = await api('/api/config');
  state.config = body;
}

async function loadOccurrences() {
  const start = toISODate(state.weekStart);
  const end = toISODate(addDays(state.weekStart, 6));
  const { body } = await api(`/api/bookings/occurrences?start=${start}&end=${end}`);
  state.occurrences = body.occurrences;
}

async function loadMyBookings() {
  const { body } = await api('/api/bookings');
  const today = toISODate(new Date());
  state.myBookings = body.bookings
    .filter((b) => b.userName === state.currentUser)
    .filter((b) => (b.recurring ? !b.endDate || b.endDate >= today : b.date >= today))
    .sort((a, b) => {
      const aKey = a.recurring ? (a.startDate || '0000-00-00') : a.date;
      const bKey = b.recurring ? (b.startDate || '0000-00-00') : b.date;
      return aKey.localeCompare(bKey);
    });
}

// ---------- rendering ----------

function renderUserSelect() {
  const select = document.getElementById('user-select');
  select.innerHTML = '';
  for (const name of state.config.users) {
    const opt = el('option', null, name);
    opt.value = name;
    select.appendChild(opt);
  }
  select.value = state.currentUser;
}

function renderResourceTabs() {
  const nav = document.getElementById('resource-tabs');
  nav.innerHTML = '';
  for (const resource of state.config.resources) {
    const btn = el('button', 'resource-tab', resource.name);
    btn.type = 'button';
    if (resource.id === state.currentResourceId) {
      btn.classList.add('active');
      btn.style.background = resource.color;
      btn.style.borderColor = resource.color;
    }
    btn.addEventListener('click', () => {
      state.currentResourceId = resource.id;
      renderResourceTabs();
      renderCalendar();
    });
    nav.appendChild(btn);
  }
}

function renderWeekLabel() {
  document.getElementById('week-label').textContent = formatWeekLabel(state.weekStart);
}

function buildHourLabelColumn() {
  const col = el('div', 'cal-hourcol');
  col.style.position = 'relative';
  col.style.height = `${HOURS * ROW_PX}px`;
  for (let h = 0; h < HOURS; h++) {
    const label = el('div', 'cal-hourlabel', `${String(h).padStart(2, '0')}:00`);
    label.style.position = 'absolute';
    label.style.top = `${h * ROW_PX}px`;
    label.style.width = '100%';
    col.appendChild(label);
  }
  return col;
}

function buildBlock(occ) {
  const startMin = minutesOf(occ.startTime);
  const endMin = minutesOf(occ.endTime);
  const block = el('div', 'cal-block');
  block.style.top = `${(startMin / 60) * ROW_PX}px`;
  block.style.height = `${Math.max(((endMin - startMin) / 60) * ROW_PX, 18)}px`;
  block.style.background = userColor(occ.userName);

  const who = el('span', 'who', occ.recurring ? `${occ.userName} (weekly)` : occ.userName);
  const time = el('span', 'note', `${occ.startTime}–${occ.endTime}`);
  block.appendChild(who);
  block.appendChild(time);
  if (occ.note) block.appendChild(el('span', 'note', occ.note));

  if (occ.userName === state.currentUser) {
    const del = el('button', 'del', '×');
    del.type = 'button';
    del.title = 'Delete this booking';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this booking?')) return;
      await deleteBooking(occ.id);
    });
    block.appendChild(del);
  }

  return block;
}

function renderCalendar() {
  const calendar = document.getElementById('calendar');
  calendar.innerHTML = '';

  calendar.appendChild(el('div', 'cal-corner cal-header'));

  const today = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(state.weekStart, i);
    days.push(d);
    const header = el('div', 'cal-header');
    if (isSameDate(d, today)) header.classList.add('today');
    header.innerHTML = `<div>${DAY_NAMES[i]}</div><div>${formatDayHeader(d)}</div>`;
    calendar.appendChild(header);
  }

  calendar.appendChild(buildHourLabelColumn());

  for (const day of days) {
    const col = el('div', 'cal-day-col');
    col.style.height = `${HOURS * ROW_PX}px`;
    const dateStr = toISODate(day);
    const dayOccurrences = state.occurrences.filter(
      (o) => o.resourceId === state.currentResourceId && o.date === dateStr
    );
    for (const occ of dayOccurrences) {
      col.appendChild(buildBlock(occ));
    }
    calendar.appendChild(col);
  }
}

function describeBooking(booking) {
  const resource = resourceName(booking.resourceId);
  if (!booking.recurring) {
    return {
      title: `${resource} — ${booking.date}`,
      subtitle: `${booking.startTime}–${booking.endTime}${booking.note ? ' · ' + booking.note : ''}`
    };
  }
  const days = booking.daysOfWeek
    .slice()
    .sort()
    .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
    .join(', ');
  let range = '';
  if (booking.startDate && booking.endDate) range = ` (${booking.startDate} to ${booking.endDate})`;
  else if (booking.startDate) range = ` (from ${booking.startDate})`;
  else if (booking.endDate) range = ` (until ${booking.endDate})`;
  return {
    title: `${resource} — every ${days}${range}`,
    subtitle: `${booking.startTime}–${booking.endTime}${booking.note ? ' · ' + booking.note : ''}`
  };
}

function renderMyBookings() {
  const list = document.getElementById('my-bookings-list');
  list.innerHTML = '';

  if (state.myBookings.length === 0) {
    const li = el('li');
    li.className = 'empty-note';
    li.textContent = "You don't have any upcoming bookings.";
    list.appendChild(li);
    return;
  }

  for (const booking of state.myBookings) {
    const { title, subtitle } = describeBooking(booking);
    const li = el('li');
    const dot = el('div', 'dot');
    dot.style.background = resourceColor(booking.resourceId);
    const info = el('div', 'info');
    info.appendChild(el('div', null, title));
    info.appendChild(el('div', 'muted', subtitle));
    const delBtn = el('button', null, 'Delete');
    delBtn.type = 'button';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this booking?')) return;
      await deleteBooking(booking.id);
    });
    li.appendChild(dot);
    li.appendChild(info);
    li.appendChild(delBtn);
    list.appendChild(li);
  }
}

async function refreshAll() {
  await Promise.all([loadOccurrences(), loadMyBookings()]);
  renderCalendar();
  renderMyBookings();
}

async function deleteBooking(id) {
  await api(`/api/bookings/${id}?userName=${encodeURIComponent(state.currentUser)}`, { method: 'DELETE' });
  await refreshAll();
}

// ---------- booking form (modal) ----------

function openModal() {
  const form = document.getElementById('booking-form');
  form.reset();
  document.getElementById('f-resource').value = state.currentResourceId;
  document.getElementById('f-user').value = state.currentUser;
  document.getElementById('once-date-wrap').classList.remove('hidden');
  document.getElementById('recurring-wrap').classList.add('hidden');
  document.getElementById('conflict-box').classList.add('hidden');
  document.getElementById('form-error').classList.add('hidden');
  document.getElementById('f-date').value = toISODate(new Date());
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function showFormError(message) {
  const errorBox = document.getElementById('form-error');
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function showConflicts(conflicts) {
  const box = document.getElementById('conflict-box');
  const list = document.getElementById('conflict-list');
  list.innerHTML = '';
  for (const c of conflicts) {
    list.appendChild(el('li', null, `${c.userName} — ${c.date} ${c.startTime}–${c.endTime}${c.note ? ' (' + c.note + ')' : ''}`));
  }
  box.classList.remove('hidden');
}

function buildPayload() {
  const resourceId = document.getElementById('f-resource').value;
  const userName = document.getElementById('f-user').value;
  const startTime = document.getElementById('f-start-time').value;
  const endTime = document.getElementById('f-end-time').value;
  const note = document.getElementById('f-note').value;
  const type = document.querySelector('input[name="type"]:checked').value;

  const payload = { resourceId, userName, startTime, endTime, note };

  if (type === 'recurring') {
    const daysOfWeek = Array.from(document.querySelectorAll('#recurring-wrap input[type="checkbox"]:checked'))
      .map((cb) => Number(cb.value));
    payload.recurring = true;
    payload.daysOfWeek = daysOfWeek;
    const startDate = document.getElementById('f-start-date').value;
    const endDate = document.getElementById('f-end-date').value;
    if (startDate) payload.startDate = startDate;
    if (endDate) payload.endDate = endDate;
  } else {
    payload.recurring = false;
    payload.date = document.getElementById('f-date').value;
  }

  return payload;
}

async function handleSubmit(e) {
  e.preventDefault();
  document.getElementById('form-error').classList.add('hidden');

  const payload = buildPayload();
  if (document.getElementById('f-force').checked) payload.force = true;

  const { status, body } = await api('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (status === 201) {
    closeModal();
    await refreshAll();
  } else if (status === 409) {
    showConflicts(body.conflicts);
  } else {
    showFormError((body && body.error) || 'Something went wrong. Please check the form and try again.');
  }
}

// ---------- wiring ----------

function wireStaticControls() {
  document.getElementById('prev-week').addEventListener('click', async () => {
    state.weekStart = addDays(state.weekStart, -7);
    renderWeekLabel();
    await loadOccurrences();
    renderCalendar();
  });

  document.getElementById('next-week').addEventListener('click', async () => {
    state.weekStart = addDays(state.weekStart, 7);
    renderWeekLabel();
    await loadOccurrences();
    renderCalendar();
  });

  document.getElementById('today').addEventListener('click', async () => {
    state.weekStart = getMonday(new Date());
    renderWeekLabel();
    await loadOccurrences();
    renderCalendar();
  });

  document.getElementById('new-booking-btn').addEventListener('click', openModal);
  document.getElementById('cancel-booking').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
  document.getElementById('booking-form').addEventListener('submit', handleSubmit);

  document.querySelectorAll('input[name="type"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isRecurring = document.querySelector('input[name="type"]:checked').value === 'recurring';
      document.getElementById('once-date-wrap').classList.toggle('hidden', isRecurring);
      document.getElementById('recurring-wrap').classList.toggle('hidden', !isRecurring);
    });
  });

  document.getElementById('user-select').addEventListener('change', async (e) => {
    state.currentUser = e.target.value;
    localStorage.setItem(USER_STORAGE_KEY, state.currentUser);
    await refreshAll();
  });
}

function populateFormResourceOptions() {
  const select = document.getElementById('f-resource');
  select.innerHTML = '';
  for (const resource of state.config.resources) {
    const opt = el('option', null, resource.name);
    opt.value = resource.id;
    select.appendChild(opt);
  }
  const userSelect = document.getElementById('f-user');
  userSelect.innerHTML = '';
  for (const name of state.config.users) {
    const opt = el('option', null, name);
    opt.value = name;
    userSelect.appendChild(opt);
  }
}

async function init() {
  await loadConfig();
  document.getElementById('house-name').textContent = state.config.houseName || 'Shared Resources Planner';

  const savedUser = localStorage.getItem(USER_STORAGE_KEY);
  state.currentUser = state.config.users.includes(savedUser) ? savedUser : state.config.users[0];
  state.currentResourceId = state.config.resources[0].id;

  renderUserSelect();
  renderResourceTabs();
  populateFormResourceOptions();
  renderWeekLabel();
  wireStaticControls();

  await refreshAll();
}

init();
