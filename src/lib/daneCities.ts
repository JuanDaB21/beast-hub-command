import data from "./daneCities.json";

export interface DaneCity {
  dane_code: string;
  name: string;
  department: string;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

interface IndexedCity extends DaneCity {
  _haystack: string;
}

const INDEX: IndexedCity[] = (data as DaneCity[]).map((c) => ({
  ...c,
  _haystack: norm(`${c.name} ${c.department}`),
}));

export const DANE_CITIES: DaneCity[] = data as DaneCity[];

export function searchDaneCities(query: string, limit = 50): DaneCity[] {
  const q = norm(query.trim());
  if (!q) return INDEX.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  const out: DaneCity[] = [];
  for (const c of INDEX) {
    if (tokens.every((t) => c._haystack.includes(t))) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
