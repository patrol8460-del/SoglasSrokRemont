import { EQUIPMENT, PLANNER_GROUPS, SHOPS, USERS, loisUsers, seedRequests } from './data';
import type { DB, ProjectRequest, RequestStatus, RepairOperation, AttachedPart } from './types';
import { OTHER_REASON, PHASES, STATUS_LABEL } from './types';
import { dateToIso, diffDays, genId, isValidTime, normStr, nowIsoDateTime, parseAnyDate } from './utils';

export class ApiError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ApiError';
  }
}

const LS_KEY = 'toro_db_v1';
const DB_VERSION = 1;

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && parsed.version === DB_VERSION && Array.isArray(parsed.requests)) return parsed;
    }
  } catch { /* повреждённый JSON */ }
  const fresh: DB = { version: DB_VERSION, requests: seedRequests() };
  saveDB(fresh);
  return fresh;
}

export function saveDB(db: DB): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* квота */ }
}

export function resetDB(): DB {
  const fresh: DB = { version: DB_VERSION, requests: seedRequests() };
  saveDB(fresh);
  return fresh;
}

function clone(db: DB): DB { return JSON.parse(JSON.stringify(db)) as DB; }
function findReq(db: DB, id: string): ProjectRequest {
  const r = db.requests.find((x) => x.id === id);
  if (!r) throw new ApiError('Заявка не найдена');
  return r;
}
function expectStatus(r: ProjectRequest, allowed: RequestStatus[]): void {
  if (!allowed.includes(r.status)) throw new ApiError(`Действие недоступно: статус «${STATUS_LABEL[r.status]}»`);
}
function transition(r: ProjectRequest, to: RequestStatus, by: string, note?: string): void {
  r.history.push({ at: nowIsoDateTime(), by, from: r.status, to, note });
  r.status = to;
}

export function phaseOverdueWarning(simDate: string, stage: 'upload' | 'approval' | 'lobe'): string | null {
  if (stage === 'upload' && simDate > PHASES.uploadUntil) return `Регламентный срок загрузки — до ${PHASES.uploadUntil}`;
  if (stage === 'approval' && simDate > PHASES.approvalUntil) return `Регламентный срок согласования — до ${PHASES.approvalUntil}`;
  if (stage === 'lobe' && simDate > PHASES.lobeUntil) return `Регламентный срок ЛОБЭ — до ${PHASES.lobeUntil}`;
  return null;
}

export const PLAN_HEADERS = [
  'Группа плановиков', 'Номер заказа ТОРО', 'Номер цеха', 'Номер корпуса', 'Код ЕО',
  'Номер единицы оборудования из ист. системы', 'Наименование единицы оборудования', 'Наименование модели',
  'Наименование тех. места', 'Вид работы заказа ТОРО', 'Номер дефектной ведомости',
  'Необходимость проверки норм точности', 'Участок рабочего места', 'Код рабочего места',
  'ФИО исполнителя работ', 'Работа операции (слесарные)', 'Работа операции (станочные)',
  'Работа операции (прочие)', 'Работа операции (общее)', 'Дата начала (ДД.ММ.ГГГГ)',
  'Кол-во дней простоя', 'Точное время начала (ЧЧ:ММ:СС)', 'Точное время окончания (ЧЧ:ММ:СС)',
  'Номер основного средства', 'МВЗ', 'СПП-элемент',
];

export function validatePlanMatrix(m: (string | number)[][]): { validRows: Record<string, string>[]; errors: any[]; unknownHeaders: string[] } {
  return { validRows: [], errors: [], unknownHeaders: [] };
}

export function importPlan(db: DB, rows: Record<string, string>[], by: string): { db: DB; result: { created: number; merged: number; skippedDup: number } } {
  return { db, result: { created: 0, merged: 0, skippedDup: 0 } };
}

export function uppApproveWithParts(db: DB, ids: string[], parts: AttachedPart[], by: string): DB {
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['NEW']);
    r.upp = { decision: 'PARTS', parts, by, at: nowIsoDateTime() };
    transition(r, 'UPP_APPROVED', by);
  }
  saveDB(next);
  return next;
}

export function uppRejectNoParts(db: DB, ids: string[], reason: string, by: string): DB {
  if (!reason.trim()) throw new ApiError('Причина обязательна');
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['NEW']);
    r.upp = { decision: 'NO_PARTS', reason, by, at: nowIsoDateTime() };
    transition(r, 'UPP_RESCHEDULE', by);
  }
  saveDB(next);
  return next;
}

export function plannerSetNewDate(db: DB, ids: string[], newDateIso: string, by: string): DB {
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['UPP_RESCHEDULE']);
    r.plannedStart = newDateIso;
    transition(r, 'NEW', by);
  }
  saveDB(next);
  return next;
}

export function loisApprove(db: DB, ids: string[], dateIso: string | null, executorFio: string, by: string): DB {
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['UPP_APPROVED']);
    r.loisDate = dateIso ?? r.plannedStart;
    const changed = executorFio && executorFio !== r.assignedExecutorFio;
    if (changed) {
      r.lois = { changedFrom: r.assignedExecutorFio, toFio: executorFio, by, at: nowIsoDateTime() };
      r.assignedExecutorFio = executorFio;
      transition(r, 'NEEDS_EXECUTOR', by);
    } else {
      r.lois = { by, at: nowIsoDateTime() };
      transition(r, 'LOBE_REVIEW', by);
    }
  }
  saveDB(next);
  return next;
}

export function loisReject(db: DB, ids: string[], reason: string, comment: string, by: string): DB {
  if (!reason) throw new ApiError('Выберите причину');
  if (reason === OTHER_REASON && !comment.trim()) throw new ApiError('Комментарий обязателен');
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['UPP_APPROVED']);
    r.rejection = { stage: 'ЛОИС', reason, comment, by, at: nowIsoDateTime() };
    transition(r, 'LOIS_REJECTED', by);
  }
  saveDB(next);
  return next;
}

