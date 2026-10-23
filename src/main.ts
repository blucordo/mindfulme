import './style.css';
import {
  authenticateUser, saveDiaryEntry, updateDiaryEntry, deleteDiaryEntry, getDiaryEntries, type Entry,
} from './lib/api';

type View = 'home' | 'diary' | 'stats' | 'tips' | 'goals' | 'settings';
type Ser = { v: number | null; l: string };
const app = document.getElementById('app')!;
const ls = (k: string, d = '') => localStorage.getItem(k) ?? d;

const S = {
  uid: localStorage.getItem('uid'), name: ls('name'), entries: [] as Entry[], view: 'home' as View,
  year: new Date().getFullYear(), day: '', mf: '', anim: '' as '' | 'page' | 'pix', sel: '', loading: false, reg: false, error: '', busy: false,
  per: '7', q: '', fm: '', ft: '', goal: +ls('goal', '3'), accent: ls('accent', '#4a90e2'), refocus: false,
};

// ---------- utils ----------
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const esc = (s = '') => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => parse(k).toLocaleDateString('ru-RU', o);
const full = (k: string) => fmt(k, { day: 'numeric', month: 'long', year: 'numeric' });
const avg = (a: Entry[]) => a.reduce((s, e) => s + e.score, 0) / a.length;
const byDay = (l = S.entries) => { const m: Record<string, Entry[]> = {}; l.forEach(e => (m[e.dateStr] ||= []).push(e)); return m; };
S.sel = key(new Date());

const EMOS = [
  { k: 'joy', l: 'Радость', s: 5, c: '#4cbf7a' }, { k: 'calm', l: 'Спокойствие', s: 4.2, c: '#5db6f2' },
  { k: 'content', l: 'Удовлетворённость', s: 3.6, c: '#f6d04d' }, { k: 'anx', l: 'Тревога', s: 2.4, c: '#f58b3c' },
  { k: 'sad', l: 'Грусть', s: 1.8, c: '#9b82dc' }, { k: 'anger', l: 'Злость', s: 1.4, c: '#ef5b57' },
];
// Старые записи хранили эмодзи — читаем их через \u-коды, в интерфейсе эмодзи не показываются
const LEGACY: Record<string, string> = {
  '\u{1F60A}': 'joy', '\u{1F60C}': 'calm', '\u{1F642}': 'content', '\u{1F610}': 'content',
  '\u{1F630}': 'anx', '\u{1F631}': 'anx', '\u{1F61E}': 'sad', '\u{1F620}': 'anger',
};
const emo = (e: string) => EMOS.find(x => x.k === e) || EMOS.find(x => x.k === LEGACY[e]) || EMOS[2];
const STOPS = ['#9b82dc', '#5aa2ec', '#f6d04d', '#8fd36b', '#4cbf7a'];
function sc(v: number) {
  const t = Math.min(4, Math.max(0, v - 1)), i = Math.min(3, Math.floor(t)), f = t - i;
  const a = [1, 3, 5].map(o => parseInt(STOPS[i].slice(o, o + 2), 16)), b = [1, 3, 5].map(o => parseInt(STOPS[i + 1].slice(o, o + 2), 16));
  return '#' + a.map((x, j) => Math.round(x + (b[j] - x) * f).toString(16).padStart(2, '0')).join('');
}
const FEAT: Record<string, string> = {
  joy: '<circle cx="17" cy="20" r="2.2"/><circle cx="31" cy="20" r="2.2"/><path class="s" d="M15 28Q24 38 33 28"/>',
  calm: '<path class="s" d="M13 21Q17 25 21 21M27 21Q31 25 35 21M19 30Q24 34 29 30"/>',
  content: '<circle cx="17" cy="20" r="2.2"/><circle cx="31" cy="20" r="2.2"/><path class="s" d="M18 30Q24 33 30 30"/>',
  anx: '<circle cx="17" cy="21" r="2.2"/><circle cx="31" cy="21" r="2.2"/><path class="s" d="M12 17L20 14M36 17L28 14M18 33Q24 29 30 33"/>',
  sad: '<circle cx="17" cy="21" r="2.2"/><circle cx="31" cy="21" r="2.2"/><path class="s" d="M16 35Q24 26 32 35"/>',
  anger: '<circle cx="17" cy="22" r="2.2"/><circle cx="31" cy="22" r="2.2"/><path class="s" d="M12 14L21 19M36 14L27 19M17 34Q24 28 31 34"/>',
};
const face = (e: string, size = 44) => { const m = emo(e); return `<span class="face" style="--c:${m.c};width:${size}px;height:${size}px"><svg viewBox="0 0 48 48" width="${size * .82}" height="${size * .82}" fill="#3a2f2a" fill-opacity=".78" stroke="none" style="--x:0">${FEAT[m.k].replace(/class="s"/g, 'fill="none" stroke="#3a2f2a" stroke-opacity=".78" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"')}</svg></span>`; };
const pill = (e: string) => `<span class="pill" style="--c:${emo(e).c}">${face(e, 16)}${emo(e).l}</span>`;

const TAGICO: Record<string, string> = { Работа: 'briefcase', Учёба: 'book', Спорт: 'activity', Сон: 'moon', Еда: 'utensils', Семья: 'home', Друзья: 'users', Отдых: 'headphones', Прогулка: 'leaf', Здоровье: 'pill' };
const tg = (t: string) => `<span class="tg">${ico(TAGICO[t] || 'tag', 'sm')}${esc(t)}</span>`;
const allTags = (x: string[] = []) => [...new Set([...Object.keys(TAGICO), ...S.entries.flatMap(e => e.tags), ...x])];
const ICON: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  diary: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>', stats: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  tips: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>', chev: '<path d="M6 9l6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-2.93 1.41-1.41m11.32-11.32 1.41-1.41M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41"/>',
  trend: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>',
  wind: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2M17.5 8a2.5 2.5 0 1 1 2 4H2M9.8 4.4A2 2 0 1 1 11 8H2"/>',
  pen: '<path d="M12 20h9"/><path d="M16.38 3.62a2.12 2.12 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
  sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
};

