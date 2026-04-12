'use strict';

/* ═══════════════════════════════════════════════════════
   RIDER LIVE OPS v2.1 — DASHBOARD JS
   - Company stats from /city/5/company/463
   - Riders list + live detail + shifts
   - Auto refresh, search, filter, sort
   ═══════════════════════════════════════════════════════ */

const API      = 'https://sa.me.logisticsbackoffice.com/api';
const CITY_ID  = 5;
const COMPANY  = 463;
const REFRESH_MS = 30_000;

// ── STATE ──────────────────────────────────────────────
let allRiders      = [];
let filteredRiders = [];
let currentFilter  = 'all';
let selectedRiderId = null;
let refreshTimer   = null;
let searchQuery    = '';
let sortBy         = 'name';
let isLoading      = false;

// ── LABEL MAPS ─────────────────────────────────────────
const STATUS_LABEL = {
  working:  'يعمل',
  starting: 'بداية',
  break:    'استراحة',
  offline:  'غير متصل',
  late:     'متأخر',
};
const STATUS_BADGE = {
  working:  'badge-working',
  starting: 'badge-starting',
  break:    'badge-break',
  late:     'badge-late',
  offline:  'badge-offline',
};
const DELIVERY_AR = {
  dispatched:       'تم الإرسال',
  courier_notified: 'تم الإشعار',
  accepted:         'مقبولة',
  near_pickup:      'قرب الاستلام',
  picked_up:        'تم الاستلام',
  left_pickup:      'غادر الاستلام',
  near_dropoff:     'قرب التسليم',
  completed:        'مكتملة',
  cancelled:        'ملغاة',
};
const SHIFT_STATE_AR = {
  PUBLISHED: 'منشورة',
  ACTIVE:    'نشطة',
  FINISHED:  'منتهية',
  DRAFT:     'مسودة',
};
const VEHICLE_ICONS = {
  Motorbike: '🏍',
  Motor_Bike: '🏍',
  Bicycle:   '🚲',
  Car:       '🚗',
};

// ── HELPERS ────────────────────────────────────────────

function isLate(rider) {
  if (!rider) return false;
  if ((rider.performance?.time_spent?.late_seconds || 0) > 0) return true;
  if (rider.active_shift_ended_at) {
    const ended = new Date(rider.active_shift_ended_at);
    if (ended < new Date() && ['working', 'starting'].includes(rider.status)) return true;
  }
  return false;
}

function effectiveStatus(rider) {
  return isLate(rider) ? 'late' : (rider.status || 'offline');
}

function cleanName(name) {
  if (!name) return '—';
  return name.replace(/\*\d+\*/g, '').trim() || name.trim();
}

function avatarClass(name) {
  if (!name) return 'av-4';
  return `av-${name.charCodeAt(0) % 5}`;
}

function avatarInitial(name) {
  const c = cleanName(name);
  return c.charAt(0) || '?';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ar-SA', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSeconds(sec) {
  if (!sec || sec === 0) return '0 دقيقة';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h}س`);
  if (m) parts.push(`${m}د`);
  return parts.join(' ') || '< دقيقة';
}

function shiftDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}س ${m}د`;
}

function shiftRemaining(start, end) {
  if (!start || !end) return { text: '—', pct: 0 };
  const now = new Date(), s = new Date(start), e = new Date(end);
  if (now < s) return { text: 'لم تبدأ بعد', pct: 0 };
  if (now > e) return { text: 'انتهت', pct: 100 };
  const pct = Math.round(((now - s) / (e - s)) * 100);
  const rem = Math.floor((e - now) / 60_000);
  return { text: `${Math.floor(rem / 60)}س ${rem % 60}د متبقي`, pct };
}

function walletStatus(status) {
  const map = {
    balance_over_hard_limit: { text: 'تجاوز الحد الصعب', cls: 'wallet-over-hard' },
    balance_over_soft_limit: { text: 'تجاوز الحد اللين',  cls: 'wallet-over-soft' },
    ok:                      { text: 'طبيعي',             cls: 'wallet-ok' },
  };
  return map[status] || { text: status || '—', cls: '' };
}

function toast(msg, type = 'info', ms = 3000) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, ms);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

// ── API CALLS ──────────────────────────────────────────

async function apiFetch(url) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function fetchCompanyStats() {
  return apiFetch(`${API}/rider-live-operations/v1/external/city/${CITY_ID}/company/${COMPANY}`);
}

async function fetchRiders() {
  const data = await apiFetch(
    `${API}/rider-live-operations/v1/external/city/${CITY_ID}/riders?page=0&size=100`
  );
  return data.content || [];
}

