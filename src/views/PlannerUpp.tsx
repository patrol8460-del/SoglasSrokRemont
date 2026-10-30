import { useRef, useState } from 'react';
import { CalendarClock, Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { Ctx } from '../ctx';
import type { AttachedPart, ProjectRequest } from '../types';
import { STATUS_LABEL } from '../types';
import { buildFactRows, importPlan, plannerSetNewDate, PLAN_HEADERS, uppApproveWithParts, uppRejectNoParts, validatePlanMatrix } from '../backend';
import { PLANNER_GROUPS, SPARE_PARTS } from '../data';
import { readSpreadsheet, writeXlsx } from '../xlsx';
import { DataTable, type Col } from '../DataTable';
import { Btn, EmptyState, Field, inputCls, KpiTile, Modal, StatusBadge } from '../ui';
import { isoToRu, normStr } from '../utils';

export const reqCols = (withStatus: boolean): Col<ProjectRequest>[] => [
  { id: 'id', header: '№', acc: (r) => r.id.slice(-4).toUpperCase(), w: 70 },
  ...(withStatus ? [{ id: 'status', header: 'Статус', acc: (r: ProjectRequest) => STATUS_LABEL[r.status], w: 230, forceSelect: true, render: (r: ProjectRequest) => <StatusBadge status={r.status} auto={r.isAutoRejected} /> } as Col<ProjectRequest>] : []),
  { id: 'shop', header: 'Цех', acc: (r) => `${r.shopNo} — ${r.shopName}`, w: 200 },
  { id: 'eqn', header: '№ ед. обор.', acc: (r) => r.eqSrcNumber, w: 110 },
  { id: 'name', header: 'Наименование', acc: (r) => r.equipment.name, w: 230 },
  { id: 'model', header: 'Модель', acc: (r) => r.equipment.model, w: 160 },
  { id: 'wt', header: 'Вид работы', acc: (r) => r.workTypes.join(', '), w: 170 },
  { id: 'ex', header: 'Исполнитель', acc: (r) => r.assignedExecutorFio, w: 200 },
  { id: 'plan', header: 'План. дата', acc: (r) => isoToRu(r.plannedStart), w: 100 },
  { id: 'agreed', header: 'Согл. дата', acc: (r) => isoToRu(r.agreedDate), w: 100 },
  { id: 'days', header: 'Простой, дн.', acc: (r) => (r.downtimeDays == null ? '' : r.downtimeDays), w: 95, align: 'right' },
];

export function PlannerView({ ctx }: { ctx: Ctx }) {
  const { db, user, toast, act, openCard } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const [newDateFor, setNewDateFor] = useState<string[] | null>(null);
  const [newDate, setNewDate] = useState('');

  const reqs = db.requests;
  const done = reqs.filter((r) => r.status === 'DONE').length;
  const inPlan = reqs.filter((r) => ['IN_PLAN', 'PREPARATION', 'AWAITING_REPAIR', 'IN_REPAIR'].includes(r.status)).length;
  const rejected = reqs.filter((r) => ['LOIS_REJECTED', 'EXECUTOR_REJECTED', 'LOBE_REJECTED', 'AUTO_REJECTED'].includes(r.status)).length;
  const reschedule = reqs.filter((r) => r.status === 'UPP_RESCHEDULE');

  const onFile = async (file: File) => {
    try {
      const matrix = await readSpreadsheet(file);
      const v = validatePlanMatrix(matrix);
      toast('success', 'Файл прочитан', `${matrix.length} строк`);
    } catch (e) {
      toast('error', 'Ошибка', e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportFact = () => {
    const rows = buildFactRows(db.requests);
    writeXlsx(`Факт_ремонтов_${ctx.simDate}.xlsx`, rows);
    toast('success', 'Факт выгружен');
  };

  const cols: Col<ProjectRequest>[] = [
    ...reqCols(true),
    {
      id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 150,
      render: (r) => r.status === 'UPP_RESCHEDULE' ? (
        <div onClick={(e) => e.stopPropagation()}>
          <Btn size="sm" variant="primary" onClick={() => setNewDateFor([r.id])}>
            <CalendarClock size={13} /> Новая дата
          </Btn>
        </div>
      ) : <span className="text-[#B4B9B9]">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Всего проектов" value={reqs.length} />
        <KpiTile label="В плане / в работе" value={inPlan} tone="#007185" />
        <KpiTile label="Выполнено" value={done} tone="#067D62" />
        <KpiTile label="Отклонено" value={rejected} tone="#B12704" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D5D9D9] bg-white px-4 py-3">
        <span className="text-[13px] font-bold">План на Август 2026:</span>
        <Btn variant="secondary" onClick={() => { writeXlsx('Шаблон.xlsx', [PLAN_HEADERS]); toast('success', 'Шаблон сформирован'); }}>
          <FileSpreadsheet size={15} /> Скачать шаблон
        </Btn>
        <Btn variant="primary" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Загрузить план
        </Btn>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
        <span className="mx-1 h-5 w-px bg-[#D5D9D9]" />
        <Btn variant="secondary" onClick={exportFact}>
          <Download size={15} /> Выгрузить факт
        </Btn>
      </div>

      {reschedule.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#FF9900]/50 bg-[#FFF4E0] px-4 py-2.5 text-[13px]">
          <span className="font-bold text-[#8A5A00]">Требуют переноса: {reschedule.length}</span>
          <Btn size="sm" variant="primary" onClick={() => { setNewDateFor(reschedule.map((r) => r.id)); setNewDate(''); }}>
            <CalendarClock size={13} /> Задать новую дату
          </Btn>
        </div>
      )}

      <DataTable cols={cols} data={reqs} rowId={(r) => r.id} searchPlaceholder="Поиск…" onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[560px]" emptyTitle="Нет проектов заявок" />

      {newDateFor && (
        <Modal title={`Новая дата · заявок: ${newDateFor.length}`} onClose={() => setNewDateFor(null)} footer={<>
          <Btn onClick={() => setNewDateFor(null)}>Отмена</Btn>
          <Btn variant="primary" onClick={() => {
            if (act('Дата перенесена', (d) => plannerSetNewDate(d, newDateFor, newDate, user.fio))) setNewDateFor(null);
          }}>Перенести</Btn>
        </>}>
          <Field label="Новая дата">
            <input type="date" className={inputCls} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

export function UppView({ ctx }: { ctx: Ctx }) {
  const { db, user, act, openCard } = ctx;
  const queue = db.requests.filter((r) => r.status === 'NEW');
  const [partsFor, setPartsFor] = useState<string[] | null>(null);
  const [noPartsFor, setNoPartsFor] = useState<string[] | null>(null);
  const [reason, setReason] = useState('');

  const cols: Col<ProjectRequest>[] = [
    ...reqCols(false),
    {
      id: 'act', header: 'Действия', acc: () => '', sortable: false, filterable: false, w: 230,
      render: (r) => (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Btn size="sm" variant="primary" onClick={() => setPartsFor([r.id])}>Есть запчасти</Btn>
          <Btn size="sm" variant="dangerSoft" onClick={() => { setNoPartsFor([r.id]); setReason(''); }}>Нет запчастей</Btn>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable cols={cols} data={queue} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)}
        bulkBar={(sel, clear) => (<>
          <Btn size="sm" variant="primary" onClick={() => setPartsFor(sel.map((r) => r.id))}>Есть запчасти</Btn>
          <Btn size="sm" variant="dangerSoft" onClick={() => { setNoPartsFor(sel.map((r) => r.id)); setReason(''); }}>Нет запчастей</Btn>
          <Btn size="sm" variant="link" onClick={clear}>Снять</Btn>
        </>)}
        emptyTitle="Очередь УПП пуста" />

      {partsFor && <PartsModal ids={partsFor} ctx={ctx} onClose={() => setPartsFor(null)} />}

      {noPartsFor && (
        <Modal title={`Нет запчастей · ${noPartsFor.length}`} onClose={() => setNoPartsFor(null)} footer={<>
          <Btn onClick={() => setNoPartsFor(null)}>Отмена</Btn>
          <Btn variant="danger" onClick={() => {
            if (!reason.trim()) return;
            if (act('Перенос срока', (d) => uppRejectNoParts(d, noPartsFor, reason, user.fio))) setNoPartsFor(null);
          }}>Перенести</Btn>
        </>}>
          <Field label="Причина (обязательно)">
            <textarea className={`${inputCls} min-h-[90px]`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

function PartsModal({ ids, ctx, onClose }: { ids: string[]; ctx: Ctx; onClose: () => void }) {
  const { db, user, act } = ctx;
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});

  const list = SPARE_PARTS.filter((p) => normStr(`${p.code} ${p.name}`).includes(normStr(q)));
  const selected: AttachedPart[] = Object.entries(picked).map(([code, qty]) => {
    const p = SPARE_PARTS.find((x) => x.code === code)!;
    return { code, name: p.name, qty };
  }).filter((p) => p.qty > 0);
  const invalidQty = Object.values(picked).some((qty) => !isFinite(qty) || qty <= 0);
  const requests = db.requests.filter((r) => ids.includes(r.id));

  return (
    <Modal title={`Резервирование запчастей УПП · заявок: ${ids.length}`} onClose={onClose} width="max-w-6xl" footer={<>
      <Btn onClick={onClose}>Отмена</Btn>
      <Btn variant="primary" disabled={invalidQty} onClick={() => {
        if (act('Согласовано УПП', (d) => uppApproveWithParts(d, ids, selected, user.fio))) onClose();
      }}>Согласовать: есть запчасти</Btn>
    </>}>
      <div className="mb-4 rounded-md border border-[#D5D9D9] bg-[#F7F8F8] p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#565959]">Заявки на согласование</div>
        <div className="max-h-32 space-y-1.5 overflow-y-auto">
          {requests.map((r) => (
            <div key={r.id} className="flex items-start gap-2 rounded-md bg-white px-2.5 py-1.5 text-[12px]">
              <span className="font-mono text-[10px] text-[#8A9199]">{r.id.slice(-4).toUpperCase()}</span>
              <span className="flex-1"><b>{r.equipment.name}</b><span className="ml-2 text-[#565959]">({r.eqSrcNumber})</span></span>
              <span className="text-[#565959]">цех {r.shopNo}</span>
              <span className="text-[#565959]">· {r.workTypes.join(', ')}</span>
            </div>
          ))}
        </div>
      </div>

      <input className={inputCls} placeholder="Поиск по коду или наименованию…" value={q} onChange={(e) => setQ(e.target.value)} />

      {SPARE_PARTS.length === 0 ? (
        <EmptyState title="Справочник запчастей пуст" />
      ) : list.length === 0 ? (
        <EmptyState title="Ничего не найдено" />
      ) : (
        <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-md border border-[#D5D9D9]">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-[#F0F2F2]">
              <tr>
                <th className="w-10 px-2 py-2" />
                <th className="px-2 py-2 text-left text-[11px] font-bold">Код</th>
                <th className="px-2 py-2 text-left text-[11px] font-bold">Наименование</th>
                <th className="px-2 py-2 text-left text-[11px] font-bold">Ед.</th>
                <th className="px-2 py-2 text-right text-[11px] font-bold">Остаток</th>
                <th className="w-28 px-2 py-2 text-right text-[11px] font-bold">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const on = picked[p.code] !== undefined;
                return (
                  <tr key={p.code} className={`border-t border-[#EAEBEC] ${on ? 'bg-[#FFF8E7]' : 'hover:bg-[#F7F8F8]'}`}>
                    <td className="px-2 py-2">
                      <input type="checkbox" className="h-4 w-4 accent-[#FF9900]" checked={on} onChange={(e) => setPicked((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[p.code] = 1; else delete next[p.code];
                        return next;
                      })} />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-[#565959]">{p.code}</td>
                    <td className="px-2 py-2 font-medium">{p.name}</td>
                    <td className="px-2 py-2 text-[#565959]">{p.unit}</td>
                    <td className={`px-2 py-2 text-right font-bold ${p.stock === 0 ? 'text-[#B12704]' : 'text-[#067D62]'}`}>{p.stock}</td>
                    <td className="px-2 py-2 text-right">
                      {on && <input type="number" min={1} value={picked[p.code]} onChange={(e) => setPicked((prev) => ({ ...prev, [p.code]: Number(e.target.value) }))} className="w-20 rounded border border-[#888C8C] px-1.5 py-0.5 text-right text-xs outline-none focus:border-[#FF9900]" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-4 rounded-md border border-[#FF9900]/40 bg-[#FFF4E0] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#8A5A00]">К резервированию</span>
            <span className="rounded-full bg-[#FF9900] px-2 py-0.5 text-[10px] font-bold text-[#131921]">{selected.length} позиций</span>
          </div>
          <div className="space-y-1">
            {selected.map((p) => (
              <div key={p.code} className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[12px]">
                <span className="font-mono text-[10px] text-[#8A9199]">{p.code}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                <span className="font-bold">×{p.qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
