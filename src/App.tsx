/* ============================================================
 * Оболочка приложения: роли, навигация, симулируемые часы процесса,
 * планировщик (напоминания T-3 и автонесогласование), тосты, печать.
 * ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, CalendarDays, RotateCcw, Wrench } from 'lucide-react';
import { loadDB, phaseOverdueWarning, resetDB, runScheduler } from './backend';
import { USERS } from './data';
import type { DB, Role } from './types';
import { ROLE_LABEL, STATUS_LABEL } from './types';
import type { Ctx, PrintPayload } from './ctx';
import { Btn, Modal, PhaseProgress, ToastHost, type ToastMsg, type ToastType } from './ui';
import { diffDays, isoToRu, plural } from './utils';
import { PlannerView, UppView } from './views/PlannerUpp';
import { LoisApproval, RepairView, ShiftTasks } from './views/Lois';
import { ExecutorView, LobeView, PrepView } from './views/ExecutorLobe';
import { AnalyticsView, RegistryView, RequestCard } from './views/AnalyticsRegistry';

interface NavItem {
  id: string;
  label: string;
}

const NAV: Record<Role, NavItem[]> = {
  PLANNER: [
    { id: 'plan', label: 'Планирование и импорт' },
    { id: 'registry', label: 'Реестр заявок' },
    { id: 'analytics', label: 'Аналитика' },
  ],
  UPP: [
    { id: 'upp', label: 'Согласование УПП' },
    { id: 'registry', label: 'Реестр заявок' },
    { id: 'analytics', label: 'Аналитика' },
  ],
  LOIS: [
    { id: 'lois', label: 'Согласование ЛОИС' },
    { id: 'tasks', label: 'Сменно-суточные задания' },
    { id: 'repair', label: 'Ремонт и отчётность' },
    { id: 'registry', label: 'Реестр заявок' },
    { id: 'analytics', label: 'Аналитика' },
  ],
  EXECUTOR: [
    { id: 'executor', label: 'Мои заявки на согласование' },
    { id: 'registry', label: 'Реестр заявок' },
  ],
  LOBE: [
    { id: 'lobe', label: 'Согласование ЛОБЭ' },
    { id: 'prep', label: 'Подготовка оборудования' },
    { id: 'registry', label: 'Реестр заявок' },
    { id: 'analytics', label: 'Аналитика' },
  ],
  FOREMAN: [
    { id: 'tasks', label: 'Задания бригады' },
    { id: 'registry', label: 'Реестр заявок' },
  ],
};

export default function App() {
  const [db, setDb] = useState<DB>(() => loadDB());
  const dbRef = useRef(db);
  const [userId, setUserId] = useState<string>(USERS[0].id);
  const user = useMemo(() => USERS.find((u) => u.id === userId) ?? USERS[0], [userId]);
  const [tab, setTab] = useState<string>(NAV[user.role][0].id);
  const [simDate, setSimDate] = useState('2026-07-04'); // демо-часы процесса
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastId = useRef(0);
  const [cardId, setCardId] = useState<string | null>(null);
  const [print, setPrint] = useState<PrintPayload | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const toast = useCallback((type: ToastType, title: string, msg?: string) => {
    const id = ++toastId.current;
    setToasts((p) => [...p.slice(-3), { id, type, title, msg }]);
    // зелёный/красный/жёлтый тост исчезает через 3 секунды
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  /* «эндпоинты» с валидацией: ApiError -> красный тост, успех -> зелёный */
  const act = useCallback(
    (title: string, fn: (d: DB) => DB, opts?: { extra?: string; stage?: 'upload' | 'approval' | 'lobe' }): boolean => {
      try {
        const next = fn(dbRef.current);
        dbRef.current = next;
        setDb(next);
        toast('success', title, opts?.extra);
        if (opts?.stage) {
          const warn = phaseOverdueWarning(simDate, opts.stage);
          if (warn) toast('warning', 'Действие вне регламентного срока', warn);
        }
        return true;
      } catch (e) {
        toast('error', 'Действие не выполнено', e instanceof Error ? e.message : 'Неизвестная ошибка');
        return false;
      }
    },
    [simDate, toast],
  );

  /* Планировщик: напоминания T-3 и автонесогласование при просрочке (Этапы 5 и 8) */
  useEffect(() => {
    const res = runScheduler(dbRef.current, simDate);
    if (res.db !== dbRef.current) {
      dbRef.current = res.db;
      setDb(res.db);
      if (res.autoRejected.length > 0) {
        toast('warning', `Автонесогласование: ${res.autoRejected.length} ${plural(res.autoRejected.length, 'заявка', 'заявки', 'заявок')}`, res.autoRejected.map((r) => `${r.equipment.name} (${r.eqSrcNumber})`).join(', ') + ' — просрочена подготовка, заявки ушли в Аналитику');
      }
    }
    /* db.requests в зависимостях: крон должен срабатывать не только при смене даты,
       но и сразу после действий (например, ЛОБЭ согласовал заявку прошедшей датой —
       автонесогласование наступит немедленно, не дожидаясь смены симулируемой даты).
       runScheduler возвращает тот же объект db при отсутствии изменений → цикл завершается. */
  }, [simDate, toast, db.requests]);

  /* сброс активной вкладки при смене роли */
  useEffect(() => {
    setTab(NAV[user.role][0].id);
  }, [user.role]);

  /* печать: формируем форму -> window.print() -> очистка */
  useEffect(() => {
    if (!print) return;
    const t = setTimeout(() => window.print(), 120);
    const clear = () => setPrint(null);
    window.addEventListener('afterprint', clear);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', clear);
    };
  }, [print]);

  const reminders = useMemo(
    () => db.requests.filter((r) => r.status === 'IN_PLAN' && r.agreedDate && diffDays(simDate, r.agreedDate) <= 3).length,
    [db.requests, simDate],
  );

  const ctx: Ctx = {
    db,
    user,
    simDate,
    toast,
    act,
    openCard: setCardId,
    setPrint,
  };

  const cardReq = cardId ? db.requests.find((r) => r.id === cardId) : null;

  const renderView = () => {
    switch (tab) {
      case 'plan': return <PlannerView ctx={ctx} />;
      case 'upp': return <UppView ctx={ctx} />;
      case 'lois': return <LoisApproval ctx={ctx} />;
      case 'tasks': return <ShiftTasks ctx={ctx} />;
      case 'repair': return <RepairView ctx={ctx} />;
      case 'executor': return <ExecutorView ctx={ctx} />;
      case 'lobe': return <LobeView ctx={ctx} />;
      case 'prep': return <PrepView ctx={ctx} />;
      case 'registry': return <RegistryView ctx={ctx} />;
      case 'analytics': return <AnalyticsView ctx={ctx} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      {/* Шапка в стилистике amazon */}
      <header className="bg-[#131921] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#FF9900] text-[#131921]">
              <Wrench size={19} strokeWidth={2.4} />
            </span>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-extrabold tracking-tight">ТОРО · Согласование ремонтов</div>
              <div className="text-[11px] text-[#D5D9D9]">вывод оборудования в ремонт · план на Август 2026</div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {reminders > 0 && user.role === 'LOBE' && (
              <button onClick={() => setTab('prep')} className="relative flex items-center gap-1.5 rounded-md border border-[#FF9900]/60 bg-[#232F3E] px-2.5 py-1.5 text-xs font-bold text-[#FFD814] hover:bg-[#2d3a4c]" title="Есть оборудование, требующее подготовки">
                <BellRing size={14} />
                Подготовка: {reminders}
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#FF9900] phase-pulse" />
              </button>
            )}
            <label className="flex items-center gap-1.5 text-[11px] text-[#D5D9D9]">
              <CalendarDays size={14} />
              <span className="hidden lg:inline">Симуляция даты процесса</span>
              <input
                type="date"
                value={simDate}
                onChange={(e) => { if (e.target.value) setSimDate(e.target.value); }}
                className="rounded border border-[#3B4859] bg-[#232F3E] px-2 py-1 text-xs text-white outline-none focus:border-[#FF9900] [color-scheme:dark]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-[#D5D9D9]">
              <span className="hidden md:inline">Вы вошли как</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="max-w-[240px] rounded border border-[#3B4859] bg-[#232F3E] px-2 py-1.5 text-xs font-medium text-white outline-none focus:border-[#FF9900]"
              >
                {(['PLANNER', 'UPP', 'LOIS', 'EXECUTOR', 'LOBE', 'FOREMAN'] as Role[]).map((role) => (
                  <optgroup key={role} label={ROLE_LABEL[role]}>
                    {USERS.filter((u) => u.role === role).map((u) => (
                      <option key={u.id} value={u.id}>{u.fio}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1 rounded-md border border-[#3B4859] px-2 py-1.5 text-[11px] font-medium text-[#D5D9D9] transition-colors hover:border-[#FF9900] hover:text-white"
              title="Вернуть демо-данные к исходному состоянию"
            >
              <RotateCcw size={12} /> Сбросить демо
            </button>
          </div>
        </div>

        {/* Навигация роли */}
        <nav className="bg-[#232F3E]">
          <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-4">
            {NAV[user.role].map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`relative shrink-0 rounded-t px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  tab === n.id ? 'text-white' : 'text-[#C9CED4] hover:bg-white/5 hover:text-white'
                }`}
              >
                {n.label}
                {n.id === 'prep' && reminders > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#FF9900] px-1.5 py-0.5 text-[10px] font-extrabold text-[#131921]">{reminders}</span>
                )}
                {tab === n.id && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-[#FF9900]" />}
              </button>
            ))}
            <span className="ml-auto hidden shrink-0 py-2 pl-3 text-[11px] text-[#8A9199] sm:block">
              роль: <b className="text-[#FFD814]">{ROLE_LABEL[user.role]}</b>
            </span>
          </div>
        </nav>
      </header>

      {/* Контент */}
      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-4">
        <PhaseProgress simDate={simDate} />
        <div key={`${user.id}:${tab}`} className="fade-up">
          {renderView()}
        </div>
        <p className="pb-4 text-center text-[11px] text-[#8A9199]">
          Демонстрационная среда: данные хранятся локально в браузере · регламентные сроки этапов настраиваются в конфиге PHASES
        </p>
      </main>

      {/* Карточка заявки */}
      {cardReq && <RequestCard req={cardReq} onClose={() => setCardId(null)} />}
      {cardId && !cardReq && <RequestMissing onClose={() => setCardId(null)} />}

      {/* Подтверждение сброса демо-данных */}
      {confirmReset && (
        <Modal
          title="Сбросить демонстрационные данные?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <Btn onClick={() => setConfirmReset(false)}>Отмена</Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  const fresh = resetDB();
                  dbRef.current = fresh;
                  setDb(fresh);
                  setConfirmReset(false);
                  setSimDate('2026-07-04');
                  sessionStorage.clear();
                  toast('success', 'Демо-данные восстановлены', 'Все заявки возвращены к исходному сценарию');
                }}
              >
                <RotateCcw size={14} /> Сбросить
              </Btn>
            </>
          }
        >
          <p className="text-[13px] text-[#565959]">
            Все изменения (импорты, согласования, отчёты) будут удалены, процесс вернётся к исходному демонстрационному сценарию.
          </p>
        </Modal>
      )}

      {/* Печатная форма: рендер в body через портал — иначе многостраничная печать режется
          (классический баг visibility:hidden + position:absolute внутри #root) */}
      {print && createPortal(<PrintSheet p={print} />, document.body)}

      <ToastHost toasts={toasts} onClose={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
}

function RequestMissing({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Заявка не найдена" onClose={onClose} footer={<Btn variant="primary" onClick={onClose}>Закрыть</Btn>}>
      <p className="text-[13px] text-[#565959]">Заявка была удалена или данные сброшены. Откройте карточку из реестра заново.</p>
    </Modal>
  );
}

/* ============================================================
 * ПЕЧАТНАЯ ФОРМА (видна только при печати)
 * ============================================================ */

function PrintSheet({ p }: { p: PrintPayload }) {
  return (
    <div className="print-sheet">
      <div style={{ borderBottom: '2px solid #0F1111', paddingBottom: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>СМЕННО-СУТОЧНОЕ ЗАДАНИЕ НА РЕМОНТ ОБОРУДОВАНИЯ</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Дата формирования: <b>{isoToRu(p.simDate)}</b> · Мастер: <b>{p.foremanFio}</b> · Бригада: {p.crewName}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['№', '№ ед. обор.', 'Оборудование', 'Вид работы', 'Исполнитель', 'Согл. дата', 'Простой, дн.', 'Часы', 'Статус'].map((h) => (
              <th key={h} style={{ border: '1px solid #0F1111', padding: '4px 6px', background: '#F0F2F2', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.items.map((r, i) => (
            <tr key={r.id}>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>{i + 1}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>{r.eqSrcNumber}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>
                {r.equipment.name}, {r.equipment.model}
                <div style={{ fontSize: 10, color: '#565959' }}>цех {r.shopNo}, корп. {r.building}, участок: {r.section}</div>
              </td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>{r.workTypes.join(', ')}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>{r.assignedExecutorFio}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>{isoToRu(r.agreedDate)}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px', textAlign: 'center' }}>{r.downtimeDays ?? '—'}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px', textAlign: 'center' }}>{Math.round(r.operations.reduce((s, o) => s + o.hoursTotal, 0) * 10) / 10}</td>
              <td style={{ border: '1px solid #0F1111', padding: '4px 6px' }}>{STATUS_LABEL[r.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, fontSize: 12 }}>
        <div>Мастер: ______________________ / {p.foremanFio} /</div>
        <div>Ознакомлен (исполнитель): ______________________</div>
      </div>
      <div style={{ marginTop: 16, fontSize: 10, color: '#565959' }}>Сформировано системой «ТОРО · Согласование ремонтов»</div>
    </div>
  );
}