async function fetchRiderDetails(id) {
  return apiFetch(`${API}/rider-live-operations/v2/external/rider/${id}`);
}

async function fetchRiderShifts(id) {
  const now   = new Date();
  const start = new Date(now - 7 * 86_400_000).toISOString();
  const end   = new Date(now + 7 * 86_400_000).toISOString();
  const qs = new URLSearchParams({ city_id: CITY_ID, start_at: start, end_at: end });
  return apiFetch(`${API}/rooster/v3/employees/${id}/shifts?${qs}`);
}

// ── COMPANY STATS RENDER ───────────────────────────────

async function loadCompanyStats(silent = false) {
  const spinner = document.getElementById('cpLoadingSpinner');
  if (spinner) spinner.style.display = 'flex';
  try {
    const d = await fetchCompanyStats();
    renderCompanyStats(d);
  } catch (err) {
    console.warn('Company stats error:', err.message);
    if (!silent) toast('تعذّر تحميل بيانات الشركة', 'error');
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

function renderCompanyStats(d) {
  const w = d.workers || {};
  const o = d.orders  || {};

  // Workers
  setText('cp-checkedIn',     w.checked_in     ?? '—');
  setText('cp-checkedInLate', w.checked_in_late ?? '—');
  setText('cp-notCheckedIn',  w.not_checked_in  ?? '—');
  setText('cp-onBreak',       w.workers_on_break ?? '—');

  // Orders
  setText('cp-ordersAccepted', o.accepted ?? '—');
  setText('cp-ordersDeclined', o.declined ?? '—');

  // Utilization bar
  const util    = d.utilization_rate ?? 0;
  const utilPct = Math.min(Math.round((util / 5) * 100), 100); // scale: assume max ~5
  setText('cp-utilRate', `${util}`);
  const bar = document.getElementById('cp-utilBar');
  if (bar) bar.style.width = `${utilPct}%`;

  // Late banner
  const lateCount = d.late_workers ?? 0;
  const banner    = document.getElementById('cpLateBanner');
  if (banner) {
    banner.style.display = lateCount > 0 ? 'flex' : 'none';
    setText('cp-lateWorkers',   lateCount);
    setText('cp-reassignments', d.reassignments ?? 0);
  }

  // Vehicles
  const vRow = document.getElementById('cp-vehicles');
  if (vRow && d.workers_per_vehicle?.length) {
    vRow.innerHTML = d.workers_per_vehicle.map(v => {
      const icon  = VEHICLE_ICONS[v.vehicle?.icon?.trim()] || '🛵';
      const name  = v.vehicle?.profile || v.vehicle?.icon || 'مركبة';
      return `
        <div class="cp-vehicle-chip">
          <span class="cp-vehicle-chip-icon">${icon}</span>
          <div>
            <div class="cp-vehicle-chip-name">${name}</div>
          </div>
          <span class="cp-vehicle-chip-count">${v.total_workers}</span>
        </div>`;
    }).join('');
  } else if (vRow) {
    vRow.innerHTML = '<span class="cp-loading-text">لا توجد بيانات</span>';
  }

  // Company stats table
  const tbody = document.getElementById('cp-statsBody');
  if (tbody && d.company_stats?.length) {
    tbody.innerHTML = d.company_stats.map(s => `
      <tr>
        <td>${s.company_id}</td>
        <td style="color:var(--green)">${s.active_workers}</td>
        <td style="color:var(--amber)">${s.total_orders}</td>
        <td>${s.utilization_rate}</td>
      </tr>`).join('');
  }
}

// ── RIDER LIST RENDER ──────────────────────────────────

function buildRiderCard(rider) {
  const status = effectiveStatus(rider);
  const late   = status === 'late';
  const avCls  = avatarClass(rider.name);
  const delivs = rider.deliveries_info?.completed_deliveries_count || 0;
  const active = rider.deliveries_info?.has_active_deliveries;
  const isSelected = rider.employee_id === selectedRiderId;

  const card = document.createElement('div');
  card.className = `rider-card${late ? ' late-card' : ''}${isSelected ? ' selected' : ''}`;
  card.dataset.id = rider.employee_id;

  card.innerHTML = `
    ${late ? '<div class="late-indicator"></div>' : ''}
    <div class="rider-avatar ${avCls}">${avatarInitial(rider.name)}</div>
    <div class="rider-card-info">
      <div class="rider-card-name">${cleanName(rider.name)}</div>
      <div class="rider-card-sub">${rider.starting_point?.name || '—'} · ${rider.phone_number || '—'}</div>
    </div>
    <div class="rider-card-meta">
      <span class="badge ${STATUS_BADGE[status] || 'badge-offline'}">${STATUS_LABEL[status] || status}</span>
      <span class="deliveries-mini">${active ? '🟢' : '⚪'} ${delivs}</span>
    </div>`;

  card.addEventListener('click', () => selectRider(rider.employee_id));
  return card;
}

function renderRiderList() {
  const list = document.getElementById('riderList');
  list.innerHTML = '';
  if (!filteredRiders.length) {
    list.innerHTML = '<div class="no-data">لا يوجد سائقون مطابقون</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  filteredRiders.forEach((r, i) => {
    const card = buildRiderCard(r);
    card.style.animationDelay = `${Math.min(i * 18, 400)}ms`;
    frag.appendChild(card);
  });
  list.appendChild(frag);
}

function updateHeaderStats(riders) {
  const c = { working: 0, starting: 0, break: 0, late: 0 };
  riders.forEach(r => { const s = effectiveStatus(r); if (c[s] !== undefined) c[s]++; });
  setText('stat-working',  c.working);
  setText('stat-starting', c.starting);
  setText('stat-break',    c.break);
  setText('stat-late',     c.late);
  setText('stat-total',    riders.length);
}

function applyFiltersAndSort() {
  let list = [...allRiders];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(r =>
      cleanName(r.name).toLowerCase().includes(q) ||
      (r.phone_number || '').includes(q) ||
      String(r.employee_id).includes(q)
    );
  }

  if (currentFilter !== 'all') {
    list = list.filter(r => effectiveStatus(r) === currentFilter);
  }

  list.sort((a, b) => {
    switch (sortBy) {
      case 'name':        return cleanName(a.name).localeCompare(cleanName(b.name), 'ar');
      case 'status':      return effectiveStatus(a).localeCompare(effectiveStatus(b));
      case 'deliveries':  return (b.deliveries_info?.completed_deliveries_count || 0) - (a.deliveries_info?.completed_deliveries_count || 0);
      case 'utilization': return (b.performance?.utilization_rate || 0) - (a.performance?.utilization_rate || 0);
      case 'late':        return (b.performance?.time_spent?.late_seconds || 0) - (a.performance?.time_spent?.late_seconds || 0);
      default: return 0;
    }
  });

  // Late riders always on top when viewing all
  if (currentFilter === 'all') {
    list.sort((a, b) => (effectiveStatus(b) === 'late' ? 1 : 0) - (effectiveStatus(a) === 'late' ? 1 : 0));
  }

  filteredRiders = list;
  renderRiderList();
}

