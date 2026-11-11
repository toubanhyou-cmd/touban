// 日本の祝日を計算で求める（2007年以降の祝日法に対応。春分・秋分は2099年まで有効な近似式）
// 祝日法が改正されたときは、このファイルを修正してください。
import { fmt, parse, addDays } from './utils.js';

const cache = new Map();

// その月の第n月曜日の日付
function nthMonday(y, m, n) {
  const firstDow = new Date(y, m - 1, 1).getDay();
  return 1 + ((8 - firstDow) % 7) + (n - 1) * 7;
}

const vernal = (y) => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
const autumnal = (y) => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

function holidaysOf(y) {
  if (cache.has(y)) return cache.get(y);
  const h = new Map();
  const add = (m, d, name) => h.set(fmt(new Date(y, m - 1, d)), name);

  add(1, 1, '元日');
  add(1, nthMonday(y, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  add(2, 23, '天皇誕生日');
  add(3, vernal(y), '春分の日');
  add(4, 29, '昭和の日');
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');
  add(7, nthMonday(y, 7, 3), '海の日');
  add(8, 11, '山の日');
  add(9, nthMonday(y, 9, 3), '敬老の日');
  add(9, autumnal(y), '秋分の日');
  add(10, nthMonday(y, 10, 2), 'スポーツの日');
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');

  // 国民の休日：祝日に挟まれた平日
  for (const k of [...h.keys()]) {
    const d = parse(k);
    const mid = addDays(d, 1);
    if (h.has(fmt(addDays(d, 2))) && !h.has(fmt(mid)) && mid.getDay() !== 0) h.set(fmt(mid), '国民の休日');
  }

  // 振替休日：祝日が日曜なら、その後の最初の祝日でない日
  for (const k of [...h.keys()].sort()) {
    const d = parse(k);
    if (d.getDay() !== 0) continue;
    let n = addDays(d, 1);
    while (h.has(fmt(n))) n = addDays(n, 1);
    h.set(fmt(n), '振替休日');
  }

  cache.set(y, h);
  return h;
}

// 'YYYY-MM-DD' → 祝日名（祝日でなければ null）
export function holidayName(key) {
  return holidaysOf(Number(key.slice(0, 4))).get(key) || null;
}
