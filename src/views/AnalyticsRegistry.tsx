import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Ctx } from '../ctx';
import type { ProjectRequest, RequestStatus } from '../types';
import { STATUS_LABEL } from '../types';
import { SHOPS, loisUsers, WORK_TYPES } from '../data';
import { reqCols } from './PlannerUpp';
import { DataTable, type Col } from '../DataTable';
import { Btn, EmptyState, KpiTile, Modal, StatusBadge, inputCls } from '../ui';
import { diffDays, fmtNum, isoToRu } from '../utils';

export function RegistryView({ ctx }: { ctx: Ctx }) {
  const { db, openCard } = ctx;
  return (
    <DataTable cols={reqCols(true)} data={db.requests} rowId={(r) => r.id} searchPlaceholder="Глобальный поиск…" onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[620px]" emptyTitle="Реестр пуст" />
  );
}

const PIE_COLORS = ['#232F3E', '#007185', '#FF9900', '#067D62', '#B12704', '#C45500', '#8A9199', '#FFD814', '#37475A', '#046D5B', '#8A5A00', '#7E1503', '#3B4859', '#962204'];

export function AnalyticsView({ ctx }: { ctx: Ctx }) {
  const { db, openCard } = ctx;
  const [shopF, setShopF] = useState('');
  const [loisF, setLoisF] = useState('');
  const [wtF, setWtF] = useState('');

  const filtered = useMemo(() => db.requests.filter((r) => {
    if (shopF && String(r.shopNo) !== shopF) return false;
    if (loisF && r.responsibleLois !== loisF) return false;
    if (wtF && !r.workTypes.includes(wtF)) return false;
    return true;
  }), [db.requests, shopF, loisF, wtF]);

  const rejected = filtered.filter((r) => ['LOIS_REJECTED', 'EXECUTOR_REJECTED', 'LOBE_REJECTED', 'AUTO_REJECTED'].includes(r.status));
  const done = filtered.filter((r) => r.status === 'DONE');
  const agreed = filtered.filter((r) => r.agreedDate != null);

  const deviations = done.filter((r) => r.downtimeDays != null && r.report?.factStart && r.report?.factEnd).map((r) => diffDays(r.report!.factStart, r.report!.factEnd) + 1 - r.downtimeDays!);
  const avgDev = deviations.length ? deviations.reduce((s, x) => s + x, 0) / deviations.length : null;

  const byShop = useMemo(() => {
    const m = new Map<number, { shop: string; plan: number; fact: number }>();
    for (const r of filtered) {
      const e = m.get(r.shopNo) ?? { shop: `${r.shopNo} цех`, plan: 0, fact: 0 };
      if (r.agreedDate && r.downtimeDays != null) e.plan += r.downtimeDays;
      if (r.status === 'DONE' && r.report?.factStart && r.report?.factEnd) e.fact += diffDays(r.report.factStart, r.report.factEnd) + 1;
      m.set(r.shopNo, e);
    }
    return [...m.values()].sort((a, b) => a.shop.localeCompare(b.shop, 'ru'));
  }, [filtered]);

  const statusDist = useMemo(() => {
    const m = new Map<RequestStatus, number>();
    filtered.forEach((r) => m.set(r.status, (m.get(r.status) ?? 0) + 1));
    return [...m.entries()].map(([s, v]) => ({ name: STATUS_LABEL[s], value: v, status: s }));
  }, [filtered]);

  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      if (r.status === 'AUTO_REJECTED') m.set('Просрочка подготовки (авто)', (m.get('Просрочка подготовки (авто)') ?? 0) + 1);
      else if (r.rejection) m.set(r.rejection.reason, (m.get(r.rejection.reason) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const rejCols: Col<ProjectRequest>[] = [
    { id: 'eq', header: 'Оборудование', acc: (r) => `${r.equipment.name} · ${r.eqSrcNumber}`, w: 260 },
    { id: 'st', header: 'Статус', acc: (r) => STATUS_LABEL[r.status], w: 230, forceSelect: true, render: (r) => <StatusBadge status={r.status} auto={r.isAutoRejected} /> },
    { id: 'reason', header: 'Причина', acc: (r) => (r.status === 'AUTO_REJECTED' ? 'Просрочка подготовки (автоматически)' : r.rejection?.reason ?? '—'), w: 280 },
    { id: 'comm', header: 'Комментарий', acc: (r) => r.rejection?.comment ?? '', w: 260 },
    { id: 'by', header: 'Кто', acc: (r) => r.rejection?.by ?? 'Система', w: 200 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#D5D9D9] bg-white px-4 py-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[#565959]">Цех</span>
          <select className={`${inputCls} w-56`} value={shopF} onChange={(e) => setShopF(e.target.value)}>
            <option value="">Все цеха</option>
            {SHOPS.map((s) => <option key={s.no} value={s.no}>{s.no} — {s.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[#565959]">ЛОИС</span>
          <select className={`${inputCls} w-56`} value={loisF} onChange={(e) => setLoisF(e.target.value)}>
            <option value="">Все</option>
            {loisUsers().map((u) => <option key={u.id} value={u.fio}>{u.fio}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[#565959]">Вид работ</span>
          <select className={`${inputCls} w-56`} value={wtF} onChange={(e) => setWtF(e.target.value)}>
            <option value="">Все виды</option>
            {WORK_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        {(shopF || loisF || wtF) && <Btn size="sm" onClick={() => { setShopF(''); setLoisF(''); setWtF(''); }}>Сбросить</Btn>}
        <span className="ml-auto text-xs text-[#8A9199]">в срезе: {filtered.length} из {db.requests.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[#D5D9D9] bg-white"><EmptyState title="Нет данных по выбранным фильтрам" /></div>
      ) : (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile label="Согласовано в план" value={agreed.length} tone="#007185" />
          <KpiTile label="Выполнено" value={done.length} tone="#067D62" />
          <KpiTile label="Отклонено + автонесогл." value={rejected.length} tone="#B12704" />
          <KpiTile label="Среднее отклонение, дн." value={avgDev == null ? '—' : `${avgDev > 0 ? '+' : ''}${fmtNum(avgDev, 1)}`} tone={avgDev != null && avgDev > 0 ? '#C45500' : '#067D62'} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-[#D5D9D9] bg-white p-4">
            <h3 className="mb-3 text-sm font-bold">План vs Факт: дни простоя по цехам</h3>
            {byShop.length === 0 ? <EmptyState title="Нет данных" /> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byShop} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EC" />
                    <XAxis dataKey="shop" tick={{ fontSize: 11, fill: '#565959' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#565959' }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="plan" name="План" fill="#232F3E" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="fact" name="Факт" fill="#FF9900" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#D5D9D9] bg-white p-4">
            <h3 className="mb-3 text-sm font-bold">Распределение по статусам</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2} stroke="#fff">
                    {statusDist.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[#D5D9D9] bg-white p-4">
          <h3 className="mb-3 text-sm font-bold">Причины отклонений</h3>
          {reasons.length === 0 ? <EmptyState title="Отклонений нет" /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasons} layout="vertical" margin={{ top: 0, right: 16, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E9EC" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#565959' }} />
                  <YAxis type="category" dataKey="name" width={250} tick={{ fontSize: 10, fill: '#3B4859' }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Заявок" fill="#B12704" radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold">Отклонённые и автонесогласованные ({rejected.length})</h3>
          <DataTable cols={rejCols} data={rejected} rowId={(r) => r.id} onRowClick={(r) => openCard(r.id)} maxHeightClass="max-h-[420px]" emptyTitle="Отклонённых нет" />
        </div>
      </>)}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#8A9199]">{label}</div>
      <div className={`mt-0.5 text-[13px] font-medium text-[#0F1111] ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  );
}

export function RequestCard({ req, onClose }: { req: ProjectRequest; onClose: () => void }) {
  return (
    <Modal title={`Проект заявки ${req.id.slice(-4).toUpperCase()} · ${req.equipment.name}`} onClose={onClose} width="max-w-5xl" footer={<Btn variant="primary" onClick={onClose}>Закрыть</Btn>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={req.status} auto={req.isAutoRejected} />
          {req.isAutoRejected && <span className="rounded bg-[#B12704] px-1.5 py-0.5 text-[10px] font-bold text-white">is_auto_rejected: true</span>}
        </div>

        {req.rejection && (
          <div className="rounded-md border border-[#B12704]/40 bg-[#FDECEA] px-3 py-2 text-[13px] text-[#B12704]">
            <b>Отклонено ({req.rejection.stage}):</b> {req.rejection.reason}
            {req.rejection.comment && <span> — {req.rejection.comment}</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-[#EAEBEC] bg-[#FAFBFB] p-3 sm:grid-cols-4">
          <Info label="Цех" value={`${req.shopNo} — ${req.shopName}`} />
          <Info label="Корпус" value={req.building} />
          <Info label="Участок" value={req.section} />
          <Info label="№ ед. оборудования" value={req.eqSrcNumber} mono />
          <Info label="Код ЕО" value={req.equipment.eoCode} mono />
          <Info label="Модель" value={req.equipment.model} />
          <Info label="Исполнитель" value={req.assignedExecutorFio} />
          <Info label="Виды работ" value={req.workTypes.join(', ')} />
          <Info label="Дата начала (план)" value={isoToRu(req.plannedStart)} />
          <Info label="Дата ЛОИС" value={isoToRu(req.loisDate)} />
          <Info label="Согласованная дата" value={<b>{isoToRu(req.agreedDate)}</b>} />
          <Info label="Кол-во дней простоя" value={req.downtimeDays == null ? 'не заполнено' : `${req.downtimeDays} дн.`} />
        </div>

        <div>
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#565959]">История согласований</h4>
          <div className="max-h-56 space-y-0 overflow-y-auto rounded-md border border-[#EAEBEC]">
            {req.history.map((h, i) => (
              <div key={i} className="relative flex gap-3 border-b border-[#EAEBEC] px-3 py-2 last:border-b-0">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${i === req.history.length - 1 ? 'bg-[#FF9900]' : 'bg-[#C9CED4]'}`} />
                  {i < req.history.length - 1 && <span className="mt-0.5 w-px flex-1 bg-[#E7E9EC]" />}
                </div>
                <div className="min-w-0 flex-1 text-[12px]">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <b className="text-[#0F1111]">{h.from === '—' ? 'Создание' : `${STATUS_LABEL[h.from]} →`} {STATUS_LABEL[h.to]}</b>
                    <span className="text-[#8A9199]">{h.by} · {h.at}</span>
                  </div>
                  {h.note && <div className="mt-0.5 text-[#565959]">{h.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
