import { useMemo, useState } from 'react';
import { CheckCheck, Printer, Users, Wrench, XCircle } from 'lucide-react';
import type { Ctx, PrintPayload } from '../ctx';
import type { AttachedPart, ProjectRequest } from '../types';
import { LOIS_REJECT_REASONS, OTHER_REASON, STATUS_LABEL } from '../types';
import { completeRepair, loisApprove, loisReject, startRepair } from '../backend';
import { crewOfExecutor, executorUsers, SPARE_PARTS } from '../data';
import { reqCols } from './PlannerUpp';
import { DataTable, type Col } from '../DataTable';
import { Btn, EmptyState, Field, inputCls, Modal, StatusBadge } from '../ui';
import { isoToRu, plural } from '../utils';

export function LoisApproval({ ctx }: { ctx: Ctx }) {
  const { db, user, act, openCard } = ctx;
  const queue = db.requests.filter((r) => r.status === 'UPP_APPROVED');
  const [approveIds, setApproveIds] = useState<string[] | null>(null);
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);

  const cols: Col<ProjectRequest>[] = [
    ...reqCols(false),
    { id: 'parts', header: 'Запчасти УПП', acc: (r) => (r.upp?.parts?.length ? r.upp.parts.map((p) => `${p.name} ×${p.qty}`).join('; ') : 'не требуются'), w: 210 },
    { id: 'lois', header: 'Ответств. ЛОИС', acc: (r) => r.responsibleLois, w: 190 },
    {
      id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 210,
      render: (r) => (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Btn size="sm" variant="primary" onClick={() => setApproveIds([r.id])}><CheckCheck size={13} /> Согласовать</Btn>
          <Btn size="sm" variant="dangerSoft" onClick={() => setRejectIds([r.id])}><XCircle size={13} /> Отклонить</Btn>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable cols={cols} data={queue} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)}
        bulkBar={(sel, clear) => (<>
          <Btn size="sm" variant="primary" onClick={() => setApproveIds(sel.map((r) => r.id))}><CheckCheck size={13} /> Согласовать выбранные</Btn>
          <Btn size="sm" variant="danger" onClick={() => setRejectIds(sel.map((r) => r.id))}><XCircle size={13} /> Отклонить выбранные</Btn>
          <Btn size="sm" variant="link" onClick={clear}>Снять</Btn>
        </>)}
        emptyTitle="Нет заявок на согласовании ЛОИС" />
      {approveIds && <LoisApproveModal ids={approveIds} ctx={ctx} onClose={() => setApproveIds(null)} />}
      {rejectIds && <LoisRejectModal ids={rejectIds} ctx={ctx} onClose={() => setRejectIds(null)} />}
    </div>
  );
}

function LoisApproveModal({ ids, ctx, onClose }: { ids: string[]; ctx: Ctx; onClose: () => void }) {
  const { db, user, act } = ctx;
  const single = ids.length === 1 ? db.requests.find((r) => r.id === ids[0]) : undefined;
  const [date, setDate] = useState(single ? single.plannedStart : '');
  const [executor, setExecutor] = useState(single?.assignedExecutorFio ?? '');
  const [err, setErr] = useState('');
  const changed = !!single && !!executor && executor !== single.assignedExecutorFio;

  const submit = () => {
    if (date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('Укажите корректную дату'); return; }
    const ok = act('Согласовано ЛОИС', (d) => loisApprove(d, ids, date === '' ? null : date, ids.length === 1 ? executor : '', user.fio), {
      stage: 'approval',
      extra: changed ? `Исполнитель сменён на «${executor}»` : 'Заявки переданы ЛОБЭ',
    });
    if (ok) onClose();
  };

  return (
    <Modal title={`Согласование ЛОИС · заявок: ${ids.length}`} onClose={onClose} footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={submit}><CheckCheck size={14} /> Согласовать</Btn></>}>
      <div className="space-y-3">
        <Field label="Дата начала работ" hint={date === '' ? 'Пусто — каждая заявка сохранит свою плановую дату' : ''}>
          <input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setErr(''); }} />
        </Field>
        {single ? (
          <Field label="ФИО исполнителя">
            <select className={inputCls} value={executor} onChange={(e) => setExecutor(e.target.value)}>
              {executorUsers().map((u) => (<option key={u.id} value={u.fio}>{u.fio}</option>))}
            </select>
          </Field>
        ) : (
          <p className="rounded-md bg-[#F0F2F2] px-3 py-2 text-xs text-[#565959]">Массовое согласование без смены исполнителя.</p>
        )}
        {changed && <p className="rounded-md border border-[#FF9900]/50 bg-[#FFF4E0] px-3 py-2 text-xs text-[#8A5A00]">Исполнитель сменён → заявка уйдёт новому исполнителю.</p>}
        {err && <p className="text-xs font-bold text-[#B12704]">{err}</p>}
      </div>
    </Modal>
  );
}