const ico = (n: string, c = '') => `<svg class="ico ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const NAV: [View, string][] = [['home', 'Главная'], ['diary', 'Дневник'], ['stats', 'Аналитика'], ['tips', 'Рекомендации'], ['goals', 'Цели'], ['settings', 'Настройки']];
const TAB: [View, string][] = [['home', 'Главная'], ['diary', 'Дневник'], ['stats', 'Аналитика'], ['tips', 'Советы'], ['goals', 'Цели']];
const LOGO = `<svg viewBox="0 0 40 40" width="38" height="38"><path d="M20 5c4 5 6 11 0 23-6-12-4-18 0-23z" fill="#567aa8"/><path d="M7 13c7 0 12 5 13 15C10 28 5 22 7 13z" fill="#7d9bc4"/><path d="M33 13c-7 0-12 5-13 15 10 0 15-6 13-15z" fill="#7d9bc4"/><path d="M20 36c-6 0-11-3-13-7 5 1 9 2 13 2s8-1 13-2c-2 4-7 7-13 7z" fill="#a6bbd9"/></svg>`;

function toast(msg: string, label?: string, fn?: () => void) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button>${label}</button>` : ''}`;
  t.querySelector('button')?.addEventListener('click', () => { fn?.(); t.remove(); });
  document.body.appendChild(t); setTimeout(() => t.remove(), label ? 6000 : 2400);
}
function download(name: string, text: string, mime: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const shrink = (f: File) => new Promise<string>((ok, no) => {
  const i = new Image();
  i.onload = () => {
    const r = Math.min(1, 480 / Math.max(i.width, i.height)), c = document.createElement('canvas');
    c.width = Math.round(i.width * r); c.height = Math.round(i.height * r);
    c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(i.src); ok(c.toDataURL('image/jpeg', .72));
  };
  i.onerror = () => no(new Error('img')); i.src = URL.createObjectURL(f);
});

// ---------- analytics ----------
const inDays = (n: number, l = S.entries) => { const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - n + 1); return l.filter(e => parse(e.dateStr) >= t); };
const balance = (l: Entry[]) => (l.length ? avg(l) * 2 : 0);
const balLabel = (v: number) => (v >= 8 ? 'Отличное' : v >= 6.5 ? 'Хорошее' : v >= 5 ? 'Ровное' : v >= 3.5 ? 'Непростое' : 'Тяжёлое');
function streakOf(days: Record<string, Entry[]>) {
  let s = 0; const d = new Date(); if (!days[key(d)]) d.setDate(d.getDate() - 1);
  while (days[key(d)]) { s++; d.setDate(d.getDate() - 1); } return s;
}
const WDP = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
const wdi = (e: Entry) => (parse(e.dateStr).getDay() + 6) % 7;
function insights() {
  const out: [string, string][] = [], L = S.entries;
  const parts = [['утрам', 0, 12], ['дням', 12, 18], ['вечерам', 18, 24]] as const; let best: [string, string, number] | null = null;
  parts.forEach(([n, a, b]) => {
    const l = L.filter(e => { const h = parseInt(e.time); return !isNaN(h) && h >= a && h < b; }); if (l.length < 3) return;
    const c: Record<string, number> = {}; l.forEach(e => (c[emo(e.emotion).k] = (c[emo(e.emotion).k] || 0) + 1));
    const [k, v] = Object.entries(c).sort((x, y) => y[1] - x[1])[0], p = v / l.length;
    if (!best || p > best[2]) best = [n, k, p];
  });
  if (best) { const b = best as [string, string, number]; out.push(['sun', `Ты чаще всего чувствуешь ${EMOS.find(x => x.k === b[1])!.l.toLowerCase()} по ${b[0]} (в ${Math.round(b[2] * 100)}% случаев).`]); }
  const neg = [0, 1, 2, 3, 4, 5, 6].map(i => { const l = L.filter(e => wdi(e) === i); return { i, n: l.length, p: l.filter(e => e.score < 3).length / (l.length || 1) }; }).filter(x => x.n >= 2 && x.p > 0).sort((a, b) => b.p - a.p)[0];
  if (neg) out.push(['trend', `Сложнее всего тебе по ${WDP[neg.i]}: ${Math.round(neg.p * 100)}% записей с тревогой, грустью или злостью.`]);
  if (L.length >= 4) {
    const o = avg(L), t = allTags().flatMap(x => { const l = L.filter(e => e.tags.includes(x)); return l.length >= 2 ? [{ x, d: avg(l) - o }] : []; }).sort((a, b) => b.d - a.d)[0];
    if (t && t.d > 0.1) out.push(['heart', `Ты лучше себя чувствуешь, когда в записи есть «${t.x}».`]);
  }
  return out;
}
function recs() {
  const w = inDays(7), neg = w.length ? w.filter(e => e.score < 3).length / w.length : 0, r: [string, string][] = [];
  if (neg > .4) r.push(['wind', 'Попробуй дыхание 4–7–8: две минуты помогают успокоиться.']);
  if (!streakOf(byDay())) r.push(['pen', 'Сделай короткую запись сегодня — одной эмоции достаточно.']);
  r.push(['sparkles', 'Попробуй практику благодарности (3 минуты в день).']);
  if (!inDays(14).some(e => e.tags.includes('Прогулка'))) r.push(['leaf', 'Больше времени на свежем воздухе — это снижает уровень тревоги.']);
  r.push(['moon', 'Обрати внимание на сон — он влияет на твоё настроение.']);
  r.push(['headphones', 'Выдели 15 минут на любимое занятие без телефона.']);
  return r;
}
const items = (l: [string, string][], empty: string) => l.length ? l.map(([i, t]) => `<div class="ins">${ico(i)}<span>${t}</span></div>`).join('') : `<div class="empty">${empty}</div>`;

// ---------- pieces ----------
function scene(kind: 'mt' | 'fl', text: string, cls: string, st = '') {
  const bg = kind === 'mt' ? 'linear-gradient(180deg,#7f9bc0 0%,#b3b9c9 55%,#d5c9c6 100%)' : 'linear-gradient(180deg,#e9edf1 0%,#d9e3d5 100%)';
  const art = kind === 'mt'
    ? '<path d="M0 100V70l24-16 20 12 28-26 30 24 24-14 24 20v30z" fill="#6f8f7e" opacity=".75"/><path d="M0 100V82l30-14 26 10 34-18 36 20 34-10v30z" fill="#3f6b57"/>'
    : [[170, 88, 15], [128, 96, 11], [188, 60, 10], [100, 104, 9]].map(([x, y, r]) => `<g transform="translate(${x} ${y})">${[0, 45, 90, 135].map(a => `<ellipse rx="${r}" ry="${r / 3.2}" fill="#fff" transform="rotate(${a})" opacity=".95"/>`).join('')}<circle r="${r / 4}" fill="#f2c94c"/></g>`).join('') + '<path d="M0 120V108c40-8 80-2 120 0s60-6 90-4v16z" fill="#a9c79a" opacity=".8"/>';
  return `<div class="scene ${cls}" style="background:${bg};${st}"><svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${art}</svg>
    <div style="position:relative;padding:22px"><p style="${kind === 'fl' ? 'color:#2c3e50' : ''}">${text}</p>
    <svg class="heart" viewBox="0 0 24 24" style="${kind === 'fl' ? 'fill:#9aa6bb' : ''}"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.800-8 11-8 11z"/></svg></div></div>`;
}

