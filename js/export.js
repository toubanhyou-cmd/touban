// CSV・ファイルのダウンロード
import { WD, parse } from './utils.js?v=20261112c';

export function download(filename, text, mime, withBom = false) {
  const blob = new Blob([withBom ? '﻿' + text : text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// 1行＝1日×1係。Excelで開けるようにBOM付きで保存する
export function toCSV(state) {
  const byId = new Map(state.members.map((m) => [m.id, m.name]));
  const rows = [['日付', '曜日', '係', '担当者']];
  for (const k of Object.keys(state.schedule || {}).sort()) {
    const day = state.schedule[k];
    for (const role of state.roles) {
      const names = (day[role.id] || [])
        .slice(0, role.count)
        .map((id) => (id ? byId.get(id) || '(削除)' : '(未割り当て)'));
      rows.push([k, WD[parse(k).getDay()], role.name, names.join('・')]);
    }
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
