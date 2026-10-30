import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';

export interface Col<T> {
  id: string;
  header: string;
  acc: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  w?: number;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  filterable?: boolean;
  forceSelect?: boolean;
}

interface Props<T> {
  cols: Col<T>[];
  data: T[];
  rowId: (row: T) => string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  bulkBar?: (selected: T[], clear: () => void) => ReactNode;
  onRowClick?: (row: T) => void;
  maxHeightClass?: string;
  emptyTitle?: string;
  emptyHint?: string;
}

const MIN_W = 64;

export function DataTable<T>({
  cols,
  data,
  rowId,
  searchPlaceholder = 'Поиск по всем полям…',
  toolbar,
  bulkBar,
  onRowClick,
  maxHeightClass = 'max-h-[540px]',
  emptyTitle = 'Нет данных',
  emptyHint,
}: Props<T>) {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(cols.map((c) => [c.id, c.w ?? 160])),
  );
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [global, setGlobal] = useState('');
  const [colF, setColF] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const dragRef = useRef<{ id: string; startX: number; startW: number } | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const w = Math.max(MIN_W, d.startW + (e.clientX - d.startX));
      setWidths((prev) => ({ ...prev, [d.id]: w }));
    };
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        forceTick((x) => x + 1);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  const startResize = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { id, startX: e.clientX, startW: widths[id] ?? 160 };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const distinct = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of cols) {
      const s = new Set<string>();
      for (const r of data) s.add(String(c.acc(r) ?? ''));
      m[c.id] = [...s].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
    }
    return m;
  }, [cols, data]);

  const isSelectCol = (c: Col<T>) => c.forceSelect || (distinct[c.id]?.length ?? 0) <= 14;

  const filtered = useMemo(() => {
    const q = global.trim().toLowerCase();
    return data.filter((r) => {
      if (q) {
        const hay = cols.map((c) => String(c.acc(r) ?? '')).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const c of cols) {
        const f = colF[c.id];
        if (!f) continue;
        const v = String(c.acc(r) ?? '');
        if (isSelectCol(c)) {
          if (v !== f) return false;
        } else if (!v.toLowerCase().includes(f.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, cols, global, colF, distinct]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = cols.find((c) => c.id === sort.id);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const va = col.acc(a);
      const vb = col.acc(b);
      let res: number;
      if (typeof va === 'number' && typeof vb === 'number') res = va - vb;
      else res = String(va ?? '').localeCompare(String(vb ?? ''), 'ru', { numeric: true });
      return res * sort.dir;
    });
  }, [filtered, sort, cols]);

  const selectedRows = useMemo(() => sorted.filter((r) => selected.has(rowId(r))), [sorted, selected, rowId]);
  const allVisibleSelected = sorted.length > 0 && sorted.every((r) => selected.has(rowId(r)));
  const someSelected = selectedRows.length > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) sorted.forEach((r) => next.delete(rowId(r)));
      else sorted.forEach((r) => next.add(rowId(r)));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtersActive = global.trim() !== '' || Object.values(colF).some(Boolean);
  const resetAll = () => {
    setGlobal('');
    setColF({});
    setSort(null);
  };

  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckbox.current) {
      headerCheckbox.current.indeterminate = someSelected && !allVisibleSelected;
    }
  }, [someSelected, allVisibleSelected]);

  const totalW = cols.reduce((s, c) => s + (widths[c.id] ?? c.w ?? 160), 0) + (bulkBar ? 40 : 0);
  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="overflow-hidden rounded-lg border border-[#D5D9D9] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EAEBEC] bg-[#F7F8F8] px-3 py-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#8A9199]" />
          <input
            value={global}
            onChange={(e) => setGlobal(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-64 rounded-md border border-[#888C8C] bg-white pl-7 pr-7 text-[13px] outline-none placeholder:text-[#8A9199] focus:border-[#FF9900] focus:ring-2 focus:ring-[#FF9900]/40"
          />
          {global && (
            <button onClick={() => setGlobal('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#8A9199] hover:text-[#0F1111]" aria-label="Очистить">
              <X size={13} />
            </button>
          )}
        </div>
        {filtersActive && (
          <button onClick={resetAll} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#D5D9D9] bg-white px-2.5 text-xs font-medium text-[#007185] hover:bg-[#F0F2F2]">
            <X size={12} /> Сбросить фильтры
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">{toolbar}</div>
      </div>

      {bulkBar && someSelected && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#FF9900]/40 bg-[#FFF4E0] px-3 py-2 text-[13px] text-[#0F1111]">
          <span className="font-bold">Выбрано: {selectedRows.length}</span>
          <span className="mx-1 h-4 w-px bg-[#D5D9D9]" />
          {bulkBar(selectedRows, () => setSelected(new Set()))}
        </div>
      )}

      <div className={`overflow-auto ${maxHeightClass}`}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth: totalW }}>
          <colgroup>
            {bulkBar && <col style={{ width: 40 }} />}
            {cols.map((c) => (
              <col key={c.id} style={{ width: widths[c.id] ?? c.w ?? 160 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {bulkBar && (
                <th className="sticky top-0 z-[6] border-b border-[#D5D9D9] bg-[#F0F2F2] px-2 py-0">
                  <div className="flex h-9 items-center justify-center">
                    <input type="checkbox" ref={headerCheckbox} checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 accent-[#FF9900]" />
                  </div>
                </th>
              )}
              {cols.map((c) => (
                <th key={c.id} className="group sticky top-0 z-[5] border-b border-[#D5D9D9] bg-[#F0F2F2] px-0 text-left">
                  <div className="relative flex h-9 items-center gap-1 overflow-hidden px-2">
                    {(c.sortable ?? true) ? (
                      <button
                        onClick={() => setSort((s) => (s?.id !== c.id ? { id: c.id, dir: 1 } : s.dir === 1 ? { id: c.id, dir: -1 } : null))}
                        className="flex min-w-0 items-center gap-1 text-[12px] font-bold text-[#0F1111] hover:text-[#C7511F]"
                        title="Сортировать"
                      >
                        <span className="truncate">{c.header}</span>
                        {sort?.id === c.id && (sort.dir === 1 ? <ArrowUp size={12} className="shrink-0 text-[#C7511F]" /> : <ArrowDown size={12} className="shrink-0 text-[#C7511F]" />)}
                      </button>
                    ) : (
                      <span className="truncate text-[12px] font-bold text-[#0F1111]">{c.header}</span>
                    )}
                    <div
                      onMouseDown={(e) => startResize(e, c.id)}
                      className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize bg-transparent transition-colors hover:bg-[#FF9900] group-hover:bg-[#E0E3E3]"
                      title="Потяните, чтобы изменить ширину"
                    />
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              {bulkBar && <th className="sticky top-9 z-[6] border-b border-[#D5D9D9] bg-[#FAFBFB] px-2 py-1" />}
              {cols.map((c) => {
                if (c.filterable === false) return <th key={c.id} className="sticky top-9 z-[5] border-b border-[#D5D9D9] bg-[#FAFBFB] px-2 py-1" />;
                return (
                  <th key={c.id} className="sticky top-9 z-[5] border-b border-[#D5D9D9] bg-[#FAFBFB] px-1.5 py-1">
                    {isSelectCol(c) ? (
                      <select
                        value={colF[c.id] ?? ''}
                        onChange={(e) => setColF((p) => ({ ...p, [c.id]: e.target.value }))}
                        className="h-6 w-full cursor-pointer rounded border border-[#D5D9D9] bg-white px-1 text-[11px] text-[#3B4859] outline-none focus:border-[#FF9900]"
                      >
                        <option value="">Все</option>
                        {(distinct[c.id] ?? []).map((v) => (
                          <option key={v} value={v}>
                            {v === '' ? '—' : v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={colF[c.id] ?? ''}
                        onChange={(e) => setColF((p) => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="Фильтр…"
                        className="h-6 w-full rounded border border-[#D5D9D9] bg-white px-1.5 text-[11px] outline-none placeholder:text-[#B4B9B9] focus:border-[#FF9900]"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.length + (bulkBar ? 1 : 0)}>
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <div className="text-sm font-bold text-[#3B4859]">{emptyTitle}</div>
                    {emptyHint && <div className="max-w-md text-xs text-[#8A9199]">{emptyHint}</div>}
                    {filtersActive && (
                      <button onClick={resetAll} className="text-xs font-medium text-[#007185] hover:underline">
                        Сбросить фильтры и поиск
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {sorted.map((r, ri) => {
              const id = rowId(r);
              const isSel = selected.has(id);
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(r)}
                  style={{ animationDelay: `${Math.min(ri, 12) * 16}ms` }}
                  className={`row-in border-b border-[#EAEBEC] transition-colors last:border-b-0 ${onRowClick ? 'cursor-pointer' : ''} ${
                    isSel ? 'bg-[#FFF8E7]' : 'odd:bg-white even:bg-[#FBFCFC] hover:bg-[#F3F8F8]'
                  }`}
                >
                  {bulkBar && (
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(id)} className="h-4 w-4 accent-[#FF9900]" />
                    </td>
                  )}
                  {cols.map((c) => (
                    <td key={c.id} className={`overflow-hidden px-2 py-1.5 text-[13px] text-[#0F1111] ${alignCls(c.align)}`}>
                      <div className="truncate" title={String(c.acc(r) ?? '')}>
                        {c.render ? c.render(r) : String(c.acc(r) ?? '') || <span className="text-[#B4B9B9]">—</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#EAEBEC] bg-[#F7F8F8] px-3 py-1.5 text-[11px] text-[#565959]">
        <span>
          Показано <b className="text-[#0F1111]">{sorted.length}</b> из {data.length}
          {someSelected && (
            <>
              {' · '}выбрано <b className="text-[#C7511F]">{selectedRows.length}</b>
            </>
          )}
        </span>
        <span className="hidden sm:block">клик по заголовку — сортировка · граница шапки — ширина · строка — карточка</span>
      </div>
    </div>
  );
}
