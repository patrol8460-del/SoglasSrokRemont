import type { Equipment, ProjectRequest, RepairCrew, RepairOperation, RequestStatus, Shop, SparePart, User, HistoryEntry } from './types';

export const USERS: User[] = [
  { id: 'u-plan1', fio: 'Светлова Анна Павловна', role: 'PLANNER' },
  { id: 'u-upp1', fio: 'Крылов Дмитрий Михайлович', role: 'UPP' },
  { id: 'u-lois1', fio: 'Мельникова Ирина Сергеевна', role: 'LOIS' },
  { id: 'u-lois2', fio: 'Гусев Павел Романович', role: 'LOIS' },
  { id: 'u-lob1', fio: 'Захарова Елена Викторовна', role: 'LOBE' },
  { id: 'u-fm1', fio: 'Балашов Олег Николаевич', role: 'FOREMAN' },
  { id: 'u-fm2', fio: 'Титов Виктор Георгиевич', role: 'FOREMAN' },
  { id: 'u-ex1', fio: 'Сидоров Константин Леонидович', role: 'EXECUTOR' },
  { id: 'u-ex2', fio: 'Иванов Максим Андреевич', role: 'EXECUTOR' },
  { id: 'u-ex3', fio: 'Петров Николай Валерьевич', role: 'EXECUTOR' },
  { id: 'u-ex4', fio: 'Кузнецов Дмитрий Сергеевич', role: 'EXECUTOR' },
  { id: 'u-ex5', fio: 'Фёдоров Илья Игоревич', role: 'EXECUTOR' },
  { id: 'u-ex6', fio: 'Волков Сергей Евгеньевич', role: 'EXECUTOR' },
];

export const executorUsers = (): User[] => USERS.filter((u) => u.role === 'EXECUTOR');
export const loisUsers = (): User[] => USERS.filter((u) => u.role === 'LOIS');

export const SHOPS: Shop[] = [
  { no: 1, name: 'Механообрабатывающий цех', buildings: ['1', '2'] },
  { no: 2, name: 'Сборочный цех', buildings: ['2', '3'] },
  { no: 3, name: 'Кузнечно-прессовый цех', buildings: ['1', 'А'] },
  { no: 4, name: 'Литейный цех', buildings: ['Б', '2'] },
];

export const WORK_SECTIONS = ['Механический участок', 'Сборочный участок', 'Штамповочный участок', 'Литейный участок', 'Ремонтный участок'];
export const WORK_PLACES = ['РМ-01', 'РМ-02', 'РМ-03', 'РМ-04', 'РМ-05', 'РМ-06'];
export const PLANNER_GROUPS = ['Группа плановиков 1', 'Группа плановиков 2'];
export const WORK_TYPES = ['Плановый ремонт', 'Аварийный ремонт', 'Модернизация', 'Проверка норм точности', 'Диагностика', 'Техобслуживание'];