function line(ser: Ser[]) {
  const W = 640, H = 230, L = 34, n = ser.length, X = (i: number) => L + 22 + (i * (W - L - 44)) / Math.max(n - 1, 1), Y = (v: number) => 14 + (5 - v) / 4 * (H - 62);
  const pts = ser.flatMap((p, i) => (p.v == null ? [] : [{ x: X(i), y: Y(p.v), c: sc(p.v) }]));
  if (pts.length < 2) return `<div class="empty">Нужны записи минимум за два разных дня, чтобы построить график</div>`;
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) { const mx = (pts[i - 1].x + pts[i].x) / 2; d += ` C${mx} ${pts[i - 1].y} ${mx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`; }
  const f = pts[0], l = pts[pts.length - 1], step = Math.ceil(n / 7);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Динамика настроения"><defs>
    <linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="${f.x}" x2="${l.x}" y1="0" y2="0">${pts.map(p => `<stop offset="${(p.x - f.x) / (l.x - f.x)}" stop-color="${p.c}"/>`).join('')}</linearGradient>
    <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb4f0" stop-opacity=".22"/><stop offset="1" stop-color="#7fb4f0" stop-opacity=".02"/></linearGradient></defs>
    ${[5, 4, 3, 2, 1].map(v => `<line x1="${L + 8}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e8edf5"/><circle cx="12" cy="${Y(v)}" r="7" fill="${sc(v)}"/>`).join('')}
    ${ser.map((s, i) => `<line x1="${X(i)}" x2="${X(i)}" y1="${Y(5)}" y2="${Y(1)}" stroke="#eef2f8"/>${i % step === 0 ? `<text x="${X(i)}" y="${H - 14}" text-anchor="middle" font-size="12" fill="#8794ab">${s.l}</text>` : ''}`).join('')}
    <path d="${d} L${l.x} ${Y(1)} L${f.x} ${Y(1)}Z" fill="url(#ag)"/><path d="${d}" fill="none" stroke="url(#lg)" stroke-width="2.6" stroke-linecap="round"/>
    ${pts.length < 45 ? pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${p.c}" stroke="#fff" stroke-width="2"/>`).join('') : ''}</svg>`;
}
function series(n: number, all = S.entries): Ser[] {
  const now = new Date(), days = byDay(all), s: Ser[] = [];
  if (n === 365) for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), p = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, l = all.filter(e => e.dateStr.startsWith(p));
    s.push({ v: l.length ? avg(l) : null, l: d.toLocaleDateString('ru-RU', { month: 'short' }) });
  } else for (let i = n - 1; i >= 0; i--) {
    const k = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    s.push({ v: days[k] ? avg(days[k]) : null, l: fmt(k, { day: 'numeric', month: 'short' }).replace('.', '') });
  }
  return s;
}
const perSeg = (big = false) => `<div class="seg ${big ? 'big' : ''}">${[['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней']].concat(big ? [['365', 'Год']] : []).map(([v, l]) => `<button data-act="per" data-v="${v}" class="${S.per === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;

function row(e: Entry) {
  return `<div class="er" data-act="edit" data-v="${e.id}" role="button" tabindex="0"><div class="ed">${full(e.dateStr)}</div>
    <div class="eb">${pill(e.emotion)}<p>${esc(e.comment || e.action)}</p></div>
    ${e.photo ? `<img class="th" src="${e.photo}" alt="">` : '<span></span>'}<button class="more" aria-label="Открыть запись">•••</button></div>`;
}
const table = (l: Entry[], empty: string) => l.length ? l.map(row).join('') : `<div class="empty">${empty}</div>`;

