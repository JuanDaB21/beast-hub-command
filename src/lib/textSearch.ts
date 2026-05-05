export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesAllTokens(haystack: string, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const hay = normalizeText(haystack);
  return q.split(" ").every((tok) => hay.includes(tok));
}
