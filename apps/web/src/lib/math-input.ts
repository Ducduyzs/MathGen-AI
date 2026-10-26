// Kiểm tra định dạng số học sinh nhập: số nguyên, thập phân (1,5 hoặc 1.5), phân số (3/2).
// Frontend chỉ kiểm tra định dạng; chấm đúng/sai luôn do backend làm.

const NUMBER_RE = /^-?\d+(?:\.\d+)?(?:\/-?\d+(?:\.\d+)?)?$/;

export function parseNumber(raw: string): number | null {
  const s = raw.replace(/\s+/g, "").replace(/,/g, ".");
  if (!NUMBER_RE.test(s)) return null;
  const [numerator, denominator] = s.split("/");
  const n = Number(numerator);
  if (denominator === undefined) return n;
  const d = Number(denominator);
  return d === 0 ? null : n / d;
}

export function sameNumber(a: string, b: string) {
  const x = parseNumber(a);
  const y = parseNumber(b);
  return x !== null && y !== null && Math.abs(x - y) < 1e-9;
}
