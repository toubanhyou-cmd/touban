// 画面全体の制御
import { load, save, clearSaved, defaultState, backupFileName, readJSONFile } from './storage.js';
import { generate, validate, countUp, periodMonths, activeMembers, unavailableReason, ngSet, prevWorkDay } from './scheduler.js';
import { renderMonth, renderList, renderCounts, renderDay, renderLegend } from './calendar.js';
import { settingsHtml, bindSettings } from './settings.js';
import { toCSV, download } from './export.js';
import { esc, ymLabel, parse, WD, fmt } from './utils.js';

let state = load();
let currentTab = 'settings';
let viewYm = null;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// スマホでの表示方法（リスト／カレンダー）。端末ごとに覚えておく
const mobileMQ = matchMedia('(max-width: 640px)');
const VIEW_KEY = 'touban-mobile-view';
let mobileView = 'list';
try { mobileView = localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list'; } catch (e) { /* 無視 */ }
const gridOnMobile = () => mobileMQ.matches && mobileView === 'calendar';

// ---------- 保存と再描画 ----------
function commit({ structural = false, affects = true } = {}) {
  if (affects && state.schedule) state.stale = true;
  if (!save(state)) toast('ブラウザに保存できませんでした。JSONで書き出してください。');
  if (structural) renderSettings();
  renderBanner();
}

function renderSettings() {
  const root = $('#settings-root');
  const y = window.scrollY;
  root.innerHTML = settingsHtml(state);
  window.scrollTo(0, y);
}

function renderBanner() {
  $('#stale-banner').hidden = !(state.schedule && state.stale);
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3500);
}

// ---------- タブ ----------
function showTab(name) {
  currentTab = name;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab-panel').forEach((p) => (p.hidden = p.id !== 'tab-' + name));
  if (name === 'calendar' || name === 'list') renderView();
  if (name === 'output') renderOutput();
  window.scrollTo(0, 0);
  // スマホのリスト表示では今日の当番まで自動でスクロール
  if (name === 'calendar' && mobileMQ.matches && mobileView === 'list') {
    document.querySelector('#cal .today')?.scrollIntoView({ block: 'start' });
  }
}

function ensureViewYm() {
  const months = periodMonths(state);
  if (!viewYm || !months.includes(viewYm)) {
    const now = fmt(new Date()).slice(0, 7);
    viewYm = months.includes(now) ? now : months[0];
  }
  return months;
}

function renderView() {
  const months = ensureViewYm();
  $$('.month-label').forEach((el) => (el.textContent = ymLabel(viewYm)));
  $$('[data-nav="-1"]').forEach((b) => (b.disabled = viewYm === months[0]));
  $$('[data-nav="1"]').forEach((b) => (b.disabled = viewYm === months[11]));
  $('#btn-generate').textContent = state.schedule ? '作り直す（別の組み合わせ）' : '1年分を生成する';

  if (!state.schedule) {
    const msg = '<p class="empty-msg">まだ当番表がありません。「① 設定」で名前と係を入れて「1年分を生成する」を押してください。</p>';
    $('#cal').innerHTML = msg;
    $('#cal').classList.remove('grid-mode');
    $('#legend').innerHTML = '';
    $('#counts').innerHTML = '';
    $('#issues').innerHTML = '';
    $('#list').innerHTML = msg;
    return;
  }
  const issues = validate(state, state.schedule);
  if (currentTab === 'calendar') {
    const grid = gridOnMobile();
    $('#cal').classList.toggle('grid-mode', grid);
    $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === mobileView)));
    // スマホのカレンダー表示では名前が小さいので、日付をタップして詳細から変更する
    $('#cal').innerHTML = renderMonth(state, viewYm, issues, { editable: !grid });
    $('#legend').innerHTML = grid ? renderLegend(state) : '';
    $('#counts').innerHTML = renderCounts(state, viewYm, countUp(state, state.schedule));
    $('#issues').innerHTML = issuesHtml(issues);
  } else {
    $('#list').innerHTML = renderList(state, viewYm, issues);
  }
}

