import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, Clock3, CheckCheck } from 'lucide-react';
import { PHASES, STATUS_COLOR, STATUS_LABEL, type RequestStatus } from './types';
import { diffDays, isoToRu, plural } from './utils';

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'link';

export function Btn({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-all duration-100 active:translate-y-px disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none';
  const sizes = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]';
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-[#FFD814] border-[#FCD200] hover:bg-[#F5C800] text-[#0F1111] shadow-sm',
    secondary: 'bg-[#F0F2F2] border-[#D5D9D9] hover:bg-[#E7E9EC] text-[#0F1111]',
    danger: 'bg-[#B12704] border-[#B12704] hover:bg-[#962204] text-white',
    dangerSoft: 'bg-white border-[#B12704]/40 text-[#B12704] hover:bg-[#FDECEA]',
    link: 'border-transparent text-[#007185] hover:text-[#C7511F] hover:underline px-1',
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export type ToastType = 'success' | 'error' | 'warning';
export interface ToastMsg {
  id: number;
  type: ToastType;
  title: string;
  msg?: string;
}

export function ToastHost({ toasts, onClose }: { toasts: ToastMsg[]; onClose: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[300] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => {
        const bg = t.type === 'success' ? 'bg-[#067D62]' : t.type === 'error' ? 'bg-[#B12704]' : 'bg-[#C45500]';
        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertTriangle : Info;
        return (
          <div key={t.id} className={`${bg} toast-in flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-white shadow-lg`}>
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold leading-tight">{t.title}</div>
              {t.msg && <div className="mt-0.5 text-xs leading-snug opacity-90">{t.msg}</div>}
            </div>
            <button onClick={() => onClose(t.id)} className="shrink-0 opacity-70 transition-opacity hover:opacity-100" aria-label="Закрыть">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-xl',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[#0F1111]/60 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={`modal-in w-full ${width} rounded-lg border border-[#D5D9D9] bg-white shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#EAEBEC] px-5 py-3">
          <h3 className="font-display text-[15px] font-bold tracking-tight text-[#0F1111]">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-[#565959] transition-colors hover:bg-[#F0F2F2] hover:text-[#0F1111]" aria-label="Закрыть">
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-[#EAEBEC] bg-[#F7F8F8] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function StatusBadge({ status, auto }: { status: RequestStatus; auto?: boolean }) {
  const c = STATUS_COLOR[status];
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold leading-4" style={{ background: c.bg, color: c.fg }}>
      {auto && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B12704]" />}
      <span className="truncate">{STATUS_LABEL[status]}</span>
    </span>
  );
}

export function PhaseProgress({ simDate }: { simDate: string }) {
  const phases = [
    { label: 'Загрузка плана', until: PHASES.uploadUntil },
    { label: 'Согласование: ЛОИС + Исполнитель', until: PHASES.approvalUntil },
    { label: 'Согласование: ЛОБЭ', until: PHASES.lobeUntil },
    { label: `Выполнение · ${PHASES.planMonth}`, until: PHASES.executionEnd },
  ];
  const currentIdx = phases.findIndex((p) => simDate <= p.until);
  const total = diffDays(PHASES.processStart, PHASES.executionEnd);
  const passed = Math.min(Math.max(diffDays(PHASES.processStart, simDate), 0), total);
  const pct = Math.round((passed / total) * 100);
  const current = currentIdx === -1 ? null : phases[currentIdx];
  const daysLeft = current ? diffDays(simDate, current.until) : 0;

  return (
    <div className="rounded-lg border border-[#D5D9D9] bg-white px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-display text-[13px] font-bold tracking-tight text-[#0F1111]">Процесс согласования · план на {PHASES.planMonth}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F2F2] px-2.5 py-0.5 text-xs font-medium text-[#3B4859]">
          <Clock3 size={12} />
          {current ? (
            <>
              этап «{current.label}» — {daysLeft === 0 ? 'последний день' : `осталось ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}`}
              <span className="text-[#8A5A00]">(до {isoToRu(current.until)})</span>
            </>
          ) : (
            <>все регламентные этапы завершены</>
          )}
        </span>
        <span className="ml-auto text-xs text-[#565959]">общий прогресс: <b className="text-[#0F1111]">{pct}%</b></span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
        {phases.map((p, i) => {
          const done = currentIdx !== -1 && i < currentIdx;
          const active = i === currentIdx;
          const overdue = currentIdx === -1;
          return (
            <div
              key={p.label}
              className={`rounded-md border px-2.5 py-1.5 transition-colors ${
                done
                  ? 'border-[#067D62]/30 bg-[#E5F6F0] text-[#067D62]'
                  : active
                    ? 'phase-pulse border-[#FF9900] bg-[#FFF3D6] text-[#8A5A00]'
                    : overdue
                      ? 'border-[#D5D9D9] bg-[#F5F7F7] text-[#8A9199]'
                      : 'border-[#D5D9D9] bg-[#FAFBFB] text-[#565959]'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold leading-4">
                {done ? <CheckCheck size={12} /> : active ? <Clock3 size={12} /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-40" />}
                <span className="truncate">{p.label}</span>
              </div>
              <div className="mt-0.5 text-[10px] opacity-75">до {isoToRu(p.until)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDF0F0]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#FF9900] to-[#FFD814] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[#0F1111]">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-[#565959]">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-md border border-[#888C8C] bg-white px-2.5 py-1.5 text-[13px] text-[#0F1111] outline-none transition-shadow placeholder:text-[#8A9199] focus:border-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/40 disabled:bg-[#F5F7F7] disabled:text-[#8A9199]';

export function KpiTile({ label, value, tone = '#0F1111', sub }: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#D5D9D9] bg-white px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#565959]">{label}</div>
      <div className="font-display mt-1 text-[26px] font-extrabold leading-none" style={{ color: tone }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-[#8A9199]">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <div className="text-sm font-bold text-[#3B4859]">{title}</div>
      {hint && <div className="max-w-md text-xs text-[#8A9199]">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
