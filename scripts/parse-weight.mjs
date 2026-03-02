import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Month name → zero-padded month number
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', march: '03',
  apr: '04', april: '04', may: '05',
  jun: '06', june: '06', jul: '07', july: '07',
  aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function monthNum(str) {
  // Handle "0ct" typo (zero instead of letter O)
  const normalized = str.toLowerCase().replace(/^0ct$/i, 'oct');
  return MONTH_MAP[normalized] ?? null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Parse a date from the note title.
 * Returns "YYYY-MM-DD" string, or null if no pattern matches.
 */
function parseDate(title, createdTimestampUsec) {
  // Normalize: trim + collapse multiple spaces
  const t = title.trim().replace(/\s+/g, ' ');

  let m;

  // ── Pattern A+D ──────────────────────────────────────────────────────────
  // WEEKDAY MONTH DAY YEAR body comp[osition] [anything]
  // e.g. "Sat Sep 23 2023 body comp"
  //      "Fri April 8 2022 body comp (in place of Sat April 9)"
  m = t.match(/^(\w+)\s+(\w+)\s+(\d{1,2})\s+(\d{4})\s+body comp/i);
  if (m) {
    const mo = monthNum(m[2]);
    if (mo) return `${m[4]}-${mo}-${pad2(m[3])}`;
  }

  // ── Pattern B ────────────────────────────────────────────────────────────
  // WEEKDAY MONTH DAY (in place of ...) YEAR body comp
  // e.g. "Mon Sep 18 (in place of Sat Sep 16) 2023 body comp"
  //      "Sun 0ct 31 (in place of Sat Oct 30) 2021 body comp"
  m = t.match(/^(\w+)\s+(\w+)\s+(\d{1,2})\s+\([^)]*\)\s+(\d{4})\s+body comp/i);
  if (m) {
    const mo = monthNum(m[2]);
    if (mo) return `${m[4]}-${mo}-${pad2(m[3])}`;
  }

  // ── Pattern C ────────────────────────────────────────────────────────────
  // WEEKDAY MONTH DAY (in place of WEEKDAY MONTH DAY YEAR) body comp
  // e.g. "Sun May 21 (in place of Sat May 20 2023) body comp"
  m = t.match(/^(\w+)\s+(\w+)\s+(\d{1,2})\s+\(in place of[^)]*?(\d{4})\)\s+body comp/i);
  if (m) {
    const mo = monthNum(m[2]);
    if (mo) return `${m[4]}-${mo}-${pad2(m[3])}`;
  }

  // ── Pattern E ────────────────────────────────────────────────────────────
  // MONTH DAY (WEEKDAY) body comp [anything]
  // e.g. "sep 14 (tue) body comp [in place of sep 11 Sat]"
  // Year comes from the note's creation timestamp
  m = t.match(/^(\w+)\s+(\d{1,2})\s+\(\w+\)\s+body comp/i);
  if (m) {
    const mo = monthNum(m[1]);
    if (mo) {
      const year = new Date(Number(createdTimestampUsec) / 1000).getFullYear();
      return `${year}-${mo}-${pad2(m[2])}`;
    }
  }

  return null;
}

/**
 * Extract all weight readings from a note.
 * Returns array of numbers (40–150 kg range).
 */
function extractWeights(data) {
  let lines;
  if (data.textContent) {
    lines = data.textContent.split('\n');
  } else if (Array.isArray(data.listContent)) {
    lines = data.listContent.map(item => item.text);
  } else {
    return [];
  }

  const weights = [];
  for (const line of lines) {
    // Skip lines with no digit (handles "--", empty lines, pure text separators)
    if (!/\d/.test(line)) continue;

    // Split by comma, parse each part as float.
    // parseFloat stops at the first non-numeric character, so lines like
    // "64.80, 64.80, 64.80 (comment...)" are handled correctly.
    // "Body fat % caliper reading: 16" → parseFloat = NaN (starts with letter).
    // Range filter 40–150 eliminates caliper readings (≈16) and fat % (≈19).
    for (const part of line.split(',')) {
      const val = parseFloat(part.trim());
      if (!isNaN(val) && val >= 40 && val <= 150) {
        weights.push(val);
      }
    }
  }
  return weights;
}

/**
 * 0.5 kg sliding-window cluster: find the largest cluster of readings
 * where max − min ≤ 0.5 kg, then return their average.
 */
function clusterWeights(weights) {
  if (weights.length === 0) return null;

  const sorted = [...weights].sort((a, b) => a - b);
  let bestStart = 0, bestSize = 1, start = 0;

  for (let end = 1; end < sorted.length; end++) {
    while (sorted[end] - sorted[start] > 0.5) start++;
    if (end - start + 1 > bestSize) {
      bestSize = end - start + 1;
      bestStart = start;
    }
  }

  const cluster = sorted.slice(bestStart, bestStart + bestSize);
  return Math.round(cluster.reduce((s, v) => s + v, 0) / cluster.length * 100) / 100;
}

// ── Main ──────────────────────────────────────────────────────────────────

const keepDir = join(ROOT, 'keep');
const files = readdirSync(keepDir)
  .filter(f => f.toLowerCase().includes('body comp') && f.endsWith('.json'));

console.log(`Found ${files.length} body comp JSON files`);

const results = [];
let skipped = 0;

for (const filename of files) {
  const data = JSON.parse(readFileSync(join(keepDir, filename), 'utf8'));

  // Skip trashed notes
  if (data.isTrashed) {
    console.log(`  SKIP (trashed): ${data.title}`);
    skipped++;
    continue;
  }

  const date = parseDate(data.title, data.createdTimestampUsec);
  if (!date) {
    console.log(`  SKIP (no date): ${data.title}`);
    skipped++;
    continue;
  }

  const rawWeights = extractWeights(data);
  if (rawWeights.length === 0) {
    console.log(`  SKIP (no weights): ${data.title}  →  date=${date}`);
    skipped++;
    continue;
  }

  const weight = clusterWeights(rawWeights);
  results.push({ date, weight });
}

console.log(`\nParsed: ${results.length} entries, skipped: ${skipped}`);

// Sort by date
results.sort((a, b) => a.date.localeCompare(b.date));

// Deduplicate: warn + keep last on same date
const seen = new Map();
for (const entry of results) {
  if (seen.has(entry.date)) {
    console.warn(`  WARN duplicate date ${entry.date}: keeping ${entry.weight} (was ${seen.get(entry.date)})`);
  }
  seen.set(entry.date, entry.weight);
}

const deduped = [...seen.entries()]
  .map(([date, weight]) => ({ date, weight }))
  .sort((a, b) => a.date.localeCompare(b.date));

console.log(`\nFinal: ${deduped.length} unique dates`);
console.log(`Range: ${deduped[0]?.date}  →  ${deduped[deduped.length - 1]?.date}`);

// Spot-check helper
function check(date, expected) {
  const entry = deduped.find(e => e.date === date);
  const got = entry?.weight;
  const ok = got === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${date}: expected ${expected}, got ${got}`);
}

console.log('\nSpot checks:');
check('2021-10-31', 65.77);
check('2023-09-18', 65.55);

// Write output
mkdirSync(join(ROOT, 'data'), { recursive: true });

writeFileSync(
  join(ROOT, 'data', 'weights.json'),
  JSON.stringify(deduped, null, 2),
  'utf8'
);

const csv = 'date,weight\n' + deduped.map(e => `${e.date},${e.weight}`).join('\n');
writeFileSync(join(ROOT, 'data', 'weights.csv'), csv, 'utf8');

console.log('\nWritten: data/weights.json and data/weights.csv');