// ── LOAD RIDERS ────────────────────────────────────────

async function loadRiders(silent = false) {
  if (isLoading) return;
  isLoading = true;

  const btn = document.getElementById('btnRefresh');
  btn.classList.add('spinning');

  if (!silent) {
    document.getElementById('riderList').innerHTML = `
      <div class="loading-state"><div class="spinner"></div><p>جاري تحميل السائقين...</p></div>`;
  }

  try {
    allRiders = await fetchRiders();
    updateHeaderStats(allRiders);
    applyFiltersAndSort();
    setText('lastUpdate', new Date().toLocaleTimeString('ar-SA'));
    if (!silent) toast(`تم تحميل ${allRiders.length} سائق`, 'success');
  } catch (err) {
    console.error('loadRiders:', err);
    if (!silent) {
      document.getElementById('riderList').innerHTML = `
        <div class="no-data">⚠ فشل التحميل<br><small>${err.message}</small><br><br>
        <small>تأكد من تسجيل الدخول في المنصة</small></div>`;
      toast('فشل تحميل البيانات', 'error');
    }
  } finally {
    isLoading = false;
    btn.classList.remove('spinning');
  }
}

// ── SELECT RIDER ───────────────────────────────────────

async function selectRider(id) {
  selectedRiderId = id;

  document.querySelectorAll('.rider-card').forEach(c =>
    c.classList.toggle('selected', Number(c.dataset.id) === id)
  );

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('riderDetail').style.display = 'flex';
  switchTab('overview');

  try {
    const rider = await fetchRiderDetails(id);
    renderRiderHeader(rider);
    renderOverviewTab(rider);
    renderDeliveriesTab(rider);
    renderPerformanceTab(rider);
    loadShifts(id);
  } catch (err) {
    console.error('selectRider:', err);
    toast('فشل تحميل تفاصيل السائق', 'error');
  }
}

