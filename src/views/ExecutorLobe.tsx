import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, BellRing, CheckCheck, ClipboardCheck, Wrench, XCircle } from 'lucide-react';
import type { Ctx } from '../ctx';
import type { ProjectRequest } from '../types';
import { LOBE_REJECT_REASONS, OTHER_REASON, PHASES } from '../types';
import { executorApprove, executorReject, finishPreparation, lobeApprove, lobeReject, startPreparation } from '../backend';
import { DataTable, type Col } from '../DataTable';
import { Btn, Field, inputCls, Modal } from '../ui';
import { diffDays, isoToRu, plural } from '../utils';

export function ExecutorView({ ctx }: { ctx: Ctx }) {
  const { db, user, act, openCard, toast } = ctx;
  const queue = db.requests.filter((r) => r.status === 'NEEDS_EXECUTOR' && r.assignedExecutorFio === user.fio);
  const [days, setDays] = useState<Record<string, string>>({});
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);

  const getDays = (r: ProjectRequest): string => days[r.id] ?? (r.downtimeDays != null ? String(r.downtimeDays) : '');
  const daysValid = (r: ProjectRequest): boolean => {
    const v = getDays(r);
    return v !== '' && isFinite(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 1;
  };

  const approveMany = (ids: string[]) => {
    const map: Record<string, number> = {};
    const missing: string[] = [];
    for (const id of ids) {
      const r = queue.find((x) => x.id === id);
      if (!r) continue;
      if (!daysValid(r)) missing.push(r.equipment.name);
      else map[id] = Number(getDays(r));
    }
    if (missing.length > 0) { toast('error', 'Заполните дни простоя', missing.join(', ')); return; }
    act('Согласовано исполнителем', (d) => executorApprove(d, map, user.fio));
  };

  const cols: Col<ProjectRequest>[] = [
    { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 105 },
    { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 220 },
    { id: 'wt', header: 'Вид работы', acc: (r) => r.workTypes.join(', '), w: 160 },
    { id: 'date', header: 'План. дата', acc: (r) => isoToRu(r.loisDate ?? r.plannedStart), w: 100 },
    { id: 'from', header: 'Сменил (ЛОИС)', acc: (r) => r.lois?.changedFrom ?? '—', w: 190 },
    {
      id: 'days', header: 'Кол-во дней простоя', acc: (r) => getDays(r), w: 150, align: 'center',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input type="number" min={1} step={1} placeholder="—" value={getDays(r)} onChange={(e) => setDays((p) => ({ ...p, [r.id]: e.target.value }))}
            className={`w-24 rounded-md border px-2 py-1 text-center text-[13px] outline-none ${daysValid(r) ? 'border-[#888C8C]' : 'border-[#B12704] bg-[#FDECEA]'}`} />
        </div>
      ),
    },
    {
      id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 220,
      render: (r) => (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Btn size="sm" variant="primary" disabled={!daysValid(r)} onClick={() => approveMany([r.id])}><CheckCheck size={13} /> Согласовать</Btn>
          <Btn size="sm" variant="dangerSoft" onClick={() => setRejectIds([r.id])}><XCircle size={13} /> Отклонить</Btn>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#D5D9D9] bg-white px-4 py-2.5 text-[13px] text-[#565959]">
        Заявки, в которых ЛОИС сменил исполнителя на <b>{user.fio}</b>.
      </div>
      <DataTable cols={cols} data={queue} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)}
        bulkBar={(sel, clear) => (<>
          <Btn size="sm" variant="primary" onClick={() => approveMany(sel.map((r) => r.id))}><CheckCheck size={13} /> Согласовать выбранные</Btn>
          <Btn size="sm" variant="danger" onClick={() => setRejectIds(sel.map((r) => r.id))}><XCircle size={13} /> Отклонить выбранные</Btn>
          <Btn size="sm" variant="link" onClick={clear}>Снять</Btn>
        </>)}
        emptyTitle="Нет заявок на согласование" />
      {rejectIds && <ExecutorRejectModal ids={rejectIds} ctx={ctx} onClose={() => setRejectIds(null)} />}
    </div>
  );
}