// ---------- views ----------
function authView() {
  app.innerHTML = `<div class="auth"><div class="card pad" style="width:100%;max-width:400px;padding:30px;display:flex;flex-direction:column;gap:16px">
    <div style="text-align:center"><div style="display:grid;place-items:center;margin-bottom:10px">${LOGO.replace('38', '56').replace('38', '56')}</div><h1 class="h1" style="font-size:26px">MindfulMe</h1><p class="cap" style="margin-top:4px">Твой дневник эмоций</p></div>
    <div class="seg big" style="display:grid;grid-template-columns:1fr 1fr"><button data-act="mode" data-v="0" class="${S.reg ? '' : 'on'}">Вход</button><button data-act="mode" data-v="1" class="${S.reg ? 'on' : ''}">Регистрация</button></div>
    <input id="a-name" class="input" placeholder="Имя" autocomplete="username" value="${esc(S.name)}">
    <input id="a-pin" class="input" type="password" inputmode="numeric" maxlength="6" placeholder="PIN, 4–6 цифр" autocomplete="${S.reg ? 'new-password' : 'current-password'}" style="text-align:center;letter-spacing:.3em">
    <p class="err" id="a-err" role="alert">${esc(S.error)}</p>
    <button class="btn p" data-act="auth" id="a-go">${S.reg ? 'Создать аккаунт' : 'Войти'}</button></div></div>`;
}

function home() {
  const k = key(new Date()), w = inDays(30), cnt = (e: { k: string }) => w.filter(x => emo(x.emotion).k === e.k).length, b = balance(w), C = 2 * Math.PI * 44;
  return `<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
  <section class="min-w-0 flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4"><div><h1 class="h1">Привет, ${esc(S.name)}!</h1>
      <p class="sub max-sm:text-sm">Здесь ты можешь отслеживать своё эмоциональное состояние, находить закономерности и заботиться о себе.</p></div>
      <button class="datecard max-md:hidden" data-act="today"><span><b>Сегодня</b><span>${full(k)}</span></span>${ico('cal')}</button></div>
    <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
      <div class="card pad"><div class="hd"><h2 class="ct">Как ты себя чувствуешь?</h2><span class="cap">за 30 дней</span></div>
        <div class="feel">${EMOS.map(m => `<button class="fb" style="--c:${m.c}" data-act="new" data-v="${k}" data-m="${m.k}">${face(m.k, 46)}<span>${m.l}</span><b>${cnt(m)}</b></button>`).join('')}</div></div>
      <div class="card pad text-center"><h2 class="ct text-left">Общий баланс</h2>
        <div class="rng"><svg viewBox="0 0 116 116" width="116" height="116"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd36b"/><stop offset="1" stop-color="#4cbf7a"/></linearGradient></defs>
          <circle cx="58" cy="58" r="44" fill="none" stroke="#e3f1e8" stroke-width="11"/>
          <circle class="v" cx="58" cy="58" r="44" fill="none" stroke="url(#rg)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - b / 10)}" style="--C:${C}"/></svg>
          <div class="c"><span>${w.length ? b.toFixed(1) : '—'}<small>/10</small></span></div></div>
        <p class="cap">${w.length ? `${balLabel(b)} эмоциональное состояние` : 'Добавь первую запись'}</p></div></div>
    <div class="card pad"><div class="hd"><h2 class="ct">Динамика настроения</h2>${perSeg()}</div>${line(series(+S.per))}</div>
    <div class="card"><div class="cardhd" style="justify-content:space-between"><h2 class="ct">Последние записи</h2><button class="link" data-act="nav" data-v="diary">Все записи →</button></div>
      ${S.entries.slice(0, 4).map((e, i) => `<div class="${i > 2 ? 'mhide' : ''}" style="display:contents">${row(e)}</div>`).join('') || '<div class="empty">Пока пусто. Нажми на эмоцию выше — запись займёт пару секунд.</div>'}</div>
  </section>
  <aside class="flex flex-col gap-5 min-w-0">
    <div class="card"><div class="cardhd">${ico('tips')}Твои инсайты</div>${items(insights().slice(0, 3), 'Добавь ещё несколько записей с указанием времени — и здесь появятся закономерности.')}</div>
    <div class="card"><div class="cardhd">${ico('sparkles')}Рекомендации</div>${items(recs().slice(0, 3), '')}</div>
    ${scene('fl', 'Забота о своём эмоциональном состоянии —<br>это не роскошь, а необходимость.', 'max-xl:hidden', 'min-height:270px')}
  </aside></div>`;
}

function pixels() {
  const yr = S.year, yd = byDay(S.entries.filter(e => e.dateStr.startsWith(String(yr)))), tk = key(new Date());
  let px = '<span></span>' + Array.from({ length: 12 }, (_, m) => {
    const n = new Date(yr, m, 1).toLocaleDateString('ru-RU', { month: 'long' }), k = `${yr}-${pad(m + 1)}`;
    return `<button class="pm ${S.mf === k ? 'on' : ''}" data-act="mon" data-v="${k}" aria-label="${n}" title="${n}">${n[0].toUpperCase()}</button>`;
  }).join('');
  for (let d = 1; d <= 31; d++) {
    px += `<span>${d === 1 || d % 5 === 0 ? d : ''}</span>`;
    for (let m = 0; m < 12; m++) {
      if (d > new Date(yr, m + 1, 0).getDate()) { px += '<i></i>'; continue; }
      const k = `${yr}-${pad(m + 1)}-${pad(d)}`, l = yd[k];
      px += `<button class="pd ${k === tk ? 'td' : ''} ${k === S.day ? 'sl' : ''}" style="--i:${m + d}${l ? `;background:${sc(avg(l))}` : ''}" data-act="day" data-v="${k}" aria-label="${full(k)}${l ? `, записей: ${l.length}` : ''}" title="${full(k)}"></button>`;
    }
  }
  return `<div class="card pad"><div class="hd" style="margin-bottom:6px"><div class="flex items-center gap-1"><button class="round sm" data-act="yr" data-v="-1" aria-label="Прошлый год">${ico('left')}</button><h2 class="ct yr">${yr}</h2><button class="round sm" data-act="yr" data-v="1" aria-label="Следующий год">${ico('right')}</button></div></div>
    <p class="cap mb-4">Нажми на день или на букву месяца — справа появятся записи.</p><div class="px">${px}</div>
    <div class="lgd"><span>Тяжело</span><i style="background:linear-gradient(90deg,${STOPS.join(',')})"></i><span>Хорошо</span></div></div>`;
}

