import { db } from './firebase';
import {
  collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs, query, where, deleteField,
} from 'firebase/firestore';

// Эмоции хранятся ключами. Старые записи с эмодзи читаем через \u-коды (в интерфейсе эмодзи нигде не показываются).
export const moodMap: Record<string, number> = {
  joy: 5, calm: 4.2, content: 3.6, anx: 2.4, sad: 1.8, anger: 1.4,
  '\u{1F631}': 1, '\u{1F61E}': 2, '\u{1F610}': 3, '\u{1F642}': 4, '\u{1F60A}': 5,
};

export interface Entry {
  id: string; action: string; emotion: string; score: number;
  comment: string; time: string; dateStr: string; createdAt: string;
  tags: string[]; energy?: number; photo?: string;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const enc = new TextEncoder();

async function userId(name: string) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(name.trim().toLowerCase())));
}

async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 150_000 }, key, 256);
  return hex(bits);
}

/** Возвращает { id, name } — имя нужно для приветствия. */
export async function authenticateUser(name: string, pin: string, isRegister: boolean) {
  name = name.trim();
  if (name.length < 2) throw new Error('Имя — минимум 2 символа');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN — от 4 до 6 цифр');

  const id = await userId(name);
  const ref = doc(db, 'users', id);
  const snap = await getDoc(ref);
  const legacy = await getDocs(query(collection(db, 'users'), where('name', '==', name)));
  const old = legacy.docs.find(d => d.id !== id);

  if (isRegister) {
    if (snap.exists() || old) throw new Error('Это имя уже занято');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    await setDoc(ref, { name, salt, hash: await hashPin(pin, salt), createdAt: new Date().toISOString() });
    return { id, name };
  }

  if (snap.exists()) {
    const u = snap.data();
    if (u.hash !== await hashPin(pin, u.salt)) throw new Error('Неверное имя или PIN');
    return { id, name: u.name as string };
  }
  // Старые аккаунты: PIN хранился открыто — проверяем и сразу переводим на хэш
  if (old && old.data().pin === pin) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    await updateDoc(old.ref, { salt, hash: await hashPin(pin, salt), pin: deleteField() });
    return { id: old.id, name };
  }
  throw new Error('Неверное имя или PIN');
}

type Draft = Pick<Entry, 'action' | 'emotion' | 'comment' | 'time' | 'dateStr' | 'tags'> & { score?: number; photo?: string; energy?: number };
const col = (uid: string) => collection(db, 'users', uid, 'diary');
const body = (d: Draft) => ({ ...d, photo: d.photo || '', score: d.score ?? moodMap[d.emotion] ?? 3 });

export const saveDiaryEntry = (uid: string, d: Draft) =>
  addDoc(col(uid), { ...body(d), createdAt: new Date().toISOString() });

export const updateDiaryEntry = (uid: string, id: string, d: Draft) =>
  updateDoc(doc(db, 'users', uid, 'diary', id), body(d));

export const deleteDiaryEntry = (uid: string, id: string) =>
  deleteDoc(doc(db, 'users', uid, 'diary', id));

export async function getDiaryEntries(uid: string): Promise<Entry[]> {
  const snap = await getDocs(col(uid));
  return snap.docs
    .map(d => ({ tags: [], ...d.data(), id: d.id }) as unknown as Entry)
    .sort((a, b) =>
      b.dateStr.localeCompare(a.dateStr) ||
      (b.time || '').localeCompare(a.time || '') ||
      b.createdAt.localeCompare(a.createdAt));
}