function ExecutorRejectModal({ ids, ctx, onClose }: { ids: string[]; ctx: Ctx; onClose: () => void }) {
  const { user, act } = ctx;
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(false);
  return (
    <Modal title={`Отклонение · заявок: ${ids.length}`} onClose={onClose} footer={<>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn variant="danger" onClick={() => {
        if (!reason.trim()) { setErr(true); return; }
        if (act('Отклонено', (d) => executorReject(d, ids, reason, user.fio))) onClose();
      }}><XCircle size={14} /> Отклонить</Btn>
    </>}>
      <Field label="Причина (обязательно)">
        <textarea className={`${inputCls} min-h-[90px]`} value={reason} onChange={(e) => { setReason(e.target.value); setErr(false); }} />
      </Field>
      {err && <p className="mt-1.5 text-xs font-bold text-[#B12704]">Причина обязательна</p>}
    </Modal>
  );
}

export function LobeView({ ctx }: { ctx: Ctx }) {
  const { db, openCard } = ctx;
  const queue = db.requests.filter((r) => r.status === 'LOBE_REVIEW');
  const [approveIds, setApproveIds] = useState<string[] | null>(null);
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);

  const cols: Col<ProjectRequest>[] = [
    { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 105 },
    { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 220 },
    { id: 'shop', header: 'Цех', acc: (r) => `${r.shopNo} — ${r.shopName}`, w: 190 },
    { id: 'wt', header: 'Вид работы', acc: (r) => r.workTypes.join(', '), w: 160 },
    { id: 'ex', header: 'Исполнитель', acc: (r) => r.assignedExecutorFio, w: 195 },
    { id: 'plan', header: 'Дата ЛОИС', acc: (r) => isoToRu(r.loisDate ?? r.plannedStart), w: 105 },
    { id: 'days', header: 'Простой, дн.', acc: (r) => (r.downtimeDays == null ? '' : r.downtimeDays), w: 95, align: 'right' },
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
        emptyTitle="Нет заявок на согласовании ЛОБЭ" />
      {approveIds && <LobeApproveModal ids={approveIds} ctx={ctx} onClose={() => setApproveIds(null)} />}
      {rejectIds && <LobeRejectModal ids={rejectIds} ctx={ctx} onClose={() => setRejectIds(null)} />}
    </div>
  );
}

function LobeApproveModal({ ids, ctx, onClose }: { ids: string[]; ctx: Ctx; onClose: () => void }) {
  const { db, user, simDate, act } = ctx;
  const single = ids.length === 1 ? db.requests.find((r) => r.id === ids[0]) : undefined;
  const currentDate = single ? (single.loisDate ?? single.plannedStart) : simDate;
  const [mode, setMode] = useState<'ТЕКУЩАЯ' | 'ДРУГАЯ'>('ТЕКУЩАЯ');
  const [date, setDate] = useState(currentDate);
  const [err, setErr] = useState('');

  const submit = () => {
    if (mode === 'ДРУГАЯ' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('Укажите дату'); return; }
    const ok = act('Согласовано ЛОБЭ', (d) => lobeApprove(d, ids, mode, mode === 'ДРУГАЯ' ? date : null, user.fio), { stage: 'lobe' });
    if (ok) onClose();
  };

  return (
    <Modal title={`Согласование ЛОБЭ · заявок: ${ids.length}`} onClose={onClose} footer={<><Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" onClick={submit}><CheckCheck size={14} /> В план</Btn></>}>
      <div className="space-y-2">
        <label className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${mode === 'ТЕКУЩАЯ' ? 'border-[#FF9900] bg-[#FFF8E7]' : 'border-[#D5D9D9]'}`}>
          <input type="radio" checked={mode === 'ТЕКУЩАЯ'} onChange={() => setMode('ТЕКУЩАЯ')} className="accent-[#FF9900]" />
          <span><b>Текущая дата</b><span className="block text-xs text-[#565959]">{single ? isoToRu(currentDate) : 'плановая дата'}</span></span>
        </label>
        <label className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${mode === 'ДРУГАЯ' ? 'border-[#FF9900] bg-[#FFF8E7]' : 'border-[#D5D9D9]'}`}>
          <input type="radio" checked={mode === 'ДРУГАЯ'} onChange={() => setMode('ДРУГАЯ')} className="accent-[#FF9900]" />
          <span className="flex-1"><b>Другая дата</b><span className="mt-1 block"><input type="date" className={`${inputCls} max-w-[220px]`} value={date} onChange={(e) => { setDate(e.target.value); setErr(''); }} onClick={(e) => e.stopPropagation()} /></span></span>
        </label>
        {err && <p className="text-xs font-bold text-[#B12704]">{err}</p>}
      </div>
    </Modal>
  );
}