function diary() {
  const q = S.q.toLowerCase();
  const f = S.entries.filter(e => (!S.day || e.dateStr === S.day) && (!S.mf || e.dateStr.startsWith(S.mf)) && (!S.fm || emo(e.emotion).k === S.fm) && (!S.ft || e.tags.includes(S.ft)) &&
    (!q || (e.action + ' ' + e.comment + ' ' + e.tags.join(' ') + ' ' + emo(e.emotion).l).toLowerCase().includes(q)));
  const used = [...new Set(S.entries.flatMap(e => e.tags))];
  const scope = S.day ? full(S.day) : S.mf ? parse(S.mf + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : 'Все записи';
  const empty = S.day ? 'В этот день записей нет. Нажми «Добавить».' : S.entries.length ? 'Ничего не найдено. Измени запрос или фильтры.' : 'Записей пока нет.';
  return `<div class="flex items-center justify-between gap-3 flex-wrap mb-5"><h1 class="h1">Дневник</h1><button class="btn p max-sm:hidden" data-act="new" data-v="${S.day || S.sel}">Новая запись</button></div>
  <div class="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">${pixels()}
    <div class="min-w-0"><div class="chips sx mb-3"><button class="chip ${S.fm ? '' : 'on'}" data-act="fm" data-v="">Все</button>${EMOS.map(m => `<button class="chip ${S.fm === m.k ? 'on' : ''}" data-act="fm" data-v="${m.k}">${face(m.k, 20)}${m.l}</button>`).join('')}</div>
      ${used.length ? `<div class="chips sx mb-4">${used.map(t => `<button class="chip ${S.ft === t ? 'on' : ''}" data-act="ft" data-v="${esc(t)}">${tg(t)}</button>`).join('')}</div>` : ''}
      <div class="card"><div class="cardhd"><span class="ct cap1">${scope}</span><span class="cap">${f.length}</span>${S.day || S.mf ? '<button class="chip sm" data-act="clr">Показать все</button>' : ''}<button class="btn sm p" style="margin-left:auto" data-act="new" data-v="${S.day || S.sel}">Добавить</button></div>
        <div id="dl">${table(f, empty)}</div></div></div></div>`;
}

function stats() {
  const n = +S.per, L = n === 365 ? inDays(365) : inDays(n), over = L.length ? avg(L) : 0;
  const wd = [0, 1, 2, 3, 4, 5, 6].map(i => L.filter(e => wdi(e) === i));
  const cnt = EMOS.map(m => L.filter(e => emo(e.emotion).k === m.k).length);
  const imp = allTags().flatMap(t => { const l = L.filter(e => e.tags.includes(t)); return l.length >= 2 ? [{ t, d: avg(l) - over }] : []; }).sort((a, b) => b.d - a.d);
  return `<div class="flex items-center justify-between gap-3 flex-wrap mb-5"><h1 class="h1">Аналитика</h1>${perSeg(true)}</div>
  ${L.length ? `<div class="flex flex-col gap-5"><div class="card pad"><div class="hd"><h2 class="ct">Динамика настроения</h2><span class="cap">баланс ${(over * 2).toFixed(1)}/10 · записей ${L.length}</span></div>${line(series(n))}</div>
    <div class="grid gap-5 md:grid-cols-2"><div class="card pad"><h2 class="ct mb-4">По дням недели</h2><div class="bars">${wd.map((l, i) => `<div><i style="height:${l.length ? Math.round(avg(l) / 5 * 90) : 5}px;${l.length ? `background:${sc(avg(l))}` : ''}"></i>${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}</div>`).join('')}</div></div>
      <div class="card pad"><h2 class="ct">Эмоции</h2><div class="dist">${cnt.map((c, i) => c ? `<i style="flex:${c};background:${EMOS[i].c}"></i>` : '').join('')}</div>
        <div class="leg">${cnt.map((c, i) => `<span style="display:inline-flex;align-items:center;gap:6px">${face(EMOS[i].k, 18)}${EMOS[i].l} ${c}</span>`).join('')}</div></div></div>
    <div class="card pad"><h2 class="ct">Что влияет на настроение</h2><p class="cap" style="margin:4px 0 8px">Как меняется настроение, когда активность есть в записи</p>
      ${imp.length ? imp.map(x => { const w = Math.min(Math.abs(x.d) / 2, 1) * 50; return `<div class="imp"><span style="width:124px;white-space:nowrap">${tg(x.t)}</span><span class="bar"><i style="left:${x.d >= 0 ? 50 : 50 - w}%;width:${w}%;background:${x.d >= 0 ? '#4cbf7a' : '#ef5b57'}"></i></span><span class="cap" style="width:44px;text-align:right">${x.d >= 0 ? '+' : ''}${(x.d * 2).toFixed(1)}</span></div>`; }).join('') : '<div class="empty">Отмечай активности в записях — нужно минимум две записи на каждую.</div>'}</div></div>`
    : '<div class="card empty">За этот период записей нет</div>'}`;
}

function tips() {
  return `<h1 class="h1 mb-5">Рекомендации</h1><div class="grid gap-5 lg:grid-cols-2 items-start">
    <div class="card"><div class="cardhd">${ico('tips')}Твои инсайты</div>${items(insights(), 'Нужно хотя бы 3–4 записи со временем — тогда появятся закономерности.')}</div>
    <div class="card"><div class="cardhd">${ico('sparkles')}Что попробовать</div>${items(recs(), '')}</div></div>`;
}

function goals() {
  const days = byDay(), st = streakOf(days), now = new Date(), td = (days[key(now)] || []).length, C = 2 * Math.PI * 44;
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const wk = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = new Date(mon); d.setDate(mon.getDate() + i); return { l: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i], on: !!days[key(d)] }; });
  const ach: [string, number, number][] = [['7 дней подряд', st, 7], ['30 дней подряд', st, 30], ['25 записей', S.entries.length, 25], ['Все шесть эмоций', new Set(S.entries.map(e => emo(e.emotion).k)).size, 6]];
  return `<h1 class="h1 mb-5">Цели</h1><div class="grid gap-5 lg:grid-cols-2 items-start">
    <div class="card pad"><h2 class="ct">Цель на сегодня</h2><div class="rng"><svg viewBox="0 0 116 116" width="116" height="116"><circle cx="58" cy="58" r="44" fill="none" stroke="#e8eef8" stroke-width="11"/>
      <circle class="v" cx="58" cy="58" r="44" fill="none" stroke="var(--brand)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(td / S.goal, 1))}" style="--C:${C}"/></svg><div class="c"><span>${td}<small>/${S.goal}</small></span></div></div>
      <p class="cap text-center mb-4">${td >= S.goal ? 'Цель выполнена — отличная работа!' : 'Записей сегодня'}</p><label class="lbl">Записей в день</label>
      <div class="seg big">${[1, 2, 3, 5].map(g => `<button data-act="goal" data-v="${g}" class="${g === S.goal ? 'on' : ''}">${g}</button>`).join('')}</div></div>
    <div class="flex flex-col gap-5"><div class="card pad"><div class="hd"><h2 class="ct">Серия: ${st} дн.</h2><span class="cap">эта неделя</span></div>
      <div class="flex justify-between">${wk.map(d => `<div class="text-center cap"><div class="face" style="--c:${d.on ? '#4cbf7a' : '#dfe6f1'};width:34px;height:34px;color:#fff;font-weight:700">${d.on ? ico('check', 'sm') : ''}</div><div style="margin-top:6px">${d.l}</div></div>`).join('')}</div></div>
      <div class="card pad"><h2 class="ct mb-3">Достижения</h2>${ach.map(([t, v, m]) => `<div style="padding:10px 0"><div class="flex justify-between text-sm mb-2"><span class="tg">${v >= m ? ico('trophy', 'sm') : ''}${t}</span><span class="cap">${Math.min(v, m)}/${m}</span></div><div class="prog"><i style="width:${Math.min(v / m, 1) * 100}%"></i></div></div>`).join('')}</div></div></div>`;
}

