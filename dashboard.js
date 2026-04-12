'use strict';

/* ═══════════════════════════════════════════════════════
   RIDER LIVE OPS v3.1 — DASHBOARD JS
   Changes:
   - Map: static Leaflet load (no dynamic injection), invalidateSize fix
   - New filter: no-orders (working/starting riders without active delivery)
   - All stats derived from riders endpoint only
   - Wallet hard-limit threshold = 500 SAR
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
let currentPage    = 'dashboard'; // 'dashboard' | 'wallet' | 'map'
let mapMarkers     = [];
let leafletMap     = null;

// ── LABEL MAPS ─────────────────────────────────────────
const STATUS_LABEL = {
  Working:  'يعمل',
  starting: 'بداية',
  break:    'استراحة',
  offline:  'غير متصل',
  late:     'متأخر',
};
const STATUS_BADGE = {
  Working:  'badge-working',
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
  Motorbike:  '🏍',
  Motor_Bike: '🏍',
  Bicycle:    '🚲',
  Car:        '🚗',
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

function hasActiveOrder(rider) {
  return !!(rider.deliveries_info?.has_active_deliveries);
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

// ── WALLET STATUS — threshold: 500 SAR = hard, 300 SAR = soft ──
// Uses balance value directly; ignores API limit_status field so
// the threshold is controlled here, not by server config.
function walletStatus(status, balance) {
  if (balance !== undefined && balance !== null) {
    if (balance >= 500) return { text: 'تجاوز الحد الصعب', cls: 'wallet-over-hard' };
    if (balance >= 300) return { text: 'تجاوز الحد اللين',  cls: 'wallet-over-soft' };
    return               { text: 'طبيعي',                  cls: 'wallet-ok'        };
  }
  // Fallback to API status string when balance is unavailable
  const map = {
    balance_over_hard_limit: { text: 'تجاوز الحد الصعب', cls: 'wallet-over-hard' },
    balance_over_soft_limit: { text: 'تجاوز الحد اللين',  cls: 'wallet-over-soft' },
    ok:                      { text: 'طبيعي',             cls: 'wallet-ok'        },
  };
  return map[status] || { text: status || '—', cls: '' };
}

function toast(msg, type = 'info', ms = 3000) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, ms);
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

async function fetchRiders() {
  // size=200 to capture larger fleets without pagination
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

// ── STATS FROM RIDERS (single source of truth) ─────────

function computeStatsFromRiders(riders) {
  const stats = {
    working: 0, starting: 0, break: 0, late: 0, offline: 0,
    withOrders: 0, withoutOrders: 0, total: riders.length,
    // wallet thresholds: 500 = hard, 300 = soft
    walletOverHard: 0, walletOverSoft: 0, walletOk: 0,
    totalCompleted: 0,
    byPoint: {},
    vehicles: {},
    utilTotal: 0, utilCount: 0,
    ordersAccepted: 0, ordersDeclined: 0,
  };

  riders.forEach(r => {
    const st = effectiveStatus(r);
    if (stats[st] !== undefined) stats[st]++;
    const hasOrd = hasActiveOrder(r);
    if (hasOrd) {
      stats.withOrders++;
    } else if (['working', 'starting'].includes(st)) {
      stats.withoutOrders++;
    }

    // Wallet using balance-based thresholds (500 hard / 300 soft)
    const bal = r.wallet_info?.balance;
    if (bal !== undefined && bal !== null) {
      if (bal >= 500)                stats.walletOverHard++;
      else if (bal >= 300)           stats.walletOverSoft++;
      else                           stats.walletOk++;
    }

    stats.totalCompleted += r.deliveries_info?.completed_deliveries_count || 0;
    stats.ordersAccepted += r.deliveries_info?.accepted_deliveries_count  || 0;

    // Group by starting point
    const ptName = r.starting_point?.name || 'غير محدد';
    if (!stats.byPoint[ptName]) {
      stats.byPoint[ptName] = { working: 0, starting: 0, break: 0, late: 0, total: 0, withOrders: 0, withoutOrders: 0 };
    }
    const pg = stats.byPoint[ptName];
    pg.total++;
    if (pg[st] !== undefined) pg[st]++;
    if (hasOrd) pg.withOrders++;
    else if (['working', 'starting'].includes(st)) pg.withoutOrders++;

    // Vehicles
    const vIcon = r.vehicle?.icon || 'Unknown';
    stats.vehicles[vIcon] = (stats.vehicles[vIcon] || 0) + 1;

    // Utilization
    const util = r.performance?.utilization_rate;
    if (util !== undefined && util !== null) {
      stats.utilTotal += util;
      stats.utilCount++;
    }
  });

  stats.avgUtil = stats.utilCount > 0
    ? Math.round((stats.utilTotal / stats.utilCount) * 100)
    : 0;

  return stats;
}

// ── COMPANY STATS RENDER ───────────────────────────────

function renderCompanyStats(stats) {
  setText('cp-checkedIn',      stats.working + stats.starting);
  setText('cp-checkedInLate',  stats.late);
  setText('cp-notCheckedIn',   stats.offline);
  setText('cp-onBreak',        stats.break);
  setText('cp-ordersAccepted', stats.ordersAccepted);
  setText('cp-ordersDeclined', stats.ordersDeclined || 0);
  setText('cp-utilRate',       `${stats.avgUtil}%`);

  const bar = document.getElementById('cp-utilBar');
  if (bar) bar.style.width = `${Math.min(stats.avgUtil, 100)}%`;

  // Late banner
  const banner = document.getElementById('cpLateBanner');
  if (banner) {
    banner.style.display = stats.late > 0 ? 'flex' : 'none';
    setText('cp-lateWorkers', stats.late);
    setText('cp-reassignments', 0);
  }

  // Vehicles
  const vRow = document.getElementById('cp-vehicles');
  if (vRow) {
    const entries = Object.entries(stats.vehicles);
    if (entries.length) {
      vRow.innerHTML = entries.map(([icon, count]) => {
        const emoji = VEHICLE_ICONS[icon] || '🛵';
        return `
          <div class="cp-vehicle-chip">
            <span class="cp-vehicle-chip-icon">${emoji}</span>
            <div><div class="cp-vehicle-chip-name">${icon}</div></div>
            <span class="cp-vehicle-chip-count">${count}</span>
          </div>`;
      }).join('');
    } else {
      vRow.innerHTML = '<span class="cp-loading-text">لا توجد بيانات</span>';
    }
  }

  setText('cp-withOrders', stats.withOrders);

  // Company table
  const tbody = document.getElementById('cp-statsBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td>${COMPANY}</td>
        <td style="color:var(--green)">${stats.working + stats.starting}</td>
        <td style="color:var(--amber)">${stats.totalCompleted}</td>
        <td style="color:var(--blue)">${stats.avgUtil}%</td>
      </tr>`;
  }

  const spinner = document.getElementById('cpLoadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

// ── RIDER LIST RENDER ──────────────────────────────────

function buildRiderCard(rider) {
  const status   = effectiveStatus(rider);
  const late     = status === 'late';
  const hasOrder = hasActiveOrder(rider);
  const avCls    = avatarClass(rider.name);
  const delivs   = rider.deliveries_info?.completed_deliveries_count || 0;
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
      <span class="deliveries-mini">${hasOrder ? '🟢 طلب' : '⚪'} ${delivs}</span>
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
  const stats = computeStatsFromRiders(riders);
  setText('stat-working',    stats.working);
  setText('stat-starting',   stats.starting);
  setText('stat-break',      stats.break);
  setText('stat-late',       stats.late);
  setText('stat-orders',     stats.withOrders);
  setText('stat-total',      stats.total);
  return stats;
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

  switch (currentFilter) {
    case 'orders':
      list = list.filter(r => hasActiveOrder(r));
      break;
    case 'no-orders':
      // Active riders with NO current delivery
      list = list.filter(r =>
        ['working', 'starting'].includes(effectiveStatus(r)) && !hasActiveOrder(r)
      );
      break;
    case 'all':
      break;
    default:
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

  // Always bubble late riders to the top in 'all' view
  if (currentFilter === 'all') {
    list.sort((a, b) =>
      (effectiveStatus(b) === 'late' ? 1 : 0) - (effectiveStatus(a) === 'late' ? 1 : 0)
    );
  }

  filteredRiders = list;
  renderRiderList();
}

// ── LOAD RIDERS ────────────────────────────────────────

async function loadRiders(silent = false) {
  if (isLoading) return;
  isLoading = true;

  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('spinning');

  if (!silent) {
    document.getElementById('riderList').innerHTML = `
      <div class="loading-state"><div class="spinner"></div><p>جاري تحميل السائقين...</p></div>`;
  }

  try {
    allRiders = await fetchRiders();
    const stats = updateHeaderStats(allRiders);
    applyFiltersAndSort();
    renderCompanyStats(stats);
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
    if (btn) btn.classList.remove('spinning');
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
  const bal = wal?.balance;
  setText('walletBalance', bal !== undefined ? `${bal.toFixed(2)} ر.س` : '—');

  // Use balance-based threshold
  const ws = walletStatus(wal?.limit_status, bal);
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

// ── GROUP BY STARTING POINT ────────────────────────────

function renderGroupByPoint() {
  const container = document.getElementById('groupByPointContent');
  if (!container) return;

  const stats   = computeStatsFromRiders(allRiders);
  const entries = Object.entries(stats.byPoint).sort((a, b) => b[1].total - a[1].total);

  if (!entries.length) {
    container.innerHTML = '<div class="no-data">لا توجد بيانات</div>';
    return;
  }

  container.innerHTML = entries.map(([ptName, data]) => `
    <div class="point-group-card">
      <div class="point-group-header">
        <span class="point-group-icon">📍</span>
        <span class="point-group-name">${ptName}</span>
        <span class="point-group-total">${data.total} سائق</span>
      </div>
      <div class="point-group-stats">
        <div class="pg-stat pg-working"><span>${data.working}</span><small>يعمل</small></div>
        <div class="pg-stat pg-starting"><span>${data.starting}</span><small>بداية</small></div>
        <div class="pg-stat pg-break"><span>${data.break}</span><small>استراحة</small></div>
        <div class="pg-stat pg-late"><span>${data.late}</span><small>متأخر</small></div>
        <div class="pg-stat pg-orders"><span>${data.withOrders}</span><small>لديه طلب</small></div>
      </div>
      <div class="point-group-riders">
        ${allRiders
          .filter(r => (r.starting_point?.name || 'غير محدد') === ptName)
          .map(r => {
            const st     = effectiveStatus(r);
            const hasOrd = hasActiveOrder(r);
            return `<span class="pg-rider-chip ${st === 'late' ? 'chip-late' : ''}" title="${cleanName(r.name)}">
              ${hasOrd ? '🟢' : '⚪'} ${cleanName(r.name).split(' ')[0]}
            </span>`;
          }).join('')}
      </div>
    </div>
  `).join('');
}

// ── WALLET REPORT PAGE ─────────────────────────────────

function showWalletPage() {
  currentPage = 'wallet';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('walletPage').style.display    = 'flex';
  document.getElementById('mapPage').style.display       = 'none';
  renderWalletReport();
  updateNavButtons();
}

function showDashboardPage() {
  currentPage = 'dashboard';
  document.getElementById('dashboardPage').style.display = 'flex';
  document.getElementById('walletPage').style.display    = 'none';
  document.getElementById('mapPage').style.display       = 'none';
  updateNavButtons();
}

function showMapPage() {
  currentPage = 'map';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('walletPage').style.display    = 'none';
  document.getElementById('mapPage').style.display       = 'flex';
  updateNavButtons();
  // Double rAF ensures the DOM has painted and the container has its real height
  requestAnimationFrame(() => requestAnimationFrame(() => initMap()));
}

function updateNavButtons() {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === currentPage);
  });
}

function renderWalletReport() {
  const tbody = document.getElementById('walletTableBody');
  if (!tbody) return;

  const riders = [...allRiders].sort((a, b) => {
    const ba = a.wallet_info?.balance || 0;
    const bb = b.wallet_info?.balance || 0;
    return bb - ba;
  });

  if (!riders.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">لا توجد بيانات</td></tr>';
    return;
  }

  tbody.innerHTML = riders.map((r, i) => {
    const wal = r.wallet_info || {};
    const bal = wal.balance;
    const ws  = walletStatus(wal.limit_status, bal);

    // Row highlighting based on balance thresholds (500 hard / 300 soft)
    const statusClass = (bal >= 500) ? 'wallet-row-danger'
                      : (bal >= 300) ? 'wallet-row-warn'
                      : '';
    const balColor    = (bal >= 500) ? 'var(--red)'
                      : (bal >= 300) ? 'var(--orange)'
                      : 'var(--green)';

    return `
      <tr class="${statusClass}">
        <td>${i + 1}</td>
        <td style="font-family:var(--font-main);font-weight:600">${cleanName(r.name)}</td>
        <td style="font-family:var(--font-mono);color:var(--text-muted)">${r.phone_number || '—'}</td>
        <td style="font-family:var(--font-main);color:var(--text-secondary)">${r.starting_point?.name || '—'}</td>
        <td style="font-family:var(--font-mono);font-weight:700;color:${balColor}">${bal !== undefined ? bal.toFixed(2) : '—'} ر.س</td>
        <td><span class="wallet-status ${ws.cls}">${ws.text}</span></td>
        <td style="font-family:var(--font-mono)">${r.employee_id}</td>
      </tr>`;
  }).join('');

  // Summary counts using balance thresholds (500 / 300)
  const overHard = riders.filter(r => (r.wallet_info?.balance || 0) >= 500).length;
  const overSoft = riders.filter(r => {
    const b = r.wallet_info?.balance || 0;
    return b >= 300 && b < 500;
  }).length;
  const ok = riders.filter(r => (r.wallet_info?.balance || 0) < 300).length;

  setText('wallet-summary-hard', overHard);
  setText('wallet-summary-soft', overSoft);
  setText('wallet-summary-ok',   ok);
  setText('wallet-total-riders', riders.length);
}

// ── EXCEL DOWNLOAD ─────────────────────────────────────

function downloadWalletExcel() {
  if (!allRiders.length) { toast('لا توجد بيانات للتصدير', 'error'); return; }

  const BOM     = '\uFEFF';
  const headers = ['#', 'الاسم', 'الهاتف', 'نقطة الانطلاق', 'الرصيد (ر.س)', 'حالة المحفظة', 'معرف الموظف', 'الحالة'];
  const rows    = allRiders.map((r, i) => {
    const wal = r.wallet_info || {};
    const bal = wal.balance;
    const ws  = walletStatus(wal.limit_status, bal);
    return [
      i + 1,
      cleanName(r.name),
      r.phone_number || '',
      r.starting_point?.name || '',
      bal !== undefined ? bal.toFixed(2) : '',
      ws.text,
      r.employee_id,
      STATUS_LABEL[effectiveStatus(r)] || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv  = BOM + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `wallet-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('تم تصدير تقرير المحفظة بنجاح', 'success');
}

// ── MAP PAGE ───────────────────────────────────────────
// Leaflet is loaded statically in the HTML <head>.
// buildMap() calls invalidateSize() to handle cases where the container
// was hidden (display:none) during initialization.

function initMap() {
  const mapEl = document.getElementById('liveMap');
  if (!mapEl) return;

  if (typeof L === 'undefined') {
    mapEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100%;color:var(--text-muted);gap:10px;font-size:13px;padding:40px">
        <div style="font-size:32px">🗺</div>
        <div>تعذر تحميل مكتبة الخرائط</div>
        <div style="font-size:11px;color:var(--text-muted)">تأكد من اتصال الإنترنت ثم أعد تحميل الصفحة</div>
      </div>`;
    return;
  }

  buildMap(mapEl);
}

function buildMap(mapEl) {
  // Remove previous instance if exists
  if (leafletMap) {
    try { leafletMap.remove(); } catch (_) {}
    leafletMap = null;
  }

  leafletMap = L.map(mapEl, { zoomControl: true }).setView([21.3891, 39.8579], 11);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains:  'abcd',
    maxZoom:     19,
  }).addTo(leafletMap);

  // Force Leaflet to recalculate container size (fixes display:none init issue)
  setTimeout(() => leafletMap && leafletMap.invalidateSize(), 150);

  mapMarkers.forEach(m => { try { m.remove(); } catch (_) {} });
  mapMarkers = [];

  const activeRiders = allRiders.filter(r =>
    r.current_location?.latitude &&
    r.current_location?.longitude &&
    ['working', 'starting', 'late'].includes(effectiveStatus(r))
  );

  setText('map-rider-count',    activeRiders.length);
  const withOrders    = activeRiders.filter(r => hasActiveOrder(r)).length;
  const withoutOrders = activeRiders.length - withOrders;
  setText('map-with-orders',    withOrders);
  setText('map-without-orders', withoutOrders);

  activeRiders.forEach(rider => {
    const loc     = rider.current_location;
    const hasOrd  = hasActiveOrder(rider);
    const isLateR = effectiveStatus(rider) === 'late';
    const color   = isLateR ? '#ef4444' : (hasOrd ? '#22c55e' : '#f59e0b');

    const icon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${color};
        border:3px solid rgba(255,255,255,0.8);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;font-weight:900;color:#000;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;
      ">${hasOrd ? '📦' : '🛵'}</div>`,
      className:  '',
      iconSize:   [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([loc.latitude, loc.longitude], { icon })
      .addTo(leafletMap)
      .bindPopup(`
        <div dir="rtl" style="font-family:Cairo,sans-serif;min-width:200px">
          <strong style="font-size:14px">${cleanName(rider.name)}</strong><br>
          <span style="color:#94a3b8;font-size:12px">${rider.starting_point?.name || '—'}</span><br>
          <span style="color:${color};font-weight:700">${hasOrd ? '🟢 لديه طلب نشط' : '⚪ لا يوجد طلب'}</span><br>
          <span style="font-size:11px;color:#64748b">
            ${rider.deliveries_info?.completed_deliveries_count || 0} توصيلة مكتملة
          </span>
        </div>
      `);
    mapMarkers.push(marker);
  });

  if (mapMarkers.length > 0) {
    const group = L.featureGroup(mapMarkers);
    leafletMap.fitBounds(group.getBounds().pad(0.1));
  }
}

// ── AUTO REFRESH ───────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    loadRiders(true);
    if (currentPage === 'map' && leafletMap) {
      buildMap(document.getElementById('liveMap'));
    }
    if (currentPage === 'wallet') {
      renderWalletReport();
    }
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

  loadRiders();

  // Refresh button
  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadRiders();
    if (currentPage === 'map') buildMap(document.getElementById('liveMap'));
    if (currentPage === 'wallet') renderWalletReport();
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
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
      if (tab.dataset.tab === 'groupbypoint') renderGroupByPoint();
    });
  });

  // Close detail
  document.getElementById('closeDetail').addEventListener('click', () => {
    selectedRiderId = null;
    document.getElementById('riderDetail').style.display = 'none';
    document.getElementById('emptyState').style.display  = 'flex';
    document.querySelectorAll('.rider-card').forEach(c => c.classList.remove('selected'));
  });

  // Nav buttons
  document.getElementById('navDashboard').addEventListener('click', showDashboardPage);
  document.getElementById('navWallet').addEventListener('click', showWalletPage);
  document.getElementById('navMap').addEventListener('click', showMapPage);

  // Wallet export
  document.getElementById('btnExportWallet')?.addEventListener('click', downloadWalletExcel);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); loadRiders(); }
    if (e.key === 'Escape') document.getElementById('closeDetail').click();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
});
