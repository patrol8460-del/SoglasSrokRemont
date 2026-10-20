/* Минимальный ZIP-декомпрессор (store + deflate) для чтения XLSX */

export function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;
  while (pos < buf.length - 4) {
    const sig = view.getUint32(pos, true);
    if (sig === 0x04034b50) {
      const comp = view.getUint16(pos + 8, true);
      const compSize = view.getUint32(pos + 18, true);
      const nameLen = view.getUint16(pos + 26, true);
      const extraLen = view.getUint16(pos + 28, true);
      const name = new TextDecoder().decode(buf.slice(pos + 30, pos + 30 + nameLen));
      const dataStart = pos + 30 + nameLen + extraLen;
      const data = buf.slice(dataStart, dataStart + compSize);
      if (comp === 0) {
        files.set(name, data);
      } else if (comp === 8) {
        files.set(name, inflate(data));
      }
      pos = dataStart + compSize;
    } else if (sig === 0x02014b50) {
      break;
    } else {
      pos++;
    }
  }
  return files;
}

function inflate(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let pos = 0;
  const readBits = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = Math.floor(pos / 8);
      const bit = pos % 8;
      if (byte >= data.length) return v;
      v |= ((data[byte] >> bit) & 1) << i;
      pos++;
    }
    return v;
  };
  const align = () => { if (pos % 8) pos += 8 - (pos % 8); };
  
  while (pos < data.length * 8) {
    const final = readBits(1);
    const type = readBits(2);
    if (type === 0) {
      align();
      const byte = Math.floor(pos / 8);
      if (byte + 4 > data.length) break;
      const len = data[byte] | (data[byte + 1] << 8);
      pos = (byte + 4) * 8;
      for (let i = 0; i < len; i++) out.push(data[Math.floor(pos / 8) + i]);
      pos += len * 8;
    } else if (type === 1 || type === 2) {
      const fixed = type === 1;
      let litLen: number[], dist: number[];
      if (fixed) {
        litLen = [];
        for (let i = 0; i <= 143; i++) litLen[i] = 8;
        for (let i = 144; i <= 255; i++) litLen[i] = 9;
        for (let i = 256; i <= 279; i++) litLen[i] = 7;
        for (let i = 280; i <= 287; i++) litLen[i] = 8;
        dist = new Array(30).fill(5);
      } else {
        const hlit = readBits(5) + 257;
        const hdist = readBits(5) + 1;
        const hclen = readBits(4) + 4;
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const clens: number[] = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) clens[order[i]] = readBits(3);
        const ctree = buildTree(clens);
        const lens: number[] = [];
        while (lens.length < hlit + hdist) {
          const sym = decode(ctree);
          if (sym < 16) lens.push(sym);
          else if (sym === 16) { const r = readBits(2) + 3; const l = lens[lens.length - 1] ?? 0; for (let i = 0; i < r; i++) lens.push(l); }
          else if (sym === 17) { const r = readBits(3) + 3; for (let i = 0; i < r; i++) lens.push(0); }
          else { const r = readBits(7) + 11; for (let i = 0; i < r; i++) lens.push(0); }
        }
        litLen = lens.slice(0, hlit);
        dist = lens.slice(hlit);
      }
      const litTree = buildTree(litLen);
      const distTree = buildTree(dist);
      function decode(tree: any): number {
        let node = tree;
        while (typeof node !== 'number') {
          const bit = readBits(1);
          node = node[bit];
        }
        return node;
      }
      const lenBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
      const lenExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
      const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
      const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
      
      while (true) {
        const sym = decode(litTree);
        if (sym < 256) {
          out.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const li = sym - 257;
          const length = lenBase[li] + readBits(lenExtra[li]);
          const dsym = decode(distTree);
          const distance = distBase[dsym] + readBits(distExtra[dsym]);
          const start = out.length - distance;
          for (let i = 0; i < length; i++) out.push(out[start + i]);
        }
      }
    } else {
      break;
    }
    if (final) break;
  }
  return new Uint8Array(out);
}

function buildTree(lens: number[]): any {
  const maxLen = Math.max(...lens.filter(l => l > 0), 0);
  if (maxLen === 0) return -1;
  const blCount = new Array(maxLen + 1).fill(0);
  for (const l of lens) if (l > 0) blCount[l]++;
  const nextCode = new Array(maxLen + 1).fill(0);
  let code = 0;
  for (let bits = 1; bits <= maxLen; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }
  const tree: any = {};
  for (let i = 0; i < lens.length; i++) {
    const len = lens[i];
    if (len === 0) continue;
    const c = nextCode[len]++;
    let node = tree;
    for (let j = len - 1; j >= 0; j--) {
      const bit = (c >> j) & 1;
      if (j === 0) node[bit] = i;
      else {
        if (!node[bit]) node[bit] = {};
        node = node[bit];
      }
    }
  }
  return tree;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true);
    lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    new Uint8Array(lh).set(nameBytes, 30);
    parts.push(new Uint8Array(lh), f.data);
    
    const ch = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(ch);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(12, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    new Uint8Array(ch).set(nameBytes, 46);
    centralDir.push(new Uint8Array(ch));
    offset += 30 + nameBytes.length + f.data.length;
  }
  
  const cdOffset = offset;
  let cdSize = 0;
  for (const c of centralDir) { parts.push(c); cdSize += c.length; }
  
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  parts.push(new Uint8Array(eocd));
  
  let total = 0;
  for (const p of parts) total += p.length;
  const result = new Uint8Array(total);
  let p = 0;
  for (const part of parts) { result.set(part, p); p += part.length; }
  return result;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
