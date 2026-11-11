// ① 設定タブ
// 「メンバー／係・期間／固定／休み・ルール」の4つに分け、メンバーの編集は下から出るシートで行う
import { WD, esc, uid, fmt } from './utils.js?v=20261112c';
import { periodMonths } from './scheduler.js?v=20261112c';

const SAMPLE = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田'];
const SUBTABS = [
  ['members', 'メンバー'],
  ['roles', '係・期間'],
  ['fixed', '固定'],
  ['rules', '休み・ルール'],
];
const EDIT_TABS = [
  ['basic', '基本'],
  ['off', '入れない日'],
  ['fixed', '固定'],
];

// 画面の状態（保存はしない）
const ui = { tab: 'members', editId: null, editTab: 'basic', filter: '' };
let refs = null; // { root, dialog, ctx }

// ---------- 小さな部品 ----------
const yearOptions = (sel) => {
  const now = new Date().getFullYear();
  let h = '';
  for (let y = now - 1; y <= now + 3; y++) h += `<option value="${y}"${y === sel ? ' selected' : ''}>${y}年</option>`;
  return h;
};
const monthOptions = (sel) =>
  Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>${i + 1}月</option>`).join('');
const check = (attrs, checked, label) =>
  `<label class="chk"><input type="checkbox" ${attrs}${checked ? ' checked' : ''}> ${label}</label>`;
const dateLabel = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return `${y}/${m}/${d}`;
};
const ymShort = (ym) => {
  const [y, mo] = ym.split('-').map(Number);
  return `${y}年${mo}月`;
};
const roleNameOf = (state, id) => state.roles.find((r) => r.id === id)?.name || '(削除された係)';
const newMember = (name = '') => ({ id: uid('m_'), name, noRoles: [], offWeekdays: [], offDates: [], fixed: [], fixedOnly: false });

// 固定ルールの表示名（例：2027年4月だけ・毎週月曜・ゴミ出し係）
function fixedLabel(state, f) {
  const when = f.wd === -1 ? '毎日' : `毎週${WD[f.wd]}曜`;
  return `${f.ym ? ymShort(f.ym) + 'だけ・' : ''}${when}・${roleNameOf(state, f.roleId)}`;
}
const sortFixed = (arr) => arr.sort((a, b) => (a.ym || '').localeCompare(b.ym || '') || a.wd - b.wd);

const ymOptionsHtml = (state) =>
  `<option value="">期間中ずっと</option>` + periodMonths(state).map((ym) => `<option value="${ym}">${ymShort(ym)}だけ</option>`).join('');
const wdOptionsHtml = () => `<option value="-1">毎日</option>` + WD.map((w, i) => `<option value="${i}">${w}曜</option>`).join('');
const roleOptionsHtml = (state) => state.roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');

const card = (title, hint, body, extraHead = '') => `
  <section class="card">
    <div class="card-head"><h2>${title}</h2>${extraHead}</div>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    ${body}
  </section>`;

// ---------- メンバー ----------
function memberRow(state, m) {
  const can = state.roles.filter((r) => !m.noRoles.includes(r.id));
  const roles = m.noRoles.length === 0 ? '全部の係' : can.length ? can.map((r) => r.name).join('・') : '担当なし';
  const offCount = m.offWeekdays.length + m.offDates.length;
  const badges = [
    offCount ? `<span class="badge off">休み ${offCount}</span>` : '',
    m.fixed.length ? `<span class="badge fx">固定 ${m.fixed.length}${m.fixedOnly ? '（のみ）' : ''}</span>` : '',
  ].join('');
  return `
    <button type="button" class="member-row" data-action="edit-member" data-m="${m.id}">
      <span class="mr-name${m.name.trim() ? '' : ' empty'}">${esc(m.name.trim() || '（名前なし）')}</span>
      <span class="mr-roles">${esc(roles)}</span>
      <span class="mr-badges">${badges}</span>
      <span class="mr-go" aria-hidden="true">›</span>
    </button>`;
}

function memberListHtml(state) {
  const f = ui.filter.trim();
  const list = state.members.filter((m) => !f || m.name.includes(f));
  if (!state.members.length) return '<p class="empty-msg">まだメンバーがいません。上の欄から追加してください。</p>';
  if (!list.length) return '<p class="hint">該当する人がいません。</p>';
  return list.map((m) => memberRow(state, m)).join('');
}

function membersPanel(state) {
  const n = state.members.filter((m) => m.name.trim()).length;
  const empty = !state.members.length;
  const bulk = `
    <details class="bulk-box"${empty ? ' open' : ''}>
      <summary>まとめて追加（名前を貼り付け）</summary>
      <textarea id="bulk-names" rows="4" placeholder="1行に1人ずつ。読点（、）やカンマ区切りでも追加できます"></textarea>
      <div class="row">
        <button type="button" data-action="bulk-add">まとめて追加</button>
        ${empty ? '<button type="button" data-action="sample">サンプル（12人）を入れる</button>' : ''}
      </div>
    </details>`;
  const filter =
    state.members.length >= 8
      ? `<input type="search" id="member-filter" class="filter" placeholder="名前で絞り込み" value="${esc(ui.filter)}" aria-label="名前で絞り込み">`
      : '';
  return card(
    `メンバー（${n}人）`,
    '名前をタップすると、担当できる係・入れない日・固定を設定できます。',
    `${bulk}${filter}<div id="member-list" class="member-list">${memberListHtml(state)}</div>`,
    '<button type="button" class="btn-primary small" data-action="add-member">＋ 追加</button>'
  );
}

// メンバー編集シートの中身
function memberDialogHtml(state, m) {
  const offN = m.offWeekdays.length + m.offDates.length;
  const tabs = EDIT_TABS.map(
    ([id, label]) =>
      `<button type="button" role="tab" data-action="edit-tab" data-tab="${id}" aria-selected="${ui.editTab === id}">${label}${
        id === 'off' && offN ? ` <span class="cnt">${offN}</span>` : ''
      }${id === 'fixed' && m.fixed.length ? ` <span class="cnt">${m.fixed.length}</span>` : ''}</button>`
  ).join('');

  let panel = '';
  if (ui.editTab === 'basic') {
    panel = `
      <label class="field"><span>名前</span>
        <input type="text" class="name-input" value="${esc(m.name)}" data-m="${m.id}" data-prop="name" placeholder="名前" autocomplete="off">
      </label>
      <div class="field"><span>担当できる係</span>
        <div class="chk-group">${state.roles.map((r) => check(`data-m="${m.id}" data-norole="${r.id}"`, !m.noRoles.includes(r.id), esc(r.name))).join('')}</div>
      </div>
      <div class="danger-zone"><button type="button" class="btn-danger" data-action="del-member" data-m="${m.id}">このメンバーを削除</button></div>`;
  } else if (ui.editTab === 'off') {
    const dates = m.offDates
      .slice()
      .sort()
      .map((k) => `<span class="chip">${dateLabel(k)}<button type="button" data-action="del-offdate" data-m="${m.id}" data-date="${k}" aria-label="削除">×</button></span>`)
      .join('');
    panel = `
      <div class="field"><span>毎週入れない曜日</span>
        <div class="chk-group wd">${WD.map((w, i) => check(`data-m="${m.id}" data-offwd="${i}"`, m.offWeekdays.includes(i), w)).join('')}</div>
      </div>
      <div class="field"><span>入れない日付</span>
        <div class="row">
          <input type="date" data-offdate-input="${m.id}" aria-label="入れない日付">
          <button type="button" data-action="add-offdate" data-m="${m.id}">追加</button>
        </div>
        <div class="chips">${dates || '<span class="hint">なし</span>'}</div>
      </div>`;
  } else {
    const chips = m.fixed
      .map((f, i) => `<span class="chip fixed">${esc(fixedLabel(state, f))}<button type="button" data-action="del-fixed" data-m="${m.id}" data-i="${i}" aria-label="削除">×</button></span>`)
      .join('');
    panel = `
      <p class="hint">「月曜・ゴミ出し係」なら毎週月曜は必ずゴミ出し係。「毎日」を選ぶと係固定になります。月を選ぶとその月だけの固定です。</p>
      <div class="fixed-form">
        <select data-fixed-ym="${m.id}" aria-label="対象の月">${ymOptionsHtml(state)}</select>
        <select data-fixed-wd="${m.id}" aria-label="曜日">${wdOptionsHtml()}</select>
        <select data-fixed-role="${m.id}" aria-label="係">${roleOptionsHtml(state)}</select>
        <button type="button" data-action="add-fixed" data-m="${m.id}">追加</button>
      </div>
      <div class="chips">${chips || '<span class="hint">なし</span>'}</div>
      ${m.fixed.length ? `<div class="field">${check(`data-m="${m.id}" data-fixedonly="1"`, m.fixedOnly, '固定の日だけ担当する（ほかの日には入れない）')}</div>` : ''}`;
  }

  return `
    <div class="sheet-head">
      <h3>${esc(m.name.trim() || '新しいメンバー')}</h3>
      <button type="button" class="btn-primary small" data-action="close-member">完了</button>
    </div>
    <div class="seg" role="tablist">${tabs}</div>
    <div class="sheet-body">${panel}</div>`;
}

// ---------- 係・期間 ----------
function rolesPanel(state) {
  const endD = new Date(state.startYear, state.startMonth - 1 + 11, 1);
  const period = card(
    '期間',
    '開始月から12ヶ月分を作ります。4月始まりの年度なら4月を選んでください。',
    `<div class="row">
      <select data-field="startYear" aria-label="開始年">${yearOptions(state.startYear)}</select>
      <select data-field="startMonth" aria-label="開始月">${monthOptions(state.startMonth)}</select>
      <span>〜 ${endD.getFullYear()}年${endD.getMonth() + 1}月</span>
    </div>`
  );
  const roles = state.roles
    .map(
      (r) => `
      <div class="role-item">
        <div class="row">
          <input type="text" value="${esc(r.name)}" data-r="${r.id}" data-prop="name" placeholder="係の名前" aria-label="係の名前" class="role-name">
          <label class="inline">1日 <input type="number" min="1" max="20" value="${r.count}" data-r="${r.id}" data-prop="count" class="num"> 人</label>
          <button type="button" class="btn-danger small" data-action="del-role" data-r="${r.id}"${state.roles.length <= 1 ? ' disabled' : ''}>削除</button>
        </div>
        <div class="rotate">
          <span class="lbl">毎月1人を固定する曜日</span>
          <div class="chk-group wd">${WD.map((w, i) => check(`data-rotate="${r.id}" data-wd="${i}"`, (r.rotate || []).includes(i), w)).join('')}</div>
        </div>
      </div>`
    )
    .join('');
  return (
    period +
    card(
      '係',
      '係の名前と1日に必要な人数を入れます。「毎月1人を固定する曜日」にチェックすると、その曜日は月ごとに1人が担当し、担当者は毎月自動で交代します（例：ゴミ出し係の月曜を、11月は佐藤さん、12月は鈴木さん…）。',
      `${roles}<button type="button" data-action="add-role">＋ 係を追加</button>`
    )
  );
}

// ---------- 固定 ----------
function fixedPanel(state) {
  const active = state.members.filter((m) => m.name.trim());
  const months = periodMonths(state);
  const groups = new Map();
  for (const m of active) {
    m.fixed.forEach((f, i) => {
      const key = f.ym || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ m, f, i });
    });
  }
  const order = ['', ...months, ...[...groups.keys()].filter((k) => k && !months.includes(k)).sort()];
  const list = order
    .filter((k) => groups.has(k))
    .map((k) => {
      const rows = groups.get(k).sort((a, b) => a.f.wd - b.f.wd);
      const title = k ? ymShort(k) + (months.includes(k) ? '' : '（期間外）') : '期間中ずっと';
      return `<div class="fx-group"><div class="fx-title">${esc(title)}</div><div class="chips">${rows
        .map(
          ({ m, f, i }) =>
            `<span class="chip fixed">${esc(`${f.wd === -1 ? '毎日' : WD[f.wd] + '曜'}・${roleNameOf(state, f.roleId)}：${m.name}`)}<button type="button" data-action="del-fixed" data-m="${m.id}" data-i="${i}" aria-label="削除">×</button></span>`
        )
        .join('')}</div></div>`;
    })
    .join('');

  const manual = card(
    '月ごとの固定',
    '「4月の月曜のゴミ出しは佐藤さん、5月は鈴木さん」のように、月ごとに固定する人を決められます。ここで追加した固定は、各メンバーの「固定」にも表示されます。',
    `<div class="fixed-form">
      <select id="fx-ym" aria-label="対象の月">${ymOptionsHtml(state)}</select>
      <select id="fx-wd" aria-label="曜日">${wdOptionsHtml()}</select>
      <select id="fx-role" aria-label="係">${roleOptionsHtml(state)}</select>
      <select id="fx-m" aria-label="担当する人"><option value="">担当する人</option>${active.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
      <button type="button" data-action="add-fixed-ov">追加</button>
    </div>
    ${list || '<p class="hint">まだ固定はありません。</p>'}`
  );

  // 毎月ローテーションの結果
  const rules = state.roles.flatMap((r) => (r.rotate || []).map((wd) => ({ r, wd })));
  let rotate = '';
  if (rules.length) {
    const names = new Map(state.members.map((m) => [m.id, m.name]));
    const head = rules.map(({ r, wd }) => `<th>${esc(r.name)}<br>${WD[wd]}曜</th>`).join('');
    const body = state.autoFixed
      ? months
          .map(
            (ym) =>
              `<tr><td>${ymShort(ym)}</td>${rules
                .map(({ r, wd }) => {
                  const id = state.autoFixed[ym]?.[`${r.id}|${wd}`];
                  return `<td>${id ? esc(names.get(id) || '(削除)') : '<span class="muted">手動</span>'}</td>`;
                })
                .join('')}</tr>`
          )
          .join('')
      : '';
    rotate = card(
      '毎月ローテーションの担当',
      state.autoFixed
        ? '当番表を作ったときに自動で決まった担当者です。「手動」は月ごとの固定を優先した月です。変えたいときは、上の「月ごとの固定」で指定して作り直してください。'
        : '当番表を作ると、ここに月ごとの担当者が表示されます。',
      state.autoFixed ? `<div class="tbl-wrap"><table class="tbl rot"><thead><tr><th>月</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` : ''
    );
  }
  return manual + rotate;
}

// ---------- 休み・ルール ----------
function rulesPanel(state) {
  const active = state.members.filter((m) => m.name.trim());
  const opts = active.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  const names = new Map(state.members.map((m) => [m.id, m.name]));
  const ex = card(
    '当番を入れない日',
    '',
    `<div class="chk-group">
      ${check('data-field="excludeWeekends"', state.excludeWeekends, '土日')}
      ${check('data-field="excludeHolidays"', state.excludeHolidays, '祝日（振替休日を含む）')}
    </div>
    <div class="field"><span>曜日で除外</span><div class="chk-group wd">${WD.map((w, i) => check(`data-exwd="${i}"`, state.excludeWeekdays.includes(i), w)).join('')}</div></div>
    <div class="field"><span>日付で除外</span>
      <div class="row">
        <input type="date" id="ex-from" aria-label="開始日"> 〜 <input type="date" id="ex-to" aria-label="終了日（1日だけなら空欄）">
      </div>
      <div class="row">
        <input type="text" id="ex-label" placeholder="メモ（例：運動会）" class="short">
        <button type="button" data-action="add-ex">追加</button>
        <button type="button" data-action="add-newyear">年末年始を追加</button>
      </div>
      <div class="chips">${
        state.excludeDates
          .map(
            (r, i) =>
              `<span class="chip">${dateLabel(r.from)}${r.to && r.to !== r.from ? '〜' + dateLabel(r.to) : ''}${r.label ? ' ' + esc(r.label) : ''}<button type="button" data-action="del-ex" data-i="${i}" aria-label="削除">×</button></span>`
          )
          .join('') || '<span class="hint">なし</span>'
      }</div>
    </div>`
  );
  const rules = card(
    'ルール',
    '',
    `<div class="field">${check('data-field="avoidConsecutive"', state.avoidConsecutive, '同じ人を続けて当番にしない')}</div>
    <div class="field">${check('data-field="allowMultiRole"', state.allowMultiRole, '同じ日に1人が複数の係を兼ねてもよい')}</div>
    <div class="field"><span>組ませないペア（同じ日の同じ係に入れない）</span>
      <div class="row">
        <select id="ng-a" aria-label="1人目"><option value="">1人目</option>${opts}</select>
        <span>と</span>
        <select id="ng-b" aria-label="2人目"><option value="">2人目</option>${opts}</select>
        <button type="button" data-action="add-ng">追加</button>
      </div>
      <div class="chips">${
        state.ngPairs
          .map(([a, b], i) => `<span class="chip">${esc(names.get(a))} × ${esc(names.get(b))}<button type="button" data-action="del-ng" data-i="${i}" aria-label="削除">×</button></span>`)
          .join('') || '<span class="hint">なし</span>'
      }</div>
    </div>`
  );
  return ex + rules;
}

// ---------- 描画 ----------
function settingsHtml(state) {
  const fixedCount = state.members.reduce((n, m) => n + m.fixed.length, 0) + state.roles.reduce((n, r) => n + (r.rotate || []).length, 0);
  const sub = SUBTABS.map(
    ([id, label]) =>
      `<button type="button" role="tab" data-action="sub-tab" data-tab="${id}" aria-selected="${ui.tab === id}">${label}${
        id === 'members' ? ` <span class="cnt">${state.members.filter((m) => m.name.trim()).length}</span>` : ''
      }${id === 'fixed' && fixedCount ? ` <span class="cnt">${fixedCount}</span>` : ''}</button>`
  ).join('');
  const panel =
    ui.tab === 'members' ? membersPanel(state) : ui.tab === 'roles' ? rolesPanel(state) : ui.tab === 'fixed' ? fixedPanel(state) : rulesPanel(state);
  return `
    <div class="seg sub-tabs" role="tablist" aria-label="設定の項目">${sub}</div>
    ${panel}
    <div class="gen-bar">
      <button type="button" class="btn-primary big" data-action="generate">${state.schedule ? '1年分を作り直す' : '1年分を生成する'}</button>
    </div>`;
}

function renderDialog(state) {
  const m = state.members.find((x) => x.id === ui.editId);
  if (!m) {
    if (refs.dialog.open) refs.dialog.close();
    return;
  }
  refs.dialog.innerHTML = memberDialogHtml(state, m);
}

export function renderSettings(state) {
  if (!refs) return;
  const y = window.scrollY;
  refs.root.innerHTML = settingsHtml(state);
  window.scrollTo(0, y);
  if (refs.dialog.open) renderDialog(state);
}

function openMember(state, id, tab = 'basic') {
  ui.editId = id;
  ui.editTab = tab;
  renderDialog(state);
  if (!refs.dialog.open) refs.dialog.showModal();
}

// ---------- 操作 ----------
// ctx: { get state, commit({structural, affects}), generate() }
export function initSettings(root, dialog, ctx) {
  refs = { root, dialog, ctx };
  const S = () => ctx.state;
  const findM = (id) => S().members.find((m) => m.id === id);
  const findR = (id) => S().roles.find((r) => r.id === id);
  const toggle = (arr, v, on) => {
    const i = arr.indexOf(v);
    if (on && i < 0) arr.push(v);
    if (!on && i >= 0) arr.splice(i, 1);
  };
  const addFixed = (m, { wd, roleId, ym }) => {
    const f = { wd, roleId };
    if (ym) f.ym = ym;
    if (!m.fixed.some((x) => x.wd === wd && x.roleId === roleId && (x.ym || '') === (ym || ''))) m.fixed.push(f);
    sortFixed(m.fixed);
  };

  // シートを閉じたら一覧を最新にする
  dialog.addEventListener('close', () => {
    ui.editId = null;
    renderSettings(S());
  });
  // シートの外側（背景）をタップしたら閉じる
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  for (const el of [root, dialog]) {
    // 入力中は再描画しない（カーソルが飛ばないように）
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'member-filter') {
        ui.filter = t.value;
        root.querySelector('#member-list').innerHTML = memberListHtml(S());
        return;
      }
      if (t.dataset.prop === 'name' && t.dataset.m) {
        findM(t.dataset.m).name = t.value;
        const h = dialog.querySelector('.sheet-head h3');
        if (h) h.textContent = t.value.trim() || '新しいメンバー';
        ctx.commit({ affects: false });
      } else if (t.dataset.prop === 'name' && t.dataset.r) {
        findR(t.dataset.r).name = t.value;
        ctx.commit({ affects: false });
      }
    });

    el.addEventListener('change', (e) => {
      const t = e.target;
      const s = S();
      const d = t.dataset;
      if (d.prop === 'name') return ctx.commit({ structural: true, affects: false });
      if (d.field) {
        s[d.field] = t.type === 'checkbox' ? t.checked : Number(t.value);
        return ctx.commit({ structural: d.field === 'startYear' || d.field === 'startMonth' });
      }
      if (d.prop === 'count') {
        findR(d.r).count = Math.min(20, Math.max(1, Number(t.value) || 1));
        return ctx.commit({ structural: true });
      }
      if (d.rotate) {
        const r = findR(d.rotate);
        r.rotate ??= [];
        toggle(r.rotate, Number(d.wd), t.checked);
        r.rotate.sort((a, b) => a - b);
        return ctx.commit({ structural: true });
      }
      if (d.norole) {
        toggle(findM(d.m).noRoles, d.norole, !t.checked);
        return ctx.commit({ structural: true });
      }
      if (d.offwd) {
        toggle(findM(d.m).offWeekdays, Number(d.offwd), t.checked);
        return ctx.commit({ structural: true });
      }
      if (d.fixedonly) {
        findM(d.m).fixedOnly = t.checked;
        return ctx.commit({ structural: true });
      }
      if (d.exwd) {
        toggle(s.excludeWeekdays, Number(d.exwd), t.checked);
        return ctx.commit({ structural: true });
      }
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b || !el.contains(b)) return;
      const s = S();
      const d = b.dataset;
      const q = (sel) => el.querySelector(sel);
      switch (d.action) {
        case 'sub-tab':
          ui.tab = d.tab;
          renderSettings(s);
          window.scrollTo(0, 0);
          return;
        case 'edit-member':
          return openMember(s, d.m);
        case 'edit-tab':
          ui.editTab = d.tab;
          return renderDialog(s);
        case 'close-member':
          return dialog.close();
        case 'add-role':
          s.roles.push({ id: uid('r_'), name: '', count: 1, rotate: [] });
          return ctx.commit({ structural: true });
        case 'del-role': {
          const r = findR(d.r);
          if (!confirm(`「${r.name || '名前なしの係'}」を削除しますか？`)) return;
          s.roles = s.roles.filter((x) => x.id !== d.r);
          s.members.forEach((m) => {
            m.noRoles = m.noRoles.filter((x) => x !== d.r);
            m.fixed = m.fixed.filter((f) => f.roleId !== d.r);
            if (!m.fixed.length) m.fixedOnly = false;
          });
          return ctx.commit({ structural: true });
        }
        case 'add-member': {
          const m = newMember();
          s.members.push(m);
          ctx.commit({ structural: true });
          openMember(s, m.id);
          dialog.querySelector('.name-input')?.focus();
          return;
        }
        case 'bulk-add':
        case 'sample': {
          const list =
            d.action === 'sample'
              ? SAMPLE
              : q('#bulk-names').value.split(/[\n,、，]/).map((x) => x.trim()).filter(Boolean);
          if (!list.length) return alert('名前を入力してください');
          list.forEach((name) => s.members.push(newMember(name)));
          return ctx.commit({ structural: true });
        }
        case 'del-member': {
          const m = findM(d.m);
          if (!confirm(`${m.name || 'このメンバー'}を削除しますか？`)) return;
          s.members = s.members.filter((x) => x.id !== d.m);
          s.ngPairs = s.ngPairs.filter(([a, b2]) => a !== d.m && b2 !== d.m);
          dialog.close();
          return ctx.commit({ structural: true });
        }
        case 'add-offdate': {
          const v = q(`[data-offdate-input="${d.m}"]`).value;
          if (!v) return alert('日付を選んでください');
          const m = findM(d.m);
          if (!m.offDates.includes(v)) m.offDates.push(v);
          return ctx.commit({ structural: true });
        }
        case 'del-offdate': {
          const m = findM(d.m);
          m.offDates = m.offDates.filter((x) => x !== d.date);
          return ctx.commit({ structural: true });
        }
        case 'add-fixed': {
          const roleId = q(`[data-fixed-role="${d.m}"]`).value;
          if (!roleId) return alert('係を選んでください');
          addFixed(findM(d.m), { wd: Number(q(`[data-fixed-wd="${d.m}"]`).value), roleId, ym: q(`[data-fixed-ym="${d.m}"]`).value });
          return ctx.commit({ structural: true });
        }
        case 'add-fixed-ov': {
          const m = findM(q('#fx-m').value);
          const roleId = q('#fx-role').value;
          if (!m) return alert('担当する人を選んでください');
          if (!roleId) return alert('係を選んでください');
          addFixed(m, { wd: Number(q('#fx-wd').value), roleId, ym: q('#fx-ym').value });
          return ctx.commit({ structural: true });
        }
        case 'del-fixed': {
          const m = findM(d.m);
          m.fixed.splice(Number(d.i), 1);
          if (!m.fixed.length) m.fixedOnly = false;
          return ctx.commit({ structural: true });
        }
        case 'add-ex': {
          const from = q('#ex-from').value;
          let to = q('#ex-to').value || from;
          const label = q('#ex-label').value.trim();
          if (!from) return alert('開始日を選んでください');
          if (to < from) to = from;
          s.excludeDates.push({ from, to, label });
          s.excludeDates.sort((a, b2) => a.from.localeCompare(b2.from));
          return ctx.commit({ structural: true });
        }
        case 'add-newyear': {
          // 期間内のすべての年末年始を追加
          const start = fmt(new Date(s.startYear, s.startMonth - 1, 1));
          const end = fmt(new Date(s.startYear, s.startMonth - 1 + 12, 0));
          for (let y = s.startYear - 1; y <= s.startYear + 1; y++) {
            const from = `${y}-12-29`, to = `${y + 1}-01-03`;
            if (from > end || to < start) continue;
            if (!s.excludeDates.some((r) => r.from === from && r.to === to)) s.excludeDates.push({ from, to, label: '年末年始' });
          }
          s.excludeDates.sort((a, b2) => a.from.localeCompare(b2.from));
          return ctx.commit({ structural: true });
        }
        case 'del-ex':
          s.excludeDates.splice(Number(d.i), 1);
          return ctx.commit({ structural: true });
        case 'add-ng': {
          const a = q('#ng-a').value, b2 = q('#ng-b').value;
          if (!a || !b2 || a === b2) return alert('違う2人を選んでください');
          if (!s.ngPairs.some(([x, y]) => (x === a && y === b2) || (x === b2 && y === a))) s.ngPairs.push([a, b2]);
          return ctx.commit({ structural: true });
        }
        case 'del-ng':
          s.ngPairs.splice(Number(d.i), 1);
          return ctx.commit({ structural: true });
        case 'generate':
          return ctx.generate();
      }
    });
  }

  renderSettings(S());
}