function LoisRejectModal({ ids, ctx, onClose }: { ids: string[]; ctx: Ctx; onClose: () => void }) {
  const { user, act } = ctx;
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');

  const submit = () => {
    if (!reason) { setErr('Выберите причину'); return; }
    if (reason === OTHER_REASON && !comment.trim()) { setErr('Для «Другое» обязателен комментарий'); return; }
    const ok = act('Отклонено ЛОИС', (d) => loisReject(d, ids, reason, comment, user.fio), { stage: 'approval' });
    if (ok) onClose();
  };

  return (
    <Modal title={`Отклонение ЛОИС · заявок: ${ids.length}`} onClose={onClose} footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="danger" onClick={submit}><XCircle size={14} /> Отклонить</Btn></>}>
      <Field label="Причина отклонения">
        <div className="space-y-1">
          {LOIS_REJECT_REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] ${reason === r ? 'border-[#B12704] bg-[#FDECEA]' : 'border-[#D5D9D9] hover:bg-[#F7F8F8]'}`}>
              <input type="radio" name="lois-reason" checked={reason === r} onChange={() => { setReason(r); setErr(''); }} className="accent-[#B12704]" />
              {r}
            </label>
          ))}
        </div>
      </Field>
      <div className="mt-3">
        <Field label={`Комментарий${reason === OTHER_REASON ? ' (обязательно)' : ''}`}>
          <textarea className={`${inputCls} min-h-[70px]`} value={comment} onChange={(e) => { setComment(e.target.value); setErr(''); }} />
        </Field>
      </div>
      {err && <p className="mt-2 text-xs font-bold text-[#B12704]">{err}</p>}
    </Modal>
  );
}

const TASK_STATUSES = ['IN_PLAN', 'PREPARATION', 'AWAITING_REPAIR', 'IN_REPAIR'];

export function ShiftTasks({ ctx }: { ctx: Ctx }) {
  const { db, simDate, openCard, setPrint, toast } = ctx;
  const items = db.requests.filter((r) => TASK_STATUSES.includes(r.status));

  const groups = useMemo(() => {
    const m = new Map<string, { foremanFio: string; crewName: string; items: ProjectRequest[] }>();
    for (const r of items) {
      const c = crewOfExecutor(r.assignedExecutorFio);
      const key = c ? c.foreman.fio : '__none';
      const g = m.get(key) ?? { foremanFio: c?.foreman.fio ?? 'Без бригады', crewName: c?.crew.name ?? '—', items: [] };
      g.items.push(r);
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => a.foremanFio.localeCompare(b.foremanFio, 'ru'));
  }, [items]);

  const cols: Col<ProjectRequest>[] = [
    { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 105 },
    { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 220 },
    { id: 'model', header: 'Модель', acc: (r) => r.equipment.model, w: 150 },
    { id: 'shop', header: 'Цех / корпус', acc: (r) => `${r.shopNo} · корп. ${r.building}`, w: 115 },
    { id: 'wt', header: 'Вид работы', acc: (r) => r.workTypes.join(', '), w: 160 },
    { id: 'ex', header: 'Исполнитель', acc: (r) => r.assignedExecutorFio, w: 195 },
    { id: 'date', header: 'Согл. дата', acc: (r) => isoToRu(r.agreedDate), w: 100 },
    { id: 'days', header: 'Простой, дн.', acc: (r) => (r.downtimeDays == null ? '' : r.downtimeDays), w: 95, align: 'right' },
    { id: 'status', header: 'Статус', acc: (r) => STATUS_LABEL[r.status], w: 230, forceSelect: true, render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (items.length === 0) return <div className="rounded-lg border border-[#D5D9D9] bg-white"><EmptyState title="Нет согласованных заявок" /></div>;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.foremanFio} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D5D9D9] bg-[#F7F8F8] px-4 py-2.5">
            <Users size={16} className="text-[#007185]" />
            <span className="text-sm font-bold">{g.foremanFio}</span>
            <span className="text-xs text-[#565959]">{g.crewName}</span>
            <span className="rounded-full bg-[#232F3E] px-2 py-0.5 text-[11px] font-bold text-white">{g.items.length} заданий</span>
            <Btn size="sm" variant="primary" className="ml-auto" onClick={() => {
              setPrint({ foremanFio: g.foremanFio, crewName: g.crewName, simDate, items: g.items } satisfies PrintPayload);
              toast('success', 'Печатная форма сформирована');
            }}><Printer size={13} /> Распечатать</Btn>
          </div>
          <DataTable cols={cols} data={g.items} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[340px]" />
        </div>
      ))}
    </div>
  );
}

export function RepairView({ ctx }: { ctx: Ctx }) {
  const { db, user, simDate, act, openCard, toast } = ctx;
  const awaitRepair = db.requests.filter((r) => r.status === 'AWAITING_REPAIR');
  const inRepair = db.requests.filter((r) => r.status === 'IN_REPAIR');
  const [reportFor, setReportFor] = useState<ProjectRequest | null>(null);

  const baseCols: Col<ProjectRequest>[] = [
    { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 105 },
    { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 220 },
    { id: 'wt', header: 'Вид работы', acc: (r) => r.workTypes.join(', '), w: 160 },
    { id: 'ex', header: 'Исполнитель', acc: (r) => r.assignedExecutorFio, w: 200 },
    { id: 'date', header: 'Согл. дата', acc: (r) => isoToRu(r.agreedDate), w: 100 },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-bold">Ожидают начала ремонта ({awaitRepair.length})</h3>
        <DataTable cols={[...baseCols, {
          id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 160,
          render: (r) => (<div onClick={(e) => e.stopPropagation()}><Btn size="sm" variant="primary" onClick={() => act('Ремонт начат', (d) => startRepair(d, r.id, user.fio, simDate))}><Wrench size={13} /> Начать</Btn></div>),
        }]} data={awaitRepair} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[320px]" emptyTitle="Нет оборудования, ожидающего ремонта" />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-bold">В ремонте ({inRepair.length})</h3>
        <DataTable cols={[...baseCols, {
          id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 180,
          render: (r) => (<div onClick={(e) => e.stopPropagation()}><Btn size="sm" variant="primary" onClick={() => setReportFor(r)}><Wrench size={13} /> Завершить ремонт</Btn></div>),
        }]} data={inRepair} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[320px]" emptyTitle="Нет заявок в ремонте" />
      </div>

      {reportFor && (
        <ReportModal req={db.requests.find((r) => r.id === reportFor.id) ?? reportFor} ctx={ctx} onClose={() => setReportFor(null)} onSubmit={(parts, personnel) => {
          if (act('Ремонт завершён', (d) => completeRepair(d, reportFor.id, parts, personnel, user.fio, simDate))) {
            setReportFor(null);
            toast('success', 'Отчёт сохранён');
          }
        }} />
      )}
    </div>
  );
}

function ReportModal({ req, ctx, onClose, onSubmit }: { req: ProjectRequest; ctx: Ctx; onClose: () => void; onSubmit: (parts: AttachedPart[], personnel: string[]) => void }) {
  const { simDate } = ctx;
  const [parts, setParts] = useState<AttachedPart[]>([]);
  const [code, setCode] = useState(SPARE_PARTS[0]?.code ?? '');
  const [qty, setQty] = useState(1);
  const [personnel, setPersonnel] = useState<Set<string>>(new Set([req.assignedExecutorFio]));
  const executors = executorUsers();

  const addPart = () => {
    if (!code || !isFinite(qty) || qty <= 0) return;
    const p = SPARE_PARTS.find((x) => x.code === code);
    if (!p) return;
    setParts((prev) => {
      const ex = prev.find((x) => x.code === code);
      if (ex) return prev.map((x) => (x.code === code ? { ...x, qty: x.qty + qty } : x));
      return [...prev, { code, name: p.name, qty }];
    });
    setQty(1);
  };

  return (
    <Modal title={`Отчёт о ремонте · ${req.equipment.name}`} onClose={onClose} width="max-w-2xl" footer={<>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn variant="primary" disabled={personnel.size === 0} onClick={() => onSubmit(parts, [...personnel])}><CheckCheck size={14} /> Завершить ремонт</Btn>
    </>}>
      <div className="grid grid-cols-2 gap-3 text-xs text-[#565959]">
        <div>Согласованная дата: <b className="text-[#0F1111]">{isoToRu(req.agreedDate)}</b></div>
        <div>Факт. начало: <b className="text-[#0F1111]">{isoToRu(req.report?.factStart || simDate)}</b></div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-bold">Применённые запчасти</div>
        <div className="flex gap-2">
          <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}>
            {SPARE_PARTS.map((p) => (<option key={p.code} value={p.code}>{p.code} — {p.name}</option>))}
          </select>
          <input type="number" min={1} className={`${inputCls} w-20 text-right`} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <Btn variant="secondary" onClick={addPart}>Добавить</Btn>
        </div>
        {parts.length > 0 && (
          <div className="mt-2 space-y-1">
            {parts.map((p) => (
              <div key={p.code} className="flex items-center gap-2 rounded-md bg-[#F0F2F2] px-2.5 py-1.5 text-[13px]">
                <span className="font-mono text-xs text-[#565959]">{p.code}</span>
                <span className="flex-1">{p.name}</span>
                <b>×{p.qty}</b>
                <button className="text-[#B12704] hover:opacity-70" onClick={() => setParts((prev) => prev.filter((x) => x.code !== p.code))}><XCircle size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs font-bold">Фактический персонал {personnel.size === 0 && <span className="ml-1 font-bold text-[#B12704]">— отметьте минимум одного</span>}</div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {executors.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-[#D5D9D9] px-2.5 py-1.5 text-[13px] hover:bg-[#F7F8F8]">
              <input type="checkbox" className="h-4 w-4 accent-[#FF9900]" checked={personnel.has(u.fio)} onChange={(e) => setPersonnel((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(u.fio); else next.delete(u.fio);
                return next;
              })} />
              {u.fio}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