function issuesHtml(issues) {
  if (!issues.size) return '<p class="ok-msg">ルール違反はありません。</p>';
  const roleName = new Map(state.roles.map((r) => [r.id, r.name]));
  const all = [...issues.entries()].sort(([a], [b]) => a.localeCompare(b));
  const inMonth = all.filter(([k]) => k.startsWith(viewYm));
  const items = inMonth.slice(0, 15).map(([key, msgs]) => {
    const [k, rid] = key.split('|');
    const d = parse(k);
    return `<li>${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）${esc(roleName.get(rid))}：${esc(msgs.join('／'))}</li>`;
  });
  return `<div class="warn-box"><strong>注意が ${all.length}件 あります</strong>（この月：${inMonth.length}件）。赤い名前をクリックすると変更できます。
    ${items.length ? `<ul>${items.join('')}${inMonth.length > 15 ? '<li>…</li>' : ''}</ul>` : ''}
    <p class="hint">未割り当てが多いときは、人数を増やす・不可日やペアの条件をゆるめる・「同じ日に複数の係を兼ねてもよい」をオンにする、を試してください。</p></div>`;
}

// ---------- 生成 ----------
function runGenerate() {
  const members = activeMembers(state);
  if (!members.length) return alert('メンバーを入力してください');
  if (!state.roles.length || state.roles.some((r) => !r.name.trim())) return alert('係の名前を入力してください');
  if (state.schedule && !confirm('今の当番表を作り直します。手動で入れ替えた内容は消えます。よろしいですか？')) return;
  state.seed = Math.floor(Math.random() * 2 ** 31);
  state.schedule = generate(state, state.seed);
  state.generatedAt = new Date().toISOString();
  state.stale = false;
  save(state);
  renderBanner();
  showTab('calendar');
  toast('1年分の当番表を作りました');
}

// ---------- 手動入れ替え ----------
let editing = null;

function openSlotDialog(k, rid, idx) {
  const role = state.roles.find((r) => r.id === rid);
  const day = state.schedule[k];
  const slot = day[rid] || [];
  const current = slot[idx];
  const w = parse(k).getDay();
  const ng = ngSet(state);
  const prevK = prevWorkDay(state.schedule, k);
  const prevIds = new Set(prevK ? Object.values(state.schedule[prevK]).flat() : []);
  const othersToday = new Set(state.roles.filter((r) => r.id !== rid).flatMap((r) => day[r.id] || []));

  editing = { k, rid, idx };
  const d = parse(k);
  $('#dlg-title').textContent = `${d.getMonth() + 1}/${d.getDate()}（${WD[w]}） ${role.name} の担当者`;
  $('#dlg-list').innerHTML =
    activeMembers(state)
      .map((m) => {
        const why = [];
        const u = unavailableReason(m, rid, k, w);
        if (u) why.push(u);
        if (slot.some((x, i) => i !== idx && x === m.id)) why.push('同じ係に入っている');
        if (!state.allowMultiRole && othersToday.has(m.id)) why.push('別の係を担当');
        if (slot.some((x, i) => i !== idx && x && ng.has(x + '|' + m.id))) why.push('組ませないペア');
        if (state.avoidConsecutive && prevIds.has(m.id)) why.push('前の当番日と連続');
        return `<button type="button" class="pick${m.id === current ? ' current' : ''}${why.length ? ' ng' : ''}" data-pick="${m.id}">
          <span>${esc(m.name)}</span>${why.length ? `<small>${esc(why.join('・'))}</small>` : ''}</button>`;
      })
      .join('') + `<button type="button" class="pick" data-pick="">（空欄にする）</button>`;
  $('#slot-dialog').showModal();
}

