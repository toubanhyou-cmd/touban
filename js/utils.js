// 共通の小さな関数
export const WD = ['日', '月', '火', '水', '木', '金', '土'];

export const pad = (n) => String(n).padStart(2, '0');

// Date → 'YYYY-MM-DD'（ローカル時刻）
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 'YYYY-MM-DD' → Date
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const ymLabel = (ym) => {
  const [y, m] = ym.split('-');
  return `${y}年${Number(m)}月`;
};

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = (prefix) => prefix + Math.random().toString(36).slice(2, 9);

// 種（seed）を決めると同じ乱数列になる乱数生成器
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
