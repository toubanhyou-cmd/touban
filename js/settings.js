// ① 設定タブ
import { WD, esc, uid, fmt } from './utils.js';

const SAMPLE = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田'];
const openMembers = new Set(); // 詳細を開いているメンバー

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

function memberHtml(state, m) {
  const roles = state.roles
    .map((r) => check(`data-m="${m.id}" data-norole="${r.id}"`, !m.noRoles.includes(r.id), esc(r.name)))
    .join('');
  const wds = WD.map((w, i) => check(`data-m="${m.id}" data-offwd="${i}"`, m.offWeekdays.includes(i), w)).join('');
  const dates = m.offDates
    .slice()
    .sort()
    .map((k) => `<span class="chip">${dateLabel(k)}<button type="button" data-action="del-offdate" data-m="${m.id}" data-date="${k}" aria-label="削除">×</button></span>`)
    .join('');
  const roleName = new Map(state.roles.map((r) => [r.id, r.name]));
  const fixedLabel = (f) => `${f.wd === -1 ? '毎日' : '毎週' + WD[f.wd] + '曜'}・${roleName.get(f.roleId) || '(削除された係)'}`;
  const fixedChips = m.fixed
    .map((f, i) => `<span class="chip fixed">${esc(fixedLabel(f))}<button type="button" data-action="del-fixed" data-m="${m.id}" data-i="${i}" aria-label="削除">×</button></span>`)
    .join('');
  const wdOptions = `<option value="-1">毎日</option>` + WD.map((w, i) => `<option value="${i}">${w}曜</option>`).join('');
  const roleOptions = state.roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  const offSummary = [
    m.offWeekdays.length ? `毎週${m.offWeekdays.map((i) => WD[i]).join('・')}` : '',
    m.offDates.length ? `${m.offDates.length}日` : '',
  ].filter(Boolean).join('、');
  const summary = [
    offSummary ? `入れない日：${offSummary}` : '',
    m.fixed.length ? `固定：${m.fixed.map(fixedLabel).join('、')}${m.fixedOnly ? '（固定の日だけ）' : ''}` : '',
  ].filter(Boolean).join(' ／ ');
  return `
  <div class="member">
    <div class="row">
      <input type="text" class="name-input" value="${esc(m.name)}" data-m="${m.id}" data-prop="name" placeholder="名前" aria-label="名前">
      <span class="roles">${roles}</span>
      <button type="button" class="btn-danger small" data-action="del-member" data-m="${m.id}">削除</button>
    </div>
    <details data-m="${m.id}"${openMembers.has(m.id) ? ' open' : ''}>
      <summary>入れない日・固定${summary ? `（<strong>${esc(summary)}</strong>）` : '（なし）'}</summary>
      <h4 class="sub-h">入れない日</h4>
      <div class="row"><span class="lbl">毎週</span>${wds}</div>
      <div class="row"><span class="lbl">日付</span>
        <input type="date" data-offdate-input="${m.id}">
        <button type="button" class="small" data-action="add-offdate" data-m="${m.id}">追加</button>
      </div>
      <div class="chips">${dates}</div>
      <h4 class="sub-h">固定（曜日固定・係固定）</h4>
      <p class="hint">例：「月曜・ゴミ出し係」なら毎週月曜は必ずゴミ出し係。「毎日・掃除係」なら当番日は毎日掃除係になります。</p>
      <div class="row">
        <select data-fixed-wd="${m.id}" aria-label="曜日">${wdOptions}</select>
        <select data-fixed-role="${m.id}" aria-label="係">${roleOptions}</select>
        <button type="button" class="small" data-action="add-fixed" data-m="${m.id}">追加</button>
      </div>
      <div class="chips">${fixedChips}</div>
      ${m.fixed.length ? `<div class="row">${check(`data-m="${m.id}" data-fixedonly="1"`, m.fixedOnly, '固定の日だけ担当する（ほかの日には入れない）')}</div>` : ''}
    </details>
  </div>`;
}