export const EQUIPMENT: Equipment[] = [
  { eoCode: 'EO-100234', srcNumber: 'EQ-1001', name: 'Станок токарно-винторезный', model: '16К20', cls: 'Металлорежущее', fixedAsset: 'ОС-000123', mvz: 'МВЗ-1101', spp: 'СПП-9001' },
  { eoCode: 'EO-100235', srcNumber: 'EQ-1002', name: 'Центр обрабатывающий вертикальный', model: 'DMG MORI NLX 2500', cls: 'Металлорежущее', fixedAsset: 'ОС-000124', mvz: 'МВЗ-1101', spp: 'СПП-9001' },
  { eoCode: 'EO-100236', srcNumber: 'EQ-1003', name: 'Станок фрезерный консольный', model: '6Р82', cls: 'Металлорежущее', fixedAsset: 'ОС-000131', mvz: 'МВЗ-1102', spp: 'СПП-9002' },
  { eoCode: 'EO-100237', srcNumber: 'EQ-1004', name: 'Пресс гидравлический', model: 'П6334', cls: 'Прессовое', fixedAsset: 'ОС-000140', mvz: 'МВЗ-1201', spp: 'СПП-9003' },
  { eoCode: 'EO-100238', srcNumber: 'EQ-1005', name: 'Кран мостовой электрический', model: 'КМ-50-16', cls: 'Подъёмно-транспортное', fixedAsset: 'ОС-000145', mvz: 'МВЗ-1201', spp: 'СПП-9003' },
  { eoCode: 'EO-100239', srcNumber: 'EQ-1006', name: 'Компрессор винтовой', model: 'Atlas Copco GA-75', cls: 'Компрессорное', fixedAsset: 'ОС-000152', mvz: 'МВЗ-1301', spp: 'СПП-9004' },
  { eoCode: 'EO-100240', srcNumber: 'EQ-1007', name: 'Машина литьевая', model: 'CL-450', cls: 'Литейное', fixedAsset: 'ОС-000160', mvz: 'МВЗ-1401', spp: 'СПП-9005' },
  { eoCode: 'EO-100241', srcNumber: 'EQ-1008', name: 'Станок круглошлифовальный', model: '3Б151', cls: 'Металлорежущее', fixedAsset: 'ОС-000167', mvz: 'МВЗ-1102', spp: 'СПП-9002' },
  { eoCode: 'EO-100242', srcNumber: 'EQ-1009', name: 'Конвейер ленточный', model: 'КЛ-120', cls: 'Транспортное', fixedAsset: 'ОС-000172', mvz: 'МВЗ-1301', spp: 'СПП-9004' },
  { eoCode: 'EO-100243', srcNumber: 'EQ-1010', name: 'Печь термическая шахтная', model: 'СШЗ-6.12', cls: 'Термическое', fixedAsset: 'ОС-000180', mvz: 'МВЗ-1401', spp: 'СПП-9005' },
  { eoCode: 'EO-100244', srcNumber: 'EQ-1011', name: 'Робот сборочный', model: 'KUKA KR-210', cls: 'Робототехника', fixedAsset: 'ОС-000188', mvz: 'МВЗ-1202', spp: 'СПП-9006' },
  { eoCode: 'EO-100245', srcNumber: 'EQ-1012', name: 'Машина координатно-измерительная', model: 'DEA Global S', cls: 'Измерительное', fixedAsset: 'ОС-000195', mvz: 'МВЗ-1103', spp: 'СПП-9007' },
];

export const CREWS: RepairCrew[] = [
  { id: 'crew-1', name: 'Слесарно-механическая бригада №1', foremanId: 'u-fm1', executorIds: ['u-ex1', 'u-ex2', 'u-ex3'] },
  { id: 'crew-2', name: 'Слесарно-механическая бригада №2', foremanId: 'u-fm2', executorIds: ['u-ex4', 'u-ex5', 'u-ex6'] },
];

export function crewOfExecutor(fio: string): { crew: RepairCrew; foreman: User } | null {
  for (const crew of CREWS) {
    const ex = crew.executorIds.map((id) => USERS.find((u) => u.id === id)).find((u) => u && u.fio === fio);
    if (ex) {
      const foreman = USERS.find((u) => u.id === crew.foremanId);
      if (foreman) return { crew, foreman };
    }
  }
  return null;
}

export const SPARE_PARTS: SparePart[] = [
  { code: 'BRG-6210', name: 'Подшипник 6210-2RS', unit: 'шт', stock: 24 },
  { code: 'BRG-7208', name: 'Подшипник 7208AC', unit: 'шт', stock: 12 },
  { code: 'BLT-A1200', name: 'Ремень клиновой А-1200', unit: 'шт', stock: 40 },
  { code: 'FLT-OIL', name: 'Фильтр масляный W950', unit: 'шт', stock: 18 },
  { code: 'OIL-IG46', name: 'Масло индустриальное ИГ-46', unit: 'л', stock: 210 },
  { code: 'GLND-40', name: 'Манжета армированная 40×62×10', unit: 'шт', stock: 55 },
  { code: 'SHF-32', name: 'Вал шпиндельный Ø32', unit: 'шт', stock: 3 },
  { code: 'GRS-LT24', name: 'Смазка Литол-24', unit: 'кг', stock: 36 },
  { code: 'CNT-220', name: 'Контактор КМН-220В 25А', unit: 'шт', stock: 14 },
  { code: 'FUS-63', name: 'Предохранитель ПН2-63', unit: 'шт', stock: 60 },
  { code: 'HYD-DN32', name: 'Рукав гидравлический DN32', unit: 'м', stock: 0 },
  { code: 'CLT-D250', name: 'Муфта сцепления Ø250', unit: 'шт', stock: 6 },
  { code: 'BOLT-M20', name: 'Крепёж М20 (комплект)', unit: 'компл', stock: 80 },
  { code: 'SEN-PT100', name: 'Датчик температуры PT100', unit: 'шт', stock: 22 },
];