async function loadShifts(id) {
  const loading = document.getElementById('shiftsLoading');
  const content = document.getElementById('shiftsContent');
  loading.style.display = 'flex';
  content.style.display = 'none';
  try {
    const shifts = await fetchRiderShifts(id);
    renderShiftsTab(shifts);
    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    loading.innerHTML = `<p style="color:var(--red)">⚠ فشل تحميل الورديات</p>`;
  }
}

// ── RENDER RIDER DETAIL ────────────────────────────────

function renderRiderHeader(rider) {
  const status = effectiveStatus(rider);
  const avCls  = avatarClass(rider.name);

  const av = document.getElementById('detailAvatar');
  av.textContent = avatarInitial(rider.name);
  av.className   = `detail-avatar ${avCls}`;

  setText('detailName', cleanName(rider.name));

  const badge = document.getElementById('detailStatusBadge');
  badge.textContent = STATUS_LABEL[status] || status;
  badge.className   = `status-badge ${STATUS_BADGE[status] || 'badge-offline'}`;

  setText('detailPhone',   `📞 ${rider.phone_number || '—'}`);
  setText('detailPoint',   `📍 ${rider.starting_point?.name || '—'}`);
  setText('detailCompany', `🏢 شركة ${rider.company_id || '—'}`);
}

function renderOverviewTab(rider) {
  const s = rider.active_shift_started_at;
  const e = rider.active_shift_ended_at;
  setText('shiftStart', formatDateTime(s));
  setText('shiftEnd',   formatDateTime(e));

  const { text, pct } = shiftRemaining(s, e);
  setText('shiftRemain', text);
  const fill = document.getElementById('shiftProgressFill');
  if (fill) fill.style.width = `${pct}%`;

  const v = rider.vehicle;
  setText('vehicleName',  v?.name || '—');
  setText('vehicleSpeed', v?.default_speed || '—');

  const wal = rider.wallet_info;
  setText('walletBalance', wal?.balance !== undefined ? `${wal.balance.toFixed(2)} ر.س` : '—');
  const ws = walletStatus(wal?.limit_status);
  const wsEl = document.getElementById('walletStatus');
  if (wsEl) { wsEl.textContent = ws.text; wsEl.className = `wallet-status ${ws.cls}`; }

  const loc = rider.current_location;
  setText('locLat',     loc?.latitude?.toFixed(6));
  setText('locLng',     loc?.longitude?.toFixed(6));
  setText('locUpdated', formatDateTime(loc?.location_updated_at));

  const link = document.getElementById('mapLink');
  if (link) {
    if (loc?.latitude && loc?.longitude) {
      link.href = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
      link.style.display = 'inline-block';
    } else {
      link.style.display = 'none';
    }
  }
}

function renderDeliveriesTab(rider) {
  const di = rider.deliveries_info || {};
  setText('ds-completed', di.completed_deliveries_count || 0);
  setText('ds-accepted',  di.accepted_deliveries_count  || 0);
  setText('ds-notified',  di.notified_deliveries_count  || 0);
  setText('ds-declined',  di.declined_deliveries_count  || 0);
  setText('ds-stacked',   di.stacked_deliveries_count   || 0);

  const acc = rider.performance?.acceptance_rate;
  setText('ds-acceptance', acc !== undefined ? `${Math.round(acc * 100)}%` : '—');

  const list = document.getElementById('deliveriesList');
  const deliveries = di.latest_deliveries || [];
  if (!deliveries.length) {
    list.innerHTML = '<div class="no-data">لا توجد توصيلات</div>';
    return;
  }

  const STEPS = ['dispatched', 'accepted', 'picked_up', 'near_dropoff', 'completed'];
  list.innerHTML = '';

  deliveries.forEach(d => {
    const tl = d.timeline || [];
    const tlHTML = STEPS.map((step, i) => {
      const ev      = tl.find(t => t.status === step);
      const isDone  = !!ev;
      const dotCls  = isDone ? 'done' : (d.status === step ? 'current' : '');
      const lineCls = isDone ? 'done' : '';
      return `
        <div class="timeline-step">
          <div class="timeline-dot ${dotCls}"></div>
          <div class="tl-label">${DELIVERY_AR[step] || step}</div>
          ${ev ? `<div class="tl-time">${formatTime(ev.timestamp)}</div>` : ''}
        </div>
        ${i < STEPS.length - 1 ? `<div class="timeline-line ${lineCls}"></div>` : ''}`;
    }).join('');

    const stCls = `ds-${d.status || 'dispatched'}`;
    const card  = document.createElement('div');
    card.className = 'delivery-card';
    card.innerHTML = `
      <div class="delivery-card-header">
        <span class="delivery-code">${d.order_code || '—'}</span>
        <span class="delivery-vendor">${d.vendor_name || '—'}</span>
        <span class="delivery-status-badge ${stCls}">${DELIVERY_AR[d.status] || d.status}</span>
      </div>
      <div class="delivery-addresses">
        <div class="addr-box"><div class="addr-label">📦 الاستلام</div><div class="addr-val">${d.pickup_address || '—'}</div></div>
        <div class="addr-box"><div class="addr-label">🏠 التسليم</div><div class="addr-val">${d.dropoff_address || '—'}</div></div>
      </div>
      <div class="delivery-timeline">${tlHTML}</div>`;
    list.appendChild(card);
  });
}