export function settingsHtml(state) {
  const active = state.members.filter((m) => m.name.trim());
  const opts = (sel) => active.map((m) => `<option value="${m.id}"${m.id === sel ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
  const names = new Map(state.members.map((m) => [m.id, m.name]));
  const endD = new Date(state.startYear, state.startMonth - 1 + 11, 1);

  return `
  <section class="card">
    <h2>期間</h2>
    <p class="hint">開始月から12ヶ月分を作ります。4月始まりの年度で使う場合は4月を選んでください。</p>
    <div class="row">
      <select data-field="startYear" aria-label="開始年">${yearOptions(state.startYear)}</select>
      <select data-field="startMonth" aria-label="開始月">${monthOptions(state.startMonth)}</select>
      <span>から ${endD.getFullYear()}年${endD.getMonth() + 1}月まで</span>
    </div>
  </section>

  <section class="card">
    <h2>係</h2>
    <p class="hint">係の名前と、1日に必要な人数を入れます。</p>
    ${state.roles
      .map(
        (r) => `
      <div class="row">
        <input type="text" value="${esc(r.name)}" data-r="${r.id}" data-prop="name" placeholder="係の名前" aria-label="係の名前">
        <label>1日 <input type="number" min="1" max="20" value="${r.count}" data-r="${r.id}" data-prop="count" class="num"> 人</label>
        <button type="button" class="btn-danger small" data-action="del-role" data-r="${r.id}"${state.roles.length <= 1 ? ' disabled' : ''}>削除</button>
      </div>`
      )
      .join('')}
    <button type="button" data-action="add-role">＋ 係を追加</button>
  </section>

  <section class="card">
    <h2>メンバー（${active.length}人）</h2>
    <p class="hint">名前の横のチェックは「担当できる係」です。「入れない日・固定」を開くと、不可曜日・不可日のほか、「毎週月曜はゴミ出し係」のような曜日固定や、「毎日掃除係」のような係固定を設定できます。</p>
    <div class="row bulk">
      <textarea id="bulk-names" rows="3" placeholder="名前を1行に1人ずつ貼り付けて「まとめて追加」"></textarea>
      <div class="col">
        <button type="button" data-action="bulk-add">まとめて追加</button>
        <button type="button" data-action="add-member">＋ 1人追加</button>
        ${state.members.length ? '' : '<button type="button" data-action="sample">サンプルを入れる</button>'}
      </div>
    </div>
    ${state.members.map((m) => memberHtml(state, m)).join('')}
  </section>

  <section class="card">
    <h2>当番を入れない日</h2>
    <div class="row">
      ${check('data-field="excludeWeekends"', state.excludeWeekends, '土日')}
      ${check('data-field="excludeHolidays"', state.excludeHolidays, '祝日（振替休日を含む）')}
    </div>
    <div class="row"><span class="lbl">曜日</span>${WD.map((w, i) => check(`data-exwd="${i}"`, state.excludeWeekdays.includes(i), w)).join('')}</div>
    <div class="row">
      <span class="lbl">日付</span>
      <input type="date" id="ex-from" aria-label="開始日"> 〜 <input type="date" id="ex-to" aria-label="終了日（1日だけなら空欄）">
      <input type="text" id="ex-label" placeholder="メモ（例：年末年始）" class="short">
      <button type="button" class="small" data-action="add-ex">追加</button>
      <button type="button" class="small" data-action="add-newyear">年末年始（12/29〜1/3）を追加</button>
    </div>
    <div class="chips">
      ${state.excludeDates
        .map(
          (r, i) =>
            `<span class="chip">${dateLabel(r.from)}${r.to && r.to !== r.from ? '〜' + dateLabel(r.to) : ''}${r.label ? ' ' + esc(r.label) : ''}<button type="button" data-action="del-ex" data-i="${i}" aria-label="削除">×</button></span>`
        )
        .join('')}
    </div>
  </section>

  <section class="card">
    <h2>ルール</h2>
    <div class="row">${check('data-field="avoidConsecutive"', state.avoidConsecutive, '同じ人を続けて当番にしない（前の当番日と連続させない）')}</div>
    <div class="row">${check('data-field="allowMultiRole"', state.allowMultiRole, '同じ日に1人が複数の係を兼ねてもよい')}</div>
    <h3>組ませないペア</h3>
    <p class="hint">同じ日の同じ係に、この2人が一緒に入らないようにします。</p>
    <div class="row">
      <select id="ng-a" aria-label="1人目"><option value="">選択</option>${opts()}</select>
      と
      <select id="ng-b" aria-label="2人目"><option value="">選択</option>${opts()}</select>
      <button type="button" class="small" data-action="add-ng">追加</button>
    </div>
    <div class="chips">
      ${state.ngPairs
        .map(
          ([a, b], i) =>
            `<span class="chip">${esc(names.get(a))} × ${esc(names.get(b))}<button type="button" data-action="del-ng" data-i="${i}" aria-label="削除">×</button></span>`
        )
        .join('')}
    </div>
  </section>

  <div class="gen-bar">
    <button type="button" class="btn-primary big" data-action="generate">1年分を生成する</button>
  </div>`;
}

// ctx: { get state, commit({structural, affects}), generate() }
export function bindSettings(root, ctx) {
  const findM = (id) => ctx.state.members.find((m) => m.id === id);
  const findR = (id) => ctx.state.roles.find((r) => r.id === id);
  const toggle = (arr, v, on) => {
    const i = arr.indexOf(v);
    if (on && i < 0) arr.push(v);
    if (!on && i >= 0) arr.splice(i, 1);
  };

  root.addEventListener('toggle', (e) => {
    const id = e.target.dataset?.m;
    if (!id || e.target.tagName !== 'DETAILS') return;
    e.target.open ? openMembers.add(id) : openMembers.delete(id);
  }, true);

  // 入力中は再描画しない（カーソルが飛ばないように）
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.prop === 'name' && t.dataset.m) {
      findM(t.dataset.m).name = t.value;
      ctx.commit({ affects: false });
    } else if (t.dataset.prop === 'name' && t.dataset.r) {
      findR(t.dataset.r).name = t.value;
      ctx.commit({ affects: false });
    }
  });

  root.addEventListener('change', (e) => {
    const t = e.target;
    const s = ctx.state;
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
    if (d.norole) {
      toggle(findM(d.m).noRoles, d.norole, !t.checked);
      return ctx.commit({});
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
      return ctx.commit({});
    }
  });

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const s = ctx.state;
    const d = b.dataset;
    switch (d.action) {
      case 'add-role':
        s.roles.push({ id: uid('r_'), name: '', count: 1 });
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
        const id = uid('m_');
        s.members.push({ id, name: '', noRoles: [], offWeekdays: [], offDates: [], fixed: [], fixedOnly: false });
        ctx.commit({ structural: true });
        root.querySelector(`.name-input[data-m="${id}"]`)?.focus();
        return;
      }
      case 'bulk-add':
      case 'sample': {
        const list = d.action === 'sample'
          ? SAMPLE
          : root.querySelector('#bulk-names').value.split(/[\n,、]/).map((x) => x.trim()).filter(Boolean);
        if (!list.length) return alert('名前を入力してください');
        list.forEach((name) => s.members.push({ id: uid('m_'), name, noRoles: [], offWeekdays: [], offDates: [], fixed: [], fixedOnly: false }));
        return ctx.commit({ structural: true });
      }
      case 'del-member': {
        const m = findM(d.m);
        if (m.name && !confirm(`${m.name}さんを削除しますか？`)) return;
        s.members = s.members.filter((x) => x.id !== d.m);
        s.ngPairs = s.ngPairs.filter(([a, b]) => a !== d.m && b !== d.m);
        return ctx.commit({ structural: true });
      }
      case 'add-offdate': {
        const v = root.querySelector(`[data-offdate-input="${d.m}"]`).value;
        if (!v) return alert('日付を選んでください');
        const m = findM(d.m);
        if (!m.offDates.includes(v)) m.offDates.push(v);
        openMembers.add(d.m);
        return ctx.commit({ structural: true });
      }
      case 'add-fixed': {
        const m = findM(d.m);
        const wd = Number(root.querySelector(`[data-fixed-wd="${d.m}"]`).value);
        const roleId = root.querySelector(`[data-fixed-role="${d.m}"]`).value;
        if (!roleId) return alert('係を選んでください');
        if (!m.fixed.some((f) => f.wd === wd && f.roleId === roleId)) m.fixed.push({ wd, roleId });
        m.fixed.sort((a, b) => a.wd - b.wd);
        openMembers.add(d.m);
        return ctx.commit({ structural: true });
      }
      case 'del-fixed': {
        const m = findM(d.m);
        m.fixed.splice(Number(d.i), 1);
        if (!m.fixed.length) m.fixedOnly = false;
        return ctx.commit({ structural: true });
      }
      case 'del-offdate': {
        const m = findM(d.m);
        m.offDates = m.offDates.filter((x) => x !== d.date);
        return ctx.commit({ structural: true });
      }
      case 'add-ex': {
        const from = root.querySelector('#ex-from').value;
        let to = root.querySelector('#ex-to').value || from;
        const label = root.querySelector('#ex-label').value.trim();
        if (!from) return alert('開始日を選んでください');
        if (to < from) to = from;
        s.excludeDates.push({ from, to, label });
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
        s.excludeDates.sort((a, b) => a.from.localeCompare(b.from));
        return ctx.commit({ structural: true });
      }
      case 'del-ex':
        s.excludeDates.splice(Number(d.i), 1);
        return ctx.commit({ structural: true });
      case 'add-ng': {
        const a = root.querySelector('#ng-a').value, b2 = root.querySelector('#ng-b').value;
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
