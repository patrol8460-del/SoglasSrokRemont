/* Утилиты: даты (ДД.ММ.ГГГГ <-> ISO), id, нормализация строк */

let seq = 0;
export function genId(prefix = 'id'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function parseRuDate(s: string | null | undefined): Date | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function parseAnyDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) {
    const utcMs = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utcMs);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const s = String(v).trim();
  const ru = parseRuDate(s.replace(/\//g, '.'));
  if (ru) return ru;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const dt = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

export function isoToRu(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export function diffDays(aIso: string, bIso: string): number {
  const ms = isoToDate(bIso).getTime() - isoToDate(aIso).getTime();
  return Math.round(ms / 86400000);
}

export function nowIsoDateTime(): string {
  const d = new Date();
  return `${dateToIso(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function normStr(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function isValidTime(s: string | null | undefined): boolean {
  if (!s || String(s).trim() === '') return true;
  return /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(s).trim());
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (d > 1 && d < 5) return few;
  if (d === 1) return one;
  return many;
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('ru-RU', { maximumFractionDigits: digits });
}
