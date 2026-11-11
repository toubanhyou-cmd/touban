// カレンダー・一覧・集計表の描画
import { WD, fmt, parse, esc } from './utils.js';
import { holidayName } from './holidays.js';
import { excludedReason, activeMembers } from './scheduler.js';

const nameMap = (state) => new Map(state.members.map((m) => [m.id, m.name]));

function slotHtml(state, k, role, i, id, names, issues, editable) {
  const msgs = issues.get(`${k}|${role.id}|${i}`);
  const label = id ? names.get(id) || '(削除)' : '未定';
  const cls = `nm${msgs ? ' bad' : ''}${id ? '' : ' empty'}`;
  if (!editable) return `<span class="${cls}">${esc(label)}</span>`;
  const title = msgs ? '注意：' + msgs.join('／') : 'クリックで担当者を変更';
  return `<button type="button" class="${cls}" data-date="${k}" data-role="${role.id}" data-idx="${i}" title="${esc(title)}">${esc(label)}</button>`;
}

export function renderMonth(state, ym, issues, { editable = true } = {}) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const names = nameMap(state);

  let html = '<div class="cal">';
  html += WD.map((w, i) => `<div class="cal-head${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${w}</div>`).join('');
  for (let i = 0; i < first.getDay(); i++) html += '<div class="cal-cell blank"></div>';

  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(y, m - 1, d);
    const k = fmt(date);
    const w = date.getDay();
    const hol = holidayName(k);
    const ex = excludedReason(state, date);
    const day = state.schedule?.[k];
    let cls = 'cal-cell';
    if (w === 0 || hol) cls += ' sun';
    else if (w === 6) cls += ' sat';
    if (!day) cls += ' off';
    if (k === fmt(new Date())) cls += ' today';

    let body = '';
    if (day) {
      body = state.roles
        .map((role, ri) => {
          const slot = day[role.id] || [];
          const people = Array.from({ length: role.count }, (_, i) =>
            slotHtml(state, k, role, i, slot[i], names, issues, editable)
          ).join('<span class="sep">・</span>');
          return `<div class="line role-${ri % 6}"><span class="rt">${esc(role.name)}</span>${people}</div>`;
        })
        .join('');
    } else if (ex && !hol) {
      body = `<div class="off-label">${esc(ex)}</div>`;
    }
    html += `<div class="${cls}"><div class="dnum"><span class="dn">${d}</span><span class="dow">${m}/${d}（${WD[w]}）</span>${hol ? `<span class="hol">${esc(hol)}</span>` : ''}</div>${body}</div>`;
  }
  const used = first.getDay() + lastDay;
  for (let i = used % 7 ? 7 - (used % 7) : 0; i > 0; i--) html += '<div class="cal-cell blank"></div>';
  return html + '</div>';
}

export function renderList(state, ym, issues) {
  const names = nameMap(state);
  const keys = Object.keys(state.schedule || {}).filter((k) => k.startsWith(ym)).sort();
  if (!keys.length) return '<p class="empty-msg">この月の当番はありません。</p>';
  let html = `<table class="tbl list"><thead><tr><th>日付</th>${state.roles.map((r) => `<th>${esc(r.name)}</th>`).join('')}</tr></thead><tbody>`;
  for (const k of keys) {
    const d = parse(k);
    const w = d.getDay();
    const day = state.schedule[k];
    html += `<tr><td class="${w === 6 ? 'sat' : w === 0 ? 'sun' : ''}">${d.getMonth() + 1}/${d.getDate()}（${WD[w]}）</td>`;
    html += state.roles
      .map((role) => {
        const slot = day[role.id] || [];
        return `<td>${Array.from({ length: role.count }, (_, i) => slotHtml(state, k, role, i, slot[i], names, issues, true)).join('<span class="sep">・</span>')}</td>`;
      })
      .join('');
    html += '</tr>';
  }
  return html + '</tbody></table>';
}

export function renderCounts(state, ym, counts) {
  const members = activeMembers(state);
  if (!members.length) return '';
  const mc = counts.month[ym] || {};
  const yc = counts.year;
  const totals = members.map((m) => mc[m.id]?.total || 0);
  const max = Math.max(...totals), min = Math.min(...totals);
  let html = `<table class="tbl counts"><thead><tr><th>名前</th>${state.roles.map((r) => `<th>${esc(r.name)}</th>`).join('')}<th>この月の合計</th><th>年間の合計</th></tr></thead><tbody>`;
  for (const m of members) {
    const t = mc[m.id]?.total || 0;
    const mark = max !== min && t === max ? ' hi' : max !== min && t === min ? ' lo' : '';
    html += `<tr><td>${esc(m.name)}</td>`;
    html += state.roles.map((r) => `<td>${m.noRoles.includes(r.id) ? '<span class="muted">－</span>' : mc[m.id]?.roles[r.id] || 0}</td>`).join('');
    html += `<td class="sum${mark}">${t}</td><td class="sum">${yc[m.id]?.total || 0}</td></tr>`;
  }
  html += '</tbody></table>';
  html += `<p class="hint">この月の合計の差：<strong>${max - min}回</strong>（月ごとの差は、前の月までの回数をふまえて翌月以降で調整されます）</p>`;
  return html;
}
