// 当番の割り当てロジック
import { fmt, parse, addDays, pad, mulberry32 } from './utils.js';
import { holidayName } from './holidays.js';

// 期間（開始月から12ヶ月）の 'YYYY-MM' 一覧
export function periodMonths(state) {
  const out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(state.startYear, state.startMonth - 1 + i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
}

// 当番を入れない日なら理由を返す
export function excludedReason(state, date) {
  const k = fmt(date);
  const w = date.getDay();
  const hol = holidayName(k);
  if (state.excludeHolidays && hol) return hol;
  if (state.excludeWeekends && (w === 0 || w === 6)) return w === 0 ? '日曜' : '土曜';
  if (state.excludeWeekdays.includes(w)) return `${'日月火水木金土'[w]}曜除外`;
  const r = state.excludeDates.find((r) => k >= r.from && k <= (r.to || r.from));
  if (r) return r.label || '除外日';
  return null;
}

// 期間内で当番がある日
export function workDays(state) {
  const days = [];
  const end = new Date(state.startYear, state.startMonth - 1 + 12, 1);
  for (let d = new Date(state.startYear, state.startMonth - 1, 1); d < end; d = addDays(d, 1)) {
    if (!excludedReason(state, d)) days.push(d);
  }
  return days;
}

export const activeMembers = (state) => state.members.filter((m) => m.name.trim());

// 毎週この曜日はこの係、と固定されているか
// wd が -1 のときは「毎日」（係固定）。ym（'YYYY-MM'）があればその月だけ有効
export const isFixed = (member, roleId, weekday, key) =>
  member.fixed.some(
    (f) => (f.wd === weekday || f.wd === -1) && f.roleId === roleId && (!f.ym || key.startsWith(f.ym))
  );

// その人がその係・その日に入れない理由
export function unavailableReason(member, roleId, key, weekday) {
  const fixed = isFixed(member, roleId, weekday, key);
  if (!fixed && member.fixedOnly) return '固定の日以外';
  if (!fixed && member.noRoles.includes(roleId)) return 'この係は担当外';
  if (member.offWeekdays.includes(weekday)) return '不可曜日';
  if (member.offDates.includes(key)) return '不可日';
  return null;
}

export function ngSet(state) {
  const s = new Set();
  for (const [a, b] of state.ngPairs) {
    s.add(a + '|' + b);
    s.add(b + '|' + a);
  }
  return s;
}

// 1回分の割り当て
function attempt(state, rand) {
  const members = activeMembers(state);
  const ng = ngSet(state);
  const roleCnt = {}, total = {}, monthCnt = {}, monthRole = {};
  members.forEach((m) => { roleCnt[m.id] = {}; total[m.id] = 0; monthCnt[m.id] = 0; monthRole[m.id] = {}; });

  // 担当できる人が少ない係から先に埋める
  const eligible = (r) => members.filter((m) => !m.noRoles.includes(r.id)).length;
  const roles = [...state.roles].sort((a, b) => eligible(a) - eligible(b));

  const schedule = {};
  let unfilled = 0, relaxed = 0;
  let prev = new Set();
  let curYm = null;

  for (const date of workDays(state)) {
    const k = fmt(date);
    const w = date.getDay();
    if (k.slice(0, 7) !== curYm) {
      curYm = k.slice(0, 7);
      members.forEach((m) => { monthCnt[m.id] = 0; monthRole[m.id] = {}; });
    }
    const today = new Set();
    const day = {};
    const place = (m, role) => {
      day[role.id].push(m.id);
      today.add(m.id);
      monthRole[m.id][role.id] = (monthRole[m.id][role.id] || 0) + 1;
      roleCnt[m.id][role.id] = (roleCnt[m.id][role.id] || 0) + 1;
      monthCnt[m.id]++;
      total[m.id]++;
    };

    // 1回目：曜日固定・係固定の人を先に入れる（固定は連続担当の制限より優先）
    for (const role of roles) {
      day[role.id] = [];
      for (const m of members) {
        if (day[role.id].length >= role.count) break;
        if (!isFixed(m, role.id, w, k) || unavailableReason(m, role.id, k, w)) continue;
        if (!state.allowMultiRole && today.has(m.id)) continue;
        if (day[role.id].some((o) => ng.has(o + '|' + m.id))) continue;
        place(m, role);
      }
    }

    // 2回目：残りの枠を均等に割り当てる
    for (const role of roles) {
      const slot = day[role.id];
      for (let i = slot.length; i < role.count; i++) {
        let cands = members.filter(
          (m) =>
            !unavailableReason(m, role.id, k, w) &&
            !slot.includes(m.id) &&
            (state.allowMultiRole || !today.has(m.id)) &&
            !slot.some((o) => o && ng.has(o + '|' + m.id))
        );
        let usedRelax = false;
        if (state.avoidConsecutive) {
          const strict = cands.filter((m) => !prev.has(m.id));
          if (strict.length) cands = strict;
          else if (cands.length) usedRelax = true;
        }
        if (!cands.length) {
          slot.push(null);
          unfilled++;
          continue;
        }
        // その月のこの係の回数 → その月の合計 → この係の累計 → 全係の累計 が少ない人を優先。同点ならランダム
        // 累計も見るので、前の月に少なかった人は翌月以降で多めに入る（月をまたいだ調整）
        const pick = cands
          .map((m) => ({
            m,
            a: monthRole[m.id][role.id] || 0,
            b: monthCnt[m.id],
            c: roleCnt[m.id][role.id] || 0,
            d: total[m.id],
            r: rand(),
          }))
          .sort((x, y) => x.a - y.a || x.b - y.b || x.c - y.c || x.d - y.d || x.r - y.r)[0].m;
        place(pick, role);
        if (usedRelax) relaxed++;
      }
    }
    schedule[k] = day;
    prev = today;
  }
  return { schedule, unfilled, relaxed };
}

// 担当回数の集計
export function countUp(state, schedule) {
  const month = {}, year = {};
  const bump = (obj, id, rid) => {
    obj[id] ??= { total: 0, roles: {} };
    obj[id].total++;
    obj[id].roles[rid] = (obj[id].roles[rid] || 0) + 1;
  };
  for (const [k, day] of Object.entries(schedule || {})) {
    const ym = k.slice(0, 7);
    month[ym] ??= {};
    for (const role of state.roles) {
      for (const id of (day[role.id] || []).slice(0, role.count)) {
        if (!id) continue;
        bump(month[ym], id, role.id);
        bump(year, id, role.id);
      }
    }
  }
  return { month, year };
}

function spread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

// 偏りの点数（小さいほど良い）
function score(state, res) {
  // 固定の日だけの人・毎日固定の人は、偏りの計算から外す
  const members = activeMembers(state).filter((m) => !m.fixedOnly && !m.fixed.some((f) => f.wd === -1));
  const { month, year } = countUp(state, res.schedule);
  let s = res.unfilled * 10000 + res.relaxed * 100;
  for (const role of state.roles) {
    const elig = members.filter((m) => !m.noRoles.includes(role.id));
    s += spread(elig.map((m) => year[m.id]?.roles[role.id] || 0)) * 10;
  }
  for (const ym of Object.keys(month)) {
    s += spread(members.map((m) => month[ym][m.id]?.total || 0));
  }
  return s;
}

// 何通りか試して、一番偏りの少ない結果を返す
export function generate(state, seed, tries = 30) {
  let best = null;
  for (let t = 0; t < tries; t++) {
    const res = attempt(state, mulberry32(seed + t * 7919));
    const sc = score(state, res);
    if (!best || sc < best.sc) best = { ...res, sc };
  }
  return best.schedule;
}

// ルール違反のチェック（手動で入れ替えたあとにも使う）
// 戻り値：Map('日付|係ID|枠番号' → 理由の配列)
export function validate(state, schedule) {
  const res = new Map();
  if (!schedule) return res;
  const add = (k, rid, i, msg) => {
    const key = `${k}|${rid}|${i}`;
    if (!res.has(key)) res.set(key, []);
    res.get(key).push(msg);
  };
  const byId = new Map(state.members.map((m) => [m.id, m]));
  const ng = ngSet(state);
  let prev = new Set();
  for (const k of Object.keys(schedule).sort()) {
    const day = schedule[k];
    const w = parse(k).getDay();
    const seen = new Set();
    for (const role of state.roles) {
      const slot = day[role.id] || [];
      for (let i = 0; i < role.count; i++) {
        const id = slot[i];
        if (!id) { add(k, role.id, i, '未割り当て'); continue; }
        const m = byId.get(id);
        if (!m) { add(k, role.id, i, '削除されたメンバー'); continue; }
        const u = unavailableReason(m, role.id, k, w);
        if (u) add(k, role.id, i, u);
        if (slot.indexOf(id) !== i) add(k, role.id, i, '同じ係に重複');
        else if (!state.allowMultiRole && seen.has(id)) add(k, role.id, i, '同じ日に別の係と兼任');
        for (let j = 0; j < i; j++) if (slot[j] && ng.has(slot[j] + '|' + id)) add(k, role.id, i, '組ませないペア');
        if (state.avoidConsecutive && prev.has(id) && !isFixed(m, role.id, w, k)) add(k, role.id, i, '前の当番日と連続');
        seen.add(id);
      }
    }
    prev = seen;
  }
  return res;
}

// ある当番日の1つ前の当番日
export function prevWorkDay(schedule, key) {
  const keys = Object.keys(schedule).sort();
  const i = keys.indexOf(key);
  return i > 0 ? keys[i - 1] : null;
}
