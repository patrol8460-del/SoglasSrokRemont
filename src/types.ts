/* ============================================================
 * СХЕМА ДАННЫХ ПРОЦЕССА СОГЛАСОВАНИЯ РЕМОНТОВ (ТИПЫ + STATE MACHINE)
 *
 * State Machine (статусы Проекта Заявки):
 *
 *   IMPORT(Excel) ──> NEW ──УПП "Есть запчасти"──> UPP_APPROVED ──┐
 *                     ▲    └УПП "Нет запчастей"(причина)> UPP_RESCHEDULE ──Плановик(новая дата)──┘(в NEW)
 *                     │
 *   UPP_APPROVED ──ЛОИС согласовал (исполнитель НЕ менялся)──> LOBE_REVIEW
 *                  └ЛОИС согласовал (исполнитель СМЕНЁН)──> NEEDS_EXECUTOR ──Исполнитель согласовал(дни простоя)──> LOBE_REVIEW
 *                  └ЛОИС отклонил(enum)──> LOIS_REJECTED [терминальный]      └отклонил(причина)──> EXECUTOR_REJECTED [терминальный]
 *
 *   LOBE_REVIEW ──ЛОБЭ "согласовать(тек./другая дата)"──> IN_PLAN ──ЛОБЭ "взять в подготовку"──> PREPARATION ──чек-лист "Готово"──> AWAITING_REPAIR ──ЛОИС "начать"──> IN_REPAIR ──отчёт──> DONE
 *               └ЛОБЭ отклонил(enum)──> LOBE_REJECTED [терминальный]
 *   IN_PLAN ──(cron: плановая дата прошла)──> AUTO_REJECTED (is_auto_rejected=true) [терминальный, в Аналитику]
 * ============================================================ */

export type Role = 'PLANNER' | 'UPP' | 'LOIS' | 'EXECUTOR' | 'LOBE' | 'FOREMAN';

export const ROLE_LABEL: Record<Role, string> = {
  PLANNER: 'Плановик',
  UPP: 'УПП',
  LOIS: 'ЛОИС',
  EXECUTOR: 'Исполнитель ремонта',
  LOBE: 'ЛОБЭ',
  FOREMAN: 'Мастер',
};

export interface User {
  id: string;
  fio: string;
  role: Role;
}

export interface Equipment {
  eoCode: string;
  srcNumber: string;
  name: string;
  model: string;
  cls: string;
  fixedAsset: string;
  mvz: string;
  spp: string;
}

export interface Shop {
  no: number;
  name: string;
  buildings: string[];
}

export interface RepairCrew {
  id: string;
  name: string;
  foremanId: string;
  executorIds: string[];
}

export interface SparePart {
  code: string;
  name: string;
  unit: string;
  stock: number;
}

export type RequestStatus =
  | 'NEW'
  | 'UPP_RESCHEDULE'
  | 'UPP_APPROVED'
  | 'LOIS_REJECTED'
  | 'NEEDS_EXECUTOR'
  | 'EXECUTOR_REJECTED'
  | 'LOBE_REVIEW'
  | 'LOBE_REJECTED'
  | 'IN_PLAN'
  | 'PREPARATION'
  | 'AWAITING_REPAIR'
  | 'IN_REPAIR'
  | 'DONE'
  | 'AUTO_REJECTED';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  NEW: 'Импортировано (ждёт УПП)',
  UPP_RESCHEDULE: 'Перенос срока УПП',
  UPP_APPROVED: 'Согласовано УПП',
  LOIS_REJECTED: 'Отклонено ЛОИС',
  NEEDS_EXECUTOR: 'Согласовано ЛОИС (ждёт исполнителя)',
  EXECUTOR_REJECTED: 'Отклонено исполнителем',
  LOBE_REVIEW: 'Ожидает ЛОБЭ',
  LOBE_REJECTED: 'Отклонено ЛОБЭ',
  IN_PLAN: 'В плане ремонтов',
  PREPARATION: 'Подготовка к ремонту',
  AWAITING_REPAIR: 'Ожидает ремонта',
  IN_REPAIR: 'В ремонте',
  DONE: 'Выполнено',
  AUTO_REJECTED: 'Автонесогласовано (просрочка подготовки)',
};