function settings() {
  return `<h1 class="h1 mb-5">Настройки</h1><div class="grid gap-5 lg:grid-cols-2 items-start">
    <div class="card pad flex flex-col gap-5"><div class="flex items-center gap-4"><span class="ava"><b style="width:56px;height:56px;font-size:20px">${esc((S.name[0] || '?').toUpperCase())}</b></span>
      <div><div class="ct">${esc(S.name)}</div><div class="cap">Записей: ${S.entries.length}</div></div></div>
      <div><label class="lbl">Цвет акцента</label><div class="chips">${['#4a90e2', '#5e5ce6', '#a35bd6', '#e5517a', '#f08c2e', '#2fa86a'].map(c => `<button class="sw ${c === S.accent ? 'on' : ''}" style="background:${c}" data-act="accent" data-v="${c}" aria-label="${c}"></button>`).join('')}</div></div></div>
    <div class="card pad flex flex-col gap-3"><h2 class="ct">Данные</h2><p class="cap">Скачай все записи, чтобы сохранить их у себя.</p>
      <div class="two"><button class="btn" data-act="json">Экспорт JSON</button><button class="btn" data-act="csv">Экспорт CSV</button></div>
      <button class="btn d mt-3" data-act="logout">Выйти из аккаунта</button><p class="cap mt-2">Горячие клавиши: N — новая запись, / — поиск, 1–5 — разделы.</p></div></div>`;
}

function shell() {
  const T = (l: [View, string][], c: string) => l.map(([v, t]) => `<button class="${c} ${S.view === v ? 'on' : ''}" data-act="nav" data-v="${v}">${ico(v)}${c === 'tab' ? `<span>${t}</span>` : t}</button>`).join('');
  const body = S.loading ? '<div class="flex flex-col gap-5"><div class="skel" style="height:60px;width:50%"></div><div class="skel"></div><div class="skel" style="height:240px"></div></div>' : { home, diary, stats, tips, goals, settings }[S.view]();
  app.innerHTML = `<div class="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <aside class="side hidden lg:flex"><div class="brand">${LOGO}<div><b>MindfulMe</b><span>Твой дневник эмоций</span></div></div><nav>${T(NAV, 'nb')}</nav><div class="flex-1"></div>
      ${scene('mt', 'Ты уже делаешь<br>большое дело —<br>заботишься о себе', '', 'min-height:208px')}</aside>
    <div class="min-w-0"><header class="top"><span class="lg:hidden flex items-center">${LOGO.replace(/38/g, '34')}</span>
      <label class="search">${ico('search')}<input id="gq" type="search" placeholder="Поиск по записям, эмоциям, тегам…" aria-label="Поиск" value="${esc(S.q)}"></label><span class="flex-1 max-lg:hidden"></span>
      <button class="round p max-sm:order-last" data-act="new" data-v="${S.sel}" aria-label="Новая запись">${ico('plus')}</button>
      <button class="round max-sm:hidden" data-act="bell" aria-label="Уведомления">${ico('bell')}</button>
      <button class="ava" data-act="nav" data-v="settings" aria-label="Профиль"><b>${esc((S.name[0] || '?').toUpperCase())}</b><span class="max-sm:hidden">${ico('chev')}</span></button></header>
      <main class="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-12">${body}</main></div>
    <nav class="tabbar lg:hidden">${T(TAB, 'tab')}</nav></div>`;
  if (S.anim) {
    const m = app.querySelector('main')!, px = app.querySelector('.px');
    if (S.anim === 'page') { m.classList.add('enter'); m.querySelectorAll('.h1, .card').forEach((x, i) => (x as HTMLElement).style.setProperty('--d', Math.min(i, 6) * 45 + 'ms')); }
    else px?.classList.add('enter');
    S.anim = '';
  }
  if (S.refocus) { const i = document.getElementById('gq') as HTMLInputElement; i.focus(); i.setSelectionRange(i.value.length, i.value.length); S.refocus = false; }
}