let opSeq = 0;
interface OpSpec {
  order: string;
  type: string;
  fio: string;
  hF?: number;
  hM?: number;
  hO?: number;
  dn?: string;
  acc?: boolean;
  ws?: string;
  wp?: string;
}

function op(s: OpSpec): RepairOperation {
  opSeq += 1;
  const hF = s.hF ?? 4;
  const hM = s.hM ?? 0;
  const hO = s.hO ?? 2;
  return {
    id: `op-${opSeq}`,
    orderNumber: s.order,
    workType: s.type,
    executorFio: s.fio,
    defectNote: s.dn ?? `ДВ-2026-${140 + opSeq}`,
    accuracyCheck: s.acc ?? false,
    techPlace: 'ТП главного механика',
    workSection: s.ws ?? 'Механический участок',
    workPlaceCode: s.wp ?? 'РМ-01',
    hoursFitting: hF,
    hoursMachining: hM,
    hoursOther: hO,
    hoursTotal: Math.round((hF + hM + hO) * 10) / 10,
    startTime: '09:00:00',
    endTime: '15:00:00',
  };
}

function h(from: HistoryEntry['from'], to: RequestStatus, by: string, at: string, note?: string): HistoryEntry {
  return { from, to, by, at, note };
}

const LOIS1 = 'Мельникова Ирина Сергеевна';
const LOIS2 = 'Гусев Павел Романович';
const UPP = 'Крылов Дмитрий Михайлович';
const LOBE = 'Захарова Елена Викторовна';
const PLAN = 'Светлова Анна Павловна';

interface ReqSpec {
  id: string;
  eq: string;
  date: string;
  shopNo: number;
  building: string;
  section?: string;
  status: RequestStatus;
  executor: string;
  lois?: string;
  ops: RepairOperation[];
  hist: HistoryEntry[];
  extra?: Partial<ProjectRequest>;
}

function mkReq(s: ReqSpec): ProjectRequest {
  const eq = EQUIPMENT.find((e) => e.srcNumber === s.eq);
  const shop = SHOPS.find((x) => x.no === s.shopNo);
  if (!eq || !shop) throw new Error(`Ошибка демо-данных: справочник не содержит ${s.eq} / цех ${s.shopNo}`);
  const base: ProjectRequest = {
    id: s.id,
    eqSrcNumber: s.eq,
    plannedStart: s.date,
    plannerGroup: PLANNER_GROUPS[Number(s.id.replace(/\D/g, '')) % 2] ?? PLANNER_GROUPS[0],
    shopNo: s.shopNo,
    shopName: shop.name,
    building: s.building,
    section: s.section ?? WORK_SECTIONS[0],
    equipment: eq,
    responsibleLois: s.lois ?? LOIS1,
    workTypes: Array.from(new Set(s.ops.map((o) => o.workType))),
    defectNotes: Array.from(new Set(s.ops.map((o) => o.defectNote).filter(Boolean))),
    accuracyCheckRequired: s.ops.some((o) => o.accuracyCheck),
    assignedExecutorFio: s.executor,
    operations: s.ops,
    status: s.status,
    isAutoRejected: s.status === 'AUTO_REJECTED',
    downtimeDays: null,
    loisDate: null,
    agreedDate: null,
    history: s.hist,
  };
  return { ...base, ...(s.extra ?? {}) };
}

