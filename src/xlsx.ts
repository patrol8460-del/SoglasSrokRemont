import { unzip, zipStore } from './inflate';

export type CellValue = string | number;
export type SheetMatrix = CellValue[][];

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function xmlSafe(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colLetter(idx: number): string {
  let n = idx;
  let s = '';
  for (;;) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

export function writeXlsx(fileName: string, rows: CellValue[][]): void {
  const sheetRows = rows
    .map((row, ri) => {
      const cells = row
        .map((v, ci) => {
          const ref = `${colLetter(ci)}${ri + 1}`;
          if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
          const s = xmlEsc(xmlSafe(String(v ?? '')));
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${s}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="План" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const enc = new TextEncoder();
  const zip = zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) },
  ]);
  const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 400);
}

function cellRefToPos(ref: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return { col: 0, row: 0 };
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: parseInt(m[2], 10) - 1 };
}

function parseSheetXml(xml: string, shared: string[]): SheetMatrix {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Не удалось разобрать XML внутри XLSX — файл повреждён');
  }
  const rows = doc.getElementsByTagName('row');
  const matrix: SheetMatrix = [];
  for (let i = 0; i < rows.length; i++) {
    const rowEl = rows[i];
    const cells = rowEl.getElementsByTagName('c');
    let autoCol = 0;
    for (let j = 0; j < cells.length; j++) {
      const c = cells[j];
      const ref = c.getAttribute('r');
      let pos = { col: autoCol, row: matrix.length };
      if (ref) pos = cellRefToPos(ref);
      autoCol = pos.col + 1;
      while (matrix.length <= pos.row) matrix.push([]);
      const rowArr = matrix[pos.row];
      while (rowArr.length <= pos.col) rowArr.push('');
      const type = c.getAttribute('t') || '';
      const vEl = c.getElementsByTagName('v')[0];
      const tEl = c.getElementsByTagName('t')[0];
      let value: CellValue = '';
      if (type === 's' && vEl) {
        value = shared[parseInt(vEl.textContent || '0', 10)] ?? '';
      } else if (type === 'inlineStr' && tEl) {
        value = tEl.textContent ?? '';
      } else if (type === 'str' && vEl) {
        value = vEl.textContent ?? '';
      } else if (type === 'b' && vEl) {
        value = vEl.textContent === '1' ? 'Истина' : 'Ложь';
      } else if (vEl) {
        const txt = vEl.textContent ?? '';
        const num = Number(txt);
        value = txt !== '' && isFinite(num) && type !== 's' ? num : txt;
      }
      rowArr[pos.col] = value;
    }
  }
  return matrix;
}

function parseSharedStrings(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const sis = doc.getElementsByTagName('si');
  const res: string[] = [];
  for (let i = 0; i < sis.length; i++) {
    const ts = sis[i].getElementsByTagName('t');
    let s = '';
    for (let j = 0; j < ts.length; j++) s += ts[j].textContent ?? '';
    res.push(s);
  }
  return res;
}

export function parseCsv(text: string): SheetMatrix {
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delims = [';', ',', '\t'];
  let delim = ';';
  let best = -1;
  for (const d of delims) {
    const cnt = firstLine.split(d).length - 1;
    if (cnt > best) {
      best = cnt;
      delim = d;
    }
  }
  const rows: SheetMatrix = [];
  let row: CellValue[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => String(c).trim() !== '')) rows.push(row);
  return rows;
}

export async function readSpreadsheet(file: File): Promise<SheetMatrix> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = await file.text();
    if (!text.trim()) throw new Error('Файл пуст');
    return parseCsv(text);
  }
  if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm')) {
    throw new Error('Поддерживаются форматы .xlsx и .csv');
  }
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const files = unzip(buf);
    const sheet = files.get('xl/worksheets/sheet1.xml');
    if (!sheet) throw new Error('В файле не найден первый лист');
    const ssFile = files.get('xl/sharedStrings.xml');
    const shared = ssFile ? parseSharedStrings(new TextDecoder().decode(ssFile)) : [];
    const matrix = parseSheetXml(new TextDecoder().decode(sheet), shared);
    if (matrix.length === 0) throw new Error('Первый лист файла пуст');
    return matrix;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Поддерживаются')) throw e;
    throw new Error(`Не удалось прочитать файл: ${e instanceof Error ? e.message : 'неизвестная ошибка'}`);
  }
}