// ---------- sheets ----------
function mount(html: string, onBtn: (b: HTMLElement, el: HTMLElement) => void) {
  const el = document.createElement('div'); el.className = 'scrim';
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`; document.body.appendChild(el);
  const sh = el.querySelector('.sheet') as HTMLElement, gr = el.querySelector('.grab') as HTMLElement;
  const kd = (e: KeyboardEvent) => e.key === 'Escape' && close(), close = () => { el.remove(); document.removeEventListener('keydown', kd); };
  document.addEventListener('keydown', kd); let y0 = 0, dy = 0;
  gr.ontouchstart = e => { y0 = e.touches[0].clientY; sh.style.transition = 'none'; };
  gr.ontouchmove = e => { dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
  gr.ontouchend = () => { sh.style.transition = ''; if (dy > 110) close(); else sh.style.transform = ''; dy = 0; };
  el.onclick = e => { if (e.target === el) return close(); const b = (e.target as HTMLElement).closest('button'); if (b) onBtn(b as HTMLElement, el); };
  return { el, close };
}
const sheetOpen = () => !!document.querySelector('.scrim');

function openSheet(entry?: Entry, date?: string, mood = '') {
  let m = entry ? emo(entry.emotion).k : mood, photo = entry?.photo || '';
  const tags = new Set(entry?.tags || []), now = new Date(), nowT = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const chips = () => allTags([...tags]).map(t => `<button type="button" class="chip ${tags.has(t) ? 'on' : ''}" data-t="${esc(t)}">${tg(t)}</button>`).join('');
  const prev = () => (photo ? `<img class="th" style="width:64px;height:64px" src="${photo}" alt=""><button class="btn sm" data-s="rmp">Убрать фото</button>` : '');
  const { el, close } = mount(`
    <div class="top2"><button class="btn sm" data-s="x">Отмена</button><span class="ct">${entry ? 'Запись' : 'Новая запись'}</span><button class="btn p sm" data-s="save" id="f-save" ${m ? '' : 'disabled'}>Сохранить</button></div>
    <div><label class="lbl">Как ты себя чувствуешь?</label><div class="feel" id="f-emo">${EMOS.map(x => `<button type="button" class="fb ${x.k === m ? 'on' : ''}" style="--c:${x.c}" data-m="${x.k}">${face(x.k, 44)}<span>${x.l}</span></button>`).join('')}</div></div>
    <div><label class="lbl">Что произошло? (необязательно)</label><textarea id="f-comment" class="input" placeholder="Пара слов о дне">${esc(entry?.comment)}</textarea></div>
    <div><label class="lbl">Чем занимался(ась)</label><div class="chips" id="f-tags">${chips()}</div><input id="f-new" class="input" style="margin-top:10px" placeholder="Своя активность — нажми Enter" maxlength="24"></div>
    <div class="two"><div><label class="lbl">Дата</label><input id="f-date" type="date" class="input" value="${entry?.dateStr || date || key(now)}"></div>
      <div><label class="lbl">Фото</label><button class="btn" style="width:100%" data-s="photo">${ico('camera', 'sm')}Добавить</button></div></div>
    <div class="flex items-center gap-3" id="f-prev">${prev()}</div><input id="f-file" type="file" accept="image/*" hidden>
    ${entry ? '<button class="btn d" data-s="del">Удалить запись</button>' : ''}`,
  (b, root) => {
    const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
    if (b.dataset.m) { m = b.dataset.m; q<HTMLButtonElement>('#f-save').disabled = false; root.querySelectorAll('#f-emo .fb').forEach(x => x.classList.toggle('on', x === b)); }
    else if (b.dataset.t) { tags.has(b.dataset.t) ? tags.delete(b.dataset.t) : tags.add(b.dataset.t); q('#f-tags').innerHTML = chips(); }
    else if (b.dataset.s === 'x') close();
    else if (b.dataset.s === 'photo') q<HTMLInputElement>('#f-file').click();
    else if (b.dataset.s === 'rmp') { photo = ''; q('#f-prev').innerHTML = ''; }
    else if (b.dataset.s === 'del') { const old = entry!; run(() => deleteDiaryEntry(S.uid!, old.id), 'Запись удалена', () => saveDiaryEntry(S.uid!, old).then(() => load(false))); }
    else if (b.dataset.s === 'save') {
      const mo = EMOS.find(x => x.k === m)!, dateStr = q<HTMLInputElement>('#f-date').value;
      if (!dateStr) return toast('Укажи дату');
      const d = { action: entry?.action || [...tags][0] || mo.l, emotion: mo.k, score: mo.s, photo, dateStr, time: entry?.time || nowT,
        comment: q<HTMLTextAreaElement>('#f-comment').value.trim(), tags: [...tags] };
      S.sel = dateStr; if (S.day) S.day = dateStr; if (S.mf && !dateStr.startsWith(S.mf)) S.mf = ''; S.year = +dateStr.slice(0, 4);
      run(() => (entry ? updateDiaryEntry(S.uid!, entry.id, d) : saveDiaryEntry(S.uid!, d)), entry ? 'Изменения сохранены' : 'Запись добавлена');
    }
    async function run(fn: () => Promise<unknown>, ok: string, undo?: () => Promise<unknown>) {
      root.querySelectorAll('button').forEach(x => ((x as HTMLButtonElement).disabled = true));
      try { await fn(); close(); await load(false); toast(ok, undo && 'Отменить', undo); }
      catch { toast('Не удалось сохранить. Проверь соединение'); root.querySelectorAll('button').forEach(x => ((x as HTMLButtonElement).disabled = false)); }
    }
  });
  const nt = el.querySelector('#f-new') as HTMLInputElement;
  nt.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault(); const v = nt.value.trim(); if (!v) return; tags.add(v); nt.value = ''; el.querySelector('#f-tags')!.innerHTML = chips(); };
  (el.querySelector('#f-file') as HTMLInputElement).onchange = async e => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { photo = await shrink(f); el.querySelector('#f-prev')!.innerHTML = prev(); } catch { toast('Не удалось загрузить фото'); }
  };
}

// ---------- data & events ----------
const applyAccent = () => document.documentElement.style.setProperty('--brand', S.accent);
const onScroll = () => document.querySelector('.top')?.classList.toggle('sc', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
function render() { applyAccent(); S.uid ? shell() : authView(); onScroll(); }
async function load(skeleton = true) {
  if (skeleton) { try { S.entries = JSON.parse(ls('c:' + S.uid, '[]')); } catch { S.entries = []; } S.loading = !S.entries.length; S.anim = S.loading ? '' : 'page'; render(); }
  try {
    S.entries = await getDiaryEntries(S.uid!);
    try { localStorage.setItem('c:' + S.uid, JSON.stringify(S.entries.map(e => ({ ...e, photo: '' })))); } catch { /* quota */ }
  } catch { toast('Не удалось обновить записи'); }
  S.anim = S.loading ? 'page' : S.anim; S.loading = false; render();
}
function logout() { localStorage.removeItem('c:' + S.uid); localStorage.removeItem('uid'); localStorage.removeItem('name'); S.uid = null; S.entries = []; S.view = 'home'; render(); }
async function submitAuth() {
  if (S.busy) return;
  const name = (document.getElementById('a-name') as HTMLInputElement).value, pin = (document.getElementById('a-pin') as HTMLInputElement).value;
  const btn = document.getElementById('a-go') as HTMLButtonElement; S.busy = true; btn.disabled = true; btn.textContent = 'Проверяем…';
  try {
    const u = await authenticateUser(name, pin, S.reg); S.uid = u.id; S.name = u.name; S.error = '';
    localStorage.setItem('uid', u.id); localStorage.setItem('name', u.name); await load();
  } catch (e: any) { S.error = e?.message || 'Ошибка входа'; S.name = name; render(); } finally { S.busy = false; }
}
const go = (v: View) => { S.view = v; S.anim = 'page'; scrollTo(0, 0); render(); };

app.addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!t) return; const v = t.dataset.v || '';
  switch (t.dataset.act) {
    case 'mode': S.reg = v === '1'; S.error = ''; authView(); break;
    case 'auth': submitAuth(); break;
    case 'nav': go(v as View); break;
    case 'today': S.year = new Date().getFullYear(); S.day = S.sel = key(new Date()); S.mf = ''; go('diary'); break;
    case 'yr': S.year += +v; S.anim = 'pix'; render(); break;
    case 'mon': S.mf = S.mf === v ? '' : v; S.day = ''; render(); break;
    case 'day': S.day = S.day === v ? '' : v; S.mf = ''; S.sel = v; render(); break;
    case 'clr': S.day = ''; S.mf = ''; render(); break;
    case 'per': S.per = v; render(); break;
    case 'fm': S.fm = v; render(); break;
    case 'ft': S.ft = S.ft === v ? '' : v; render(); break;
    case 'new': openSheet(undefined, v, t.dataset.m || ''); break;
    case 'edit': openSheet(S.entries.find(x => x.id === v)); break;
    case 'bell': toast(byDay()[key(new Date())] ? 'Сегодня ты уже сделал(а) запись — так держать' : 'Сегодня ещё нет записей. Как ты себя чувствуешь?'); break;
    case 'goal': S.goal = +v; localStorage.setItem('goal', v); render(); break;
    case 'accent': S.accent = v; localStorage.setItem('accent', v); render(); break;
    case 'json': download('mindfulme.json', JSON.stringify(S.entries.map(e => ({ ...e, photo: undefined })), null, 2), 'application/json'); break;
    case 'csv': {
      const c = (s: string) => `"${s.replace(/"/g, '""')}"`;
      download('mindfulme.csv', '\ufeff' + ['date,time,emotion,score,title,tags,note', ...S.entries.map(e => [e.dateStr, e.time, emo(e.emotion).l, e.score, c(e.action), c(e.tags.join('; ')), c(e.comment)].join(','))].join('\n'), 'text/csv;charset=utf-8'); break;
    }
    case 'logout': logout(); break;
  }
});
app.addEventListener('input', e => {
  const t = e.target as HTMLInputElement; if (t.id !== 'gq') return;
  S.q = t.value.trim();
  S.day = ''; S.mf = ''; if (S.view !== 'diary') { S.view = 'diary'; S.refocus = true; render(); } else render(), S.refocus = false;
  if (document.activeElement?.id !== 'gq') { const i = document.getElementById('gq') as HTMLInputElement; i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }
});
document.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (e.key === 'Enter' && t.closest('.auth') && t.tagName === 'INPUT') return void submitAuth();
  if (e.key === 'Enter' && t.classList.contains('er')) return void t.click();
  if (!S.uid || sheetOpen() || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  if (e.key.toLowerCase() === 'n' || e.key === 'т') { e.preventDefault(); openSheet(undefined, S.sel); }
  else if (e.key >= '1' && e.key <= '6') go(NAV[+e.key - 1][0]);
  else if (e.key === '/') { e.preventDefault(); (document.getElementById('gq') as HTMLInputElement)?.focus(); }
});

S.uid ? load() : render();