export const STATUS_COLOR: Record<RequestStatus, { bg: string; fg: string }> = {
  NEW: { bg: '#EEF3F7', fg: '#3B4859' },
  UPP_RESCHEDULE: { bg: '#FDF3D7', fg: '#8A5A00' },
  UPP_APPROVED: { bg: '#E0F2EC', fg: '#046D5B' },
  LOIS_REJECTED: { bg: '#FDE8E8', fg: '#B12704' },
  NEEDS_EXECUTOR: { bg: '#FFEFD9', fg: '#B34700' },
  EXECUTOR_REJECTED: { bg: '#FDE8E8', fg: '#B12704' },
  LOBE_REVIEW: { bg: '#E3F0F8', fg: '#007185' },
  LOBE_REJECTED: { bg: '#FDE8E8', fg: '#B12704' },
  IN_PLAN: { bg: '#E8EDF2', fg: '#232F3E' },
  PREPARATION: { bg: '#FFF4CF', fg: '#7A6200' },
  AWAITING_REPAIR: { bg: '#EAF0EF', fg: '#37475A' },
  IN_REPAIR: { bg: '#FFE9D1', fg: '#9A4E00' },
  DONE: { bg: '#DFF5EA', fg: '#067D62' },
  AUTO_REJECTED: { bg: '#F6DEDE', fg: '#7E1503' },
};

export const LOIS_REJECT_REASONS = [
  'Отсутствие запчастей',
  'Исправное техническое состояние',
  'Перегрузка участка',
  'Необходимость дополнительной диагностики',
  'Другое',
] as const;

export const LOBE_REJECT_REASONS = [
  'Риск невыполнения производственной программы',
  'Оборудование в консервации',
  'Нет признаков неработоспособного состояния',
  'Необходимость переноса срока ремонта',
  'Перегрузка участка эксплуатации',
  'Останов оборудования на ремонт остановит смежные/зависимые объекты',
  'Другое',
] as const;

export const OTHER_REASON = 'Другое';

export interface RepairOperation {
  id: string;
  orderNumber: string;
  workType: string;
  executorFio: string;
  defectNote: string;
  accuracyCheck: boolean;
  techPlace: string;
  workSection: string;
  workPlaceCode: string;
  hoursFitting: number;
  hoursMachining: number;
  hoursOther: number;
  hoursTotal: number;
  startTime: string;
  endTime: string;
}

export interface AttachedPart {
  code: string;
  name: string;
  qty: number;
}

export interface PrepChecklist {
  startedBy: string;
  startedAt: string;
  cleaned: boolean;
  emptied: boolean;
  deenergized: boolean;
  comment: string;
  doneAt?: string;
}

export interface MaintenanceReport {
  partsUsed: AttachedPart[];
  actualPersonnel: string[];
  factStart: string;
  factEnd: string;
  completedBy: string;
}

export interface HistoryEntry {
  at: string;
  by: string;
  from: RequestStatus | '—';
  to: RequestStatus;
  note?: string;
}

export interface ProjectRequest {
  id: string;
  eqSrcNumber: string;
  plannedStart: string;
  plannerGroup: string;
  shopNo: number;
  shopName: string;
  building: string;
  section: string;
  equipment: Equipment;
  responsibleLois: string;
  workTypes: string[];
  defectNotes: string[];
  accuracyCheckRequired: boolean;
  assignedExecutorFio: string;
  operations: RepairOperation[];
  status: RequestStatus;
  isAutoRejected: boolean;
  downtimeDays: number | null;
  loisDate: string | null;
  agreedDate: string | null;
  upp?: { decision: 'PARTS' | 'NO_PARTS'; parts?: AttachedPart[]; reason?: string; newDate?: string; by: string; at: string };
  lois?: { changedFrom?: string; toFio?: string; by: string; at: string };
  rejection?: { stage: 'ЛОИС' | 'ИСПОЛНИТЕЛЬ' | 'ЛОБЭ'; reason: string; comment?: string; by: string; at: string };
  lobe?: { decision: 'ТЕКУЩАЯ' | 'ДРУГАЯ'; date: string; by: string; at: string };
  prep?: PrepChecklist;
  report?: MaintenanceReport;
  history: HistoryEntry[];
}

export interface PhaseConfig {
  processStart: string;
  uploadUntil: string;
  approvalUntil: string;
  lobeUntil: string;
  executionEnd: string;
  planMonth: string;
}

export const PHASES: PhaseConfig = {
  processStart: '2026-06-25',
  uploadUntil: '2026-07-05',
  approvalUntil: '2026-07-15',
  lobeUntil: '2026-07-25',
  executionEnd: '2026-08-31',
  planMonth: 'Август 2026',
};

export interface DB {
  version: number;
  requests: ProjectRequest[];
}