function pickMember(id) {
  const { k, rid, idx } = editing;
  const role = state.roles.find((r) => r.id === rid);
  const slot = state.schedule[k][rid] || Array(role.count).fill(null);
  slot[idx] = id || null;
  state.schedule[k][rid] = slot;
  save(state);
  $('#slot-dialog').close();
  renderView();
  if ($('#day-dialog').open) refreshDayDialog();
}

// ---------- スマホのカレンダーで日付をタップしたとき ----------
let dayKey = null;

function openDayDialog(k) {
  dayKey = k;
  const d = parse(k);
  $('#day-title').textContent = `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）の当番`;
  refreshDayDialog();
  $('#day-dialog').showModal();
}

function refreshDayDialog() {
  $('#day-body').innerHTML = renderDay(state, dayKey, validate(state, state.schedule));
}

// ---------- 出力 ----------
function renderOutput() {
  const has = !!state.schedule;
  $$('[data-need-schedule]').forEach((b) => (b.disabled = !has));
  $('#saved-info').textContent = state.generatedAt
    ? `当番表の作成日時：${new Date(state.generatedAt).toLocaleString('ja-JP')}`
    : 'まだ当番表は作成されていません';
}

function printMonths(months) {
  const issues = new Map(); // 印刷では警告色を出さない
  $('#print-area').innerHTML = months
    .map((ym) => `<div class="print-page"><h2>${ymLabel(ym)} 当番表</h2>${renderMonth(state, ym, issues, { editable: false })}</div>`)
    .join('');
  window.print();
}

// ---------- イベント ----------
function init() {
  renderSettings();
  renderBanner();
  bindSettings($('#settings-root'), {
    get state() { return state; },
    commit,
    generate: runGenerate,
  });

  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#banner-go').addEventListener('click', runGenerate);
  $('#btn-generate').addEventListener('click', runGenerate);

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const months = periodMonths(state);
      viewYm = months[months.indexOf(viewYm) + Number(nav.dataset.nav)] || viewYm;
      return renderView();
    }
    const nm = e.target.closest('button.nm[data-date]');
    if (nm) return openSlotDialog(nm.dataset.date, nm.dataset.role, Number(nm.dataset.idx));
    const pick = e.target.closest('[data-pick]');
    if (pick) return pickMember(pick.dataset.pick);
    const view = e.target.closest('[data-view]');
    if (view) {
      mobileView = view.dataset.view;
      try { localStorage.setItem(VIEW_KEY, mobileView); } catch (err) { /* 無視 */ }
      return renderView();
    }
    const cell = e.target.closest('#cal.grid-mode [data-day]');
    if (cell) return openDayDialog(cell.dataset.day);
  });

  // 画面の幅がスマホ⇔PCで切り替わったら描き直す
  mobileMQ.addEventListener('change', () => {
    if (currentTab === 'calendar') renderView();
  });

  $('#btn-print-month').addEventListener('click', () => { ensureViewYm(); printMonths([viewYm]); });
  $('#btn-print-all').addEventListener('click', () => printMonths(periodMonths(state)));
  $('#btn-csv').addEventListener('click', () => {
    download(`touban-${state.startYear}-${String(state.startMonth).padStart(2, '0')}.csv`, toCSV(state), 'text/csv', true);
  });
  $('#btn-json-out').addEventListener('click', () => {
    download(backupFileName(), JSON.stringify(state, null, 2), 'application/json');
  });
  $('#json-in').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const next = await readJSONFile(file);
      if (!confirm('今の内容を、読み込んだファイルの内容で置き換えます。よろしいですか？')) return;
      state = next;
      save(state);
      viewYm = null;
      renderSettings();
      renderBanner();
      renderOutput();
      toast('読み込みました');
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('名前・設定・当番表をすべて消します。元に戻せません。よろしいですか？')) return;
    clearSaved();
    state = defaultState();
    viewYm = null;
    renderSettings();
    renderBanner();
    showTab('settings');
  });
}

init();