function LobeRejectModal({ ids, ctx, onClose }: { ids: string[]; ctx: Ctx; onClose: () => void }) {
  const { user, act } = ctx;
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  return (
    <Modal title={`Отклонение ЛОБЭ · заявок: ${ids.length}`} onClose={onClose} footer={<>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn variant="danger" onClick={() => {
        if (!reason) { setErr('Выберите причину'); return; }
        if (reason === OTHER_REASON && !comment.trim()) { setErr('Комментарий обязателен'); return; }
        if (act('Отклонено ЛОБЭ', (d) => lobeReject(d, ids, reason, comment, user.fio), { stage: 'lobe' })) onClose();
      }}><XCircle size={14} /> Отклонить</Btn>
    </>}>
      <Field label="Причина отклонения">
        <div className="space-y-1">
          {LOBE_REJECT_REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] ${reason === r ? 'border-[#B12704] bg-[#FDECEA]' : 'border-[#D5D9D9] hover:bg-[#F7F8F8]'}`}>
              <input type="radio" name="lobe-reason" checked={reason === r} onChange={() => { setReason(r); setErr(''); }} className="accent-[#B12704]" />
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

const POPUP_KEY = 'toro_lobe_popup_v1';

export function PrepView({ ctx }: { ctx: Ctx }) {
  const { db, user, simDate, act, openCard } = ctx;
  const inPlan = db.requests.filter((r) => r.status === 'IN_PLAN' && r.agreedDate);
  const prep = db.requests.filter((r) => r.status === 'PREPARATION');
  const reminders = useMemo(() => inPlan.filter((r) => diffDays(simDate, r.agreedDate!) <= 3).sort((a, b) => a.agreedDate!.localeCompare(b.agreedDate!)), [inPlan, simDate]);
  const [popup, setPopup] = useState(false);
  const [checkFor, setCheckFor] = useState<string | null>(null);

  useEffect(() => {
    if (reminders.length > 0 && sessionStorage.getItem(POPUP_KEY) !== '1') {
      setPopup(true);
      sessionStorage.setItem(POPUP_KEY, '1');
    }
  }, [reminders.length]);

  const takeToWork = (id: string) => {
    act('Подготовка начата', (d) => startPreparation(d, id, user.fio));
    setCheckFor(id);
  };

  const daysChip = (r: ProjectRequest) => {
    const d = diffDays(simDate, r.agreedDate!);
    const cls = d < 0 ? 'bg-[#FDE8E8] text-[#B12704]' : d <= 3 ? 'bg-[#FFF3D6] text-[#8A5A00]' : 'bg-[#E5F6F0] text-[#067D62]';
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{d === 0 ? 'сегодня' : `${d} ${plural(d, 'день', 'дня', 'дней')}`}</span>;
  };

  const inPlanCols: Col<ProjectRequest>[] = [
    { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 105 },
    { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 220 },
    { id: 'date', header: 'Согл. дата', acc: (r) => isoToRu(r.agreedDate), w: 100 },
    { id: 'left', header: 'До ремонта', acc: (r) => diffDays(simDate, r.agreedDate!), w: 100, align: 'center', render: (r) => daysChip(r) },
    {
      id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 300,
      render: (r) => (<div onClick={(e) => e.stopPropagation()}><Btn size="sm" variant="primary" onClick={() => takeToWork(r.id)}><Wrench size={13} /> Взять в работу по подготовке</Btn></div>),
    },
  ];

  const prepCols: Col<ProjectRequest>[] = [
    { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 105 },
    { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 220 },
    { id: 'date', header: 'Согл. дата', acc: (r) => isoToRu(r.agreedDate), w: 100 },
    {
      id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 180,
      render: (r) => (<div onClick={(e) => e.stopPropagation()}><Btn size="sm" variant="primary" onClick={() => setCheckFor(r.id)}><ClipboardCheck size={13} /> Чек-лист / Готово</Btn></div>),
    },
  ];

  const checkReq = checkFor ? db.requests.find((r) => r.id === checkFor) : null;

  return (
    <div className="space-y-4">
      {reminders.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#FF9900] bg-[#FFF4E0] px-4 py-3">
          <BellRing size={20} className="text-[#C45500]" />
          <div className="flex-1 text-[13px]">
            <b className="text-[#8A5A00]">Оборудование нужно подготовить к ремонту!</b>{' '}
            {reminders.map((r) => `${r.equipment.name} (${r.eqSrcNumber})`).join(', ')}
          </div>
          <Btn size="sm" variant="primary" onClick={() => setPopup(true)}><AlarmClock size={13} /> Показать список</Btn>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-bold">В плане — требуется подготовка ({inPlan.length})</h3>
        <DataTable cols={inPlanCols} data={inPlan} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[380px]" emptyTitle="Календарный план пуст" />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold">Заявки на подготовку ({prep.length})</h3>
        <DataTable cols={prepCols} data={prep} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[340px]" emptyTitle="Нет заявок на подготовке" />
      </div>

      {popup && (
        <Modal title="Напоминание: подготовка оборудования" onClose={() => setPopup(false)} footer={<Btn variant="primary" onClick={() => setPopup(false)}>Понятно</Btn>}>
          <div className="space-y-2">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-[#FF9900]/50 bg-[#FFF8E7] px-3 py-2 text-[13px]">
                <AlarmClock size={15} className="shrink-0 text-[#C45500]" />
                <span className="flex-1"><b>{r.equipment.name}</b> ({r.eqSrcNumber}) — {isoToRu(r.agreedDate)}</span>
                {daysChip(r)}
                <Btn size="sm" variant="primary" onClick={() => { setPopup(false); takeToWork(r.id); }}>Взять в работу</Btn>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {checkReq && <ChecklistModal req={checkReq} ctx={ctx} onClose={() => setCheckFor(null)} />}
    </div>
  );
}

function ChecklistModal({ req, ctx, onClose }: { req: ProjectRequest; ctx: Ctx; onClose: () => void }) {
  const { user, act, toast } = ctx;
  const [cleaned, setCleaned] = useState(req.prep?.cleaned ?? false);
  const [emptied, setEmptied] = useState(req.prep?.emptied ?? false);
  const [deenergized, setDeenergized] = useState(req.prep?.deenergized ?? false);
  const [comment, setComment] = useState(req.prep?.comment ?? '');
  const allDone = cleaned && emptied && deenergized;

  return (
    <Modal title={`Подготовка · ${req.equipment.name}`} onClose={onClose} footer={<>
      <Btn onClick={onClose}>Закрыть</Btn>
      <Btn variant="primary" disabled={!allDone} onClick={() => {
        if (act('Готово к ремонту', (d) => finishPreparation(d, req.id, { cleaned, emptied, deenergized, comment: comment.trim() }, user.fio))) {
          toast('success', 'Чек-лист сохранён');
          onClose();
        }
      }}><ClipboardCheck size={14} /> Готово к ремонту</Btn>
    </>}>
      <div className="space-y-1.5">
        {([['cleaned', 'Оборудование очищено', cleaned, setCleaned], ['emptied', 'Оборудование опорожнено', emptied, setEmptied], ['deenergized', 'Оборудование обесточено', deenergized, setDeenergized]] as const).map(([key, label, val, setter]) => (
          <label key={key} className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] ${val ? 'border-[#067D62] bg-[#E5F6F0]' : 'border-[#D5D9D9]'}`}>
            <input type="checkbox" className="h-4 w-4 accent-[#067D62]" checked={val} onChange={(e) => setter(e.target.checked)} />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-3">
        <Field label="Комментарий">
          <textarea className={`${inputCls} min-h-[70px]`} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </div>
      {!allDone && <p className="mt-2 text-xs text-[#8A5A00]">Отметьте все три операции.</p>}
    </Modal>
  );
}