export function executorApprove(db: DB, daysById: Record<string, number>, by: string): DB {
  const next = clone(db);
  for (const [id, days] of Object.entries(daysById)) {
    const r = findReq(next, id);
    expectStatus(r, ['NEEDS_EXECUTOR']);
    if (!isFinite(days) || !Number.isInteger(days) || days < 1) throw new ApiError('Дни простоя: целое число ≥ 1');
    r.downtimeDays = days;
    transition(r, 'LOBE_REVIEW', by);
  }
  saveDB(next);
  return next;
}

export function executorReject(db: DB, ids: string[], reason: string, by: string): DB {
  if (!reason.trim()) throw new ApiError('Причина обязательна');
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['NEEDS_EXECUTOR']);
    r.rejection = { stage: 'ИСПОЛНИТЕЛЬ', reason, by, at: nowIsoDateTime() };
    transition(r, 'EXECUTOR_REJECTED', by);
  }
  saveDB(next);
  return next;
}

export function lobeApprove(db: DB, ids: string[], mode: 'ТЕКУЩАЯ' | 'ДРУГАЯ', dateIso: string | null, by: string): DB {
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['LOBE_REVIEW']);
    const date = mode === 'ДРУГАЯ' ? dateIso : (r.loisDate ?? r.plannedStart);
    if (!date) throw new ApiError('Дата обязательна');
    r.lobe = { decision: mode, date, by, at: nowIsoDateTime() };
    r.agreedDate = date;
    transition(r, 'IN_PLAN', by);
  }
  saveDB(next);
  return next;
}

export function lobeReject(db: DB, ids: string[], reason: string, comment: string, by: string): DB {
  if (!reason) throw new ApiError('Выберите причину');
  if (reason === OTHER_REASON && !comment.trim()) throw new ApiError('Комментарий обязателен');
  const next = clone(db);
  for (const id of ids) {
    const r = findReq(next, id);
    expectStatus(r, ['LOBE_REVIEW']);
    r.rejection = { stage: 'ЛОБЭ', reason, comment, by, at: nowIsoDateTime() };
    transition(r, 'LOBE_REJECTED', by);
  }
  saveDB(next);
  return next;
}

export function startPreparation(db: DB, id: string, by: string): DB {
  const next = clone(db);
  const r = findReq(next, id);
  expectStatus(r, ['IN_PLAN']);
  r.prep = { startedBy: by, startedAt: nowIsoDateTime(), cleaned: false, emptied: false, deenergized: false, comment: '' };
  transition(r, 'PREPARATION', by);
  saveDB(next);
  return next;
}

export function finishPreparation(db: DB, id: string, checklist: { cleaned: boolean; emptied: boolean; deenergized: boolean; comment: string }, by: string): DB {
  if (!checklist.cleaned || !checklist.emptied || !checklist.deenergized) throw new ApiError('Отметьте все операции');
  const next = clone(db);
  const r = findReq(next, id);
  expectStatus(r, ['PREPARATION']);
  if (r.prep) Object.assign(r.prep, checklist, { doneAt: nowIsoDateTime() });
  transition(r, 'AWAITING_REPAIR', by);
  saveDB(next);
  return next;
}

export function startRepair(db: DB, id: string, by: string, simDate: string): DB {
  const next = clone(db);
  const r = findReq(next, id);
  expectStatus(r, ['AWAITING_REPAIR']);
  r.report = { partsUsed: [], actualPersonnel: [], factStart: simDate, factEnd: '', completedBy: '' };
  transition(r, 'IN_REPAIR', by);
  saveDB(next);
  return next;
}

export function completeRepair(db: DB, id: string, partsUsed: AttachedPart[], actualPersonnel: string[], by: string, simDate: string): DB {
  if (!actualPersonnel.filter(x => x?.trim()).length) throw new ApiError('Укажите персонал');
  const next = clone(db);
  const r = findReq(next, id);
  expectStatus(r, ['IN_REPAIR']);
  if (!r.report) r.report = { partsUsed: [], actualPersonnel: [], factStart: simDate, factEnd: '', completedBy: '' };
  r.report.partsUsed = partsUsed;
  r.report.actualPersonnel = actualPersonnel;
  r.report.factEnd = simDate;
  r.report.completedBy = by;
  transition(r, 'DONE', by);
  saveDB(next);
  return next;
}

export function runScheduler(db: DB, simDateIso: string): { db: DB; autoRejected: ProjectRequest[]; reminders: ProjectRequest[] } {
  const autoRejected: ProjectRequest[] = [];
  const reminders: ProjectRequest[] = [];
  let changed = false;
  const next = clone(db);
  for (const r of next.requests) {
    if (r.status === 'IN_PLAN' && r.agreedDate) {
      const daysLeft = diffDays(simDateIso, r.agreedDate);
      if (daysLeft < 0) {
        r.isAutoRejected = true;
        r.rejection = { stage: 'ЛОБЭ', reason: 'Просрочка подготовки (авто)', by: 'Система', at: nowIsoDateTime() };
        transition(r, 'AUTO_REJECTED', 'Система');
        autoRejected.push(r);
        changed = true;
      } else if (daysLeft <= 3) {
        reminders.push(r);
      }
    }
  }
  if (changed) saveDB(next);
  return { db: changed ? next : db, autoRejected, reminders };
}

export function buildFactRows(requests: ProjectRequest[]): (string | number)[][] {
  return [[...PLAN_HEADERS, 'Факт. начало', 'Факт. конец', 'Запчасти', 'Статус']];
}
