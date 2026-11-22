// Filter kata kasar sederhana (Indonesia & Sunda) untuk menjaga chat tetap kondusif
const BLOCKED_WORDS = [
  'anjing',
  'anjir',
  'bangsat',
  'bajingan',
  'goblok',
  'tolol',
  'bego',
  'kontol',
  'memek',
  'ngentot',
  'asu',
  'anying',
  'kehed',
  'goblog',
  'koplok',
  'sialan',
];

export function sanitizeAndFilterMessage(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('Pesan harus berupa teks.');
  }
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (trimmed.length < 1 || trimmed.length > 160) {
    throw new Error('Panjang pesan harus 1 hingga 160 karakter.');
  }

  let filtered = trimmed;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, (match) => '*'.repeat(match.length));
  }
  return filtered;
}
