// 保存（ブラウザ内の localStorage と JSONファイル）
import { fmt } from './utils.js?v=20261112c';

const KEY = 'touban-maker-v1';

export function defaultState() {
  const now = new Date();
  return {
    version: 1,
    startYear: now.getFullYear(),
    startMonth: now.getMonth() + 1,
    roles: [
      { id: 'r_souji', name: '掃除係', count: 2, rotate: [] },
      { id: 'r_gomi', name: 'ゴミ出し係', count: 1, rotate: [] },
    ],
    members: [],
    excludeWeekends: true,
    excludeHolidays: true,
    excludeWeekdays: [],
    excludeDates: [], // { from, to, label }
    ngPairs: [], // [memberIdA, memberIdB]
    avoidConsecutive: true,
    allowMultiRole: false,
    schedule: null, // { 'YYYY-MM-DD': { roleId: [memberId|null, ...] } }
    autoFixed: null, // 毎月ローテーション固定で選ばれた人 { 'YYYY-MM': { '係ID|曜日': memberId } }
    seed: null,
    generatedAt: null,
    stale: false,
  };
}

// 古いデータや手で編集したJSONでも動くように形をそろえる
export function normalize(raw) {
  const s = { ...defaultState(), ...(raw || {}) };
  s.members = (s.members || []).map((m) => ({
    id: m.id,
    name: m.name || '',
    noRoles: m.noRoles || [],
    offWeekdays: m.offWeekdays || [],
    offDates: m.offDates || [],
    fixed: m.fixed || [], // { wd: 0-6, roleId } 毎週この曜日はこの係
    fixedOnly: !!m.fixedOnly, // true なら固定の日以外は入れない
  }));
  s.roles = (s.roles || []).map((r) => ({
    id: r.id,
    name: r.name || '',
    count: Math.max(1, Number(r.count) || 1),
    rotate: Array.isArray(r.rotate) ? r.rotate : [], // 毎月ローテーションで1人を固定する曜日
  }));
  for (const k of ['excludeWeekdays', 'excludeDates', 'ngPairs']) if (!Array.isArray(s[k])) s[k] = [];
  return s;
}

export function load() {
  try {
    const txt = localStorage.getItem(KEY);
    if (txt) return normalize(JSON.parse(txt));
  } catch (e) {
    console.warn('保存データを読み込めませんでした', e);
  }
  return defaultState();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('保存できませんでした', e);
    return false;
  }
}

export function clearSaved() {
  try { localStorage.removeItem(KEY); } catch (e) { /* 無視 */ }
}

export function backupFileName() {
  return `touban-backup-${fmt(new Date())}.json`;
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(normalize(JSON.parse(reader.result)));
      } catch (e) {
        reject(new Error('JSONファイルの形式が正しくありません'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