function renderShiftsTab(shifts) {
  const tbody = document.getElementById('shiftsTableBody');
  if (!shifts?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">لا توجد ورديات</td></tr>';
    return;
  }
  const sorted = [...shifts].sort((a, b) => new Date(b.start) - new Date(a.start));
  const now    = new Date();
  tbody.innerHTML = sorted.map(s => {
    const sd = new Date(s.start), ed = new Date(s.end);
    const isActive = sd <= now && ed >= now;
    return `
      <tr class="${isActive ? 'active-shift' : ''}">
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${s.id}</td>
        <td>${formatDateTime(s.start)}</td>
        <td>${formatTime(s.end)}</td>
        <td style="font-family:var(--font-main)">${s.starting_point_name || '—'}</td>
        <td><span class="shift-state-badge state-${s.state}">${SHIFT_STATE_AR[s.state] || s.state}${isActive ? ' 🟢' : ''}</span></td>
        <td>${shiftDuration(s.start, s.end)}</td>
      </tr>`;
  }).join('');
}

function renderPerformanceTab(rider) {
  const perf   = rider.performance     || {};
  const time   = perf.time_spent       || {};
  const circ   = 251.2;

  const util   = Math.min(Math.round((perf.utilization_rate || 0) * 100), 100);
  const utilEl = document.getElementById('utilCircleFill');
  if (utilEl) utilEl.setAttribute('stroke-dashoffset', (circ - circ * util / 100).toFixed(1));
  setText('perfUtilVal', `${util}%`);

  const acc    = Math.round((perf.acceptance_rate || 0) * 100);
  const accEl  = document.getElementById('accCircleFill');
  if (accEl) accEl.setAttribute('stroke-dashoffset', (circ - circ * acc / 100).toFixed(1));
  setText('perfAccVal', `${acc}%`);

  setText('ts-worked', formatSeconds(time.worked_seconds));
  setText('ts-late',   formatSeconds(time.late_seconds));
  setText('ts-break',  formatSeconds(time.break_seconds));
  setText('ts-breaks', time.number_of_breaks || '0');
}

// ── TAB SWITCHING ──────────────────────────────────────

function switchTab(name) {
  document.querySelectorAll('.detail-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === name)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${name}`)
  );
}

// ── AUTO REFRESH ───────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    loadRiders(true);
    loadCompanyStats(true);
    if (selectedRiderId) {
      fetchRiderDetails(selectedRiderId).then(rider => {
        renderRiderHeader(rider);
        renderOverviewTab(rider);
        renderDeliveriesTab(rider);
        renderPerformanceTab(rider);
      }).catch(() => {});
    }
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

// ── INIT ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Load everything on start
  loadRiders();
  loadCompanyStats();

  // Refresh button
  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadRiders();
    loadCompanyStats();
    if (selectedRiderId) selectRider(selectedRiderId);
  });

  // Auto-refresh toggle
  const toggle = document.getElementById('autoRefreshToggle');
  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      startAutoRefresh();
      toast('تحديث تلقائي كل 30 ثانية', 'info');
    } else {
      stopAutoRefresh();
      toast('تم إيقاف التحديث التلقائي', 'info');
    }
  });
  if (toggle.checked) startAutoRefresh();

  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.style.display = searchQuery ? 'block' : 'none';
    applyFiltersAndSort();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    applyFiltersAndSort();
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      applyFiltersAndSort();
    });
  });

  // Sort select
  document.getElementById('sortSelect').addEventListener('change', e => {
    sortBy = e.target.value;
    applyFiltersAndSort();
  });

  // Detail tabs
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Close detail → show company stats again
  document.getElementById('closeDetail').addEventListener('click', () => {
    selectedRiderId = null;
    document.getElementById('riderDetail').style.display = 'none';
    document.getElementById('emptyState').style.display  = 'flex';
    document.querySelectorAll('.rider-card').forEach(c => c.classList.remove('selected'));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); loadRiders(); loadCompanyStats(); }
    if (e.key === 'Escape') document.getElementById('closeDetail').click();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
});