export function seedRequests(): ProjectRequest[] {
  opSeq = 0;
  return [
    mkReq({
      id: 'r-01', eq: 'EQ-1001', date: '2026-08-03', shopNo: 1, building: '1', status: 'NEW',
      executor: 'Сидоров Константин Леонидович', lois: LOIS1,
      ops: [
        op({ order: '7001001', type: 'Плановый ремонт', fio: 'Сидоров Константин Леонидович', hF: 6, hO: 2 }),
        op({ order: '7001001', type: 'Проверка норм точности', fio: 'Сидоров Константин Леонидович', hF: 2, acc: true }),
      ],
      hist: [h('—', 'NEW', PLAN, '2026-07-03 09:41', 'Импорт из Excel: план на Август 2026')],
    }),
    mkReq({
      id: 'r-02', eq: 'EQ-1005', date: '2026-08-10', shopNo: 3, building: 'А', section: 'Штамповочный участок', status: 'NEW',
      executor: 'Кузнецов Дмитрий Сергеевич', lois: LOIS2,
      ops: [op({ order: '7001002', type: 'Плановый ремонт', fio: 'Кузнецов Дмитрий Сергеевич', hF: 8, hM: 4, wp: 'РМ-04' })],
      hist: [h('—', 'NEW', PLAN, '2026-07-03 09:41', 'Импорт из Excel: план на Август 2026')],
    }),
    mkReq({
      id: 'r-19', eq: 'EQ-1012', date: '2026-07-01', shopNo: 1, building: '1', status: 'DONE',
      executor: 'Сидоров Константин Леонидович', lois: LOIS1,
      ops: [op({ order: '7001019', type: 'Проверка норм точности', fio: 'Сидоров Константин Леонидович', hF: 3, hO: 5, acc: true })],
      hist: [
        h('—', 'NEW', PLAN, '2026-06-25 14:30', 'Импорт из Excel: план на Август 2026'),
        h('NEW', 'UPP_APPROVED', UPP, '2026-06-26 10:11', 'Запчасти зарезервированы'),
        h('UPP_APPROVED', 'LOBE_REVIEW', LOIS1, '2026-06-27 09:26', 'Согласовано ЛОИС'),
        h('LOBE_REVIEW', 'IN_PLAN', LOBE, '2026-06-27 15:02', 'Согласовано ЛОБЭ'),
        h('IN_PLAN', 'PREPARATION', LOBE, '2026-06-29 08:40', 'Взято в работу по подготовке'),
        h('PREPARATION', 'AWAITING_REPAIR', LOBE, '2026-06-30 12:15', 'Готово к ремонту'),
        h('AWAITING_REPAIR', 'IN_REPAIR', LOIS1, '2026-07-01 08:00', 'Ремонт начат'),
        h('IN_REPAIR', 'DONE', LOIS1, '2026-07-02 17:24', 'Ремонт завершён'),
      ],
      extra: {
        upp: { decision: 'PARTS', parts: [{ code: 'BRG-7208', name: 'Подшипник 7208AC', qty: 2 }], by: UPP, at: '2026-06-26 10:11' },
        lois: { by: LOIS1, at: '2026-06-27 09:26' },
        lobe: { decision: 'ТЕКУЩАЯ', date: '2026-07-01', by: LOBE, at: '2026-06-27 15:02' },
        downtimeDays: 2, agreedDate: '2026-07-01',
        prep: { startedBy: LOBE, startedAt: '2026-06-29 08:40', cleaned: true, emptied: true, deenergized: true, comment: '', doneAt: '2026-06-30 12:15' },
        report: {
          partsUsed: [{ code: 'BRG-7208', name: 'Подшипник 7208AC', qty: 2 }],
          actualPersonnel: ['Сидоров Константин Леонидович'],
          factStart: '2026-07-01', factEnd: '2026-07-02', completedBy: LOIS1,
        },
      },
    }),
  ];
}
