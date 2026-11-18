import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Point { from: string; viewers: number; channels?: number | null }
interface Comparable {
  name: string;
  day_start: string;
  unlock: string;
  platforms: string;
  hourly: Point[];
}
interface Case {
  day_start: string;
  known: Array<{ hour: number; viewers: number }>;
  history_hourly?: Point[];
  comparables?: Comparable[];
}
interface Launch {
  weight: number;
  curve: Array<number | null>;
}

const HOUR = 3600000;
const Z = [-1.6448536269514722, -0.6744897501960817, 0,
  0.6744897501960817, 1.6448536269514722];
// Calibrated by leave-one-out evaluation over the kit's comparables so the 90% interval is honest.
const SIGMA_SCALE = 1.2;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// A launch is an observation, not each of its hundreds of prelaunch rows.
// Exclude premieres, early access, and global PC unlocks. Give the strongest
// weight to console-only releases, including ones with unverified unlock notes.
function relevance(c: Comparable): number {
  const text = c.unlock.toLowerCase();
  if (/target-history|not a launch|tier: weak|early-access-contaminated/.test(text)) return 0;
  const consoleOnly = !/\bpc\b|steam|stadia/i.test(c.platforms);
  if (consoleOnly) return 1;
  if (/weak analogue|live-service|multiplayer|free-to-play/.test(text)) return 0;
  if (!/midnight local|rolling/.test(text)) return 0;
  return 0.15;
}

function launches(c: Case): Launch[] {
  const result: Launch[] = [];
  const checkpoint = c.known.find(row => row.hour === 1)?.viewers ?? 1;
  const targetStart = Date.parse(c.day_start);
  const target = new Map<number, number>();
  for (const row of c.history_hourly ?? []) {
    const t = (Date.parse(row.from) - targetStart) / HOUR;
    if (Number.isInteger(t) && t < 0 && Number.isFinite(row.viewers)) {
      target.set(t, Math.log(Math.max(1, row.viewers) / Math.max(1, checkpoint)));
    }
  }
  for (const comp of c.comparables ?? []) {
    let weight = relevance(comp);
    if (!weight) continue;
    const start = Date.parse(comp.day_start);
    const values = new Map<number, number>();
    for (const row of comp.hourly) {
      const t = (Date.parse(row.from) - start) / HOUR;
      if (Number.isInteger(t) && Number.isFinite(row.viewers) && row.viewers >= 0) {
        values.set(t, Math.max(1, row.viewers));
      }
    }
    const first = values.get(0);
    if (!first || first < 100 || Array.from({ length: 24 }, (_, h) => values.has(h)).filter(Boolean).length < 18) continue;
    // Compare only information available before the forecast checkpoint.
    // Tighter pre-launch similarity weighting, leave-one-out calibrated.
    let distance = 0;
    let observed = 0;
    for (const t of [-1, -2, -4, -8, -12]) {
      const a = target.get(t);
      const b = values.get(t);
      if (a === undefined || b === undefined) continue;
      distance += Math.min(4, (a - Math.log(b / first)) ** 2);
      observed++;
    }
    if (observed) weight *= 0.2 + 0.8 * Math.exp(-distance / observed / (2 * 0.4 ** 2));
    const curve = Array.from({ length: 24 }, (_, h) => {
      const v = values.get(h);
      return v === undefined ? null : Math.log(v / first);
    });
    result.push({ weight, curve });
  }
  return result;
}

export function forecast(c: Case): { hours: Array<{ hour: number; q: number[] }> } {
  const first = c.known.find(row => row.hour === 1);
  if (!first || !Number.isFinite(first.viewers)) throw new Error('Missing finite hour-1 print');
  const anchor = Math.log(Math.max(1, first.viewers));
  const samples = launches(c);
  const means: number[] = [0];
  const variances: number[] = [0];
  for (let h = 1; h < 24; h++) {
    const rows = samples.filter(s => s.curve[h] !== null);
    const w = rows.reduce((sum, s) => sum + s.weight, 0);
    const w2 = rows.reduce((sum, s) => sum + s.weight ** 2, 0);
    if (rows.length < 2 || w === 0) {
      means[h] = 0;
      variances[h] = 0.15 ** 2 * h;
      continue;
    }
    const mean = rows.reduce((sum, s) => sum + s.weight * s.curve[h]!, 0) / w;
    // Weighted sample variance of log(viewers[h]/viewers[1]) around the
    // fitted hourly shape; include uncertainty in the estimated mean.
    const residualSS = rows.reduce((sum, s) => sum + s.weight * (s.curve[h]! - mean) ** 2, 0);
    means[h] = mean;
    variances[h] = residualSS / (w - w2 / w) * (1 + w2 / (w * w));
  }
  const hours = Array.from({ length: 23 }, (_, i) => {
    const h = i + 1;
    // Mild local pooling stabilizes variance without erasing unlock jumps.
    const variance = 0.6 * variances[h] + 0.2 * variances[Math.max(1, h - 1)]
      + 0.2 * variances[Math.min(23, h + 1)];
    const sigma = Math.sqrt(Math.max(0.03 ** 2, variance)) * SIGMA_SCALE;
    return { hour: h + 1, q: Z.map(z => Math.exp(clamp(anchor + means[h] + z * sigma, Math.log(0.01), Math.log(1e9)))) };
  });
  return { hours };
}

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outputDir, { recursive: true });
for (const file of readdirSync(inputDir).filter(name => name.endsWith('.in')).sort()) {
  const c = JSON.parse(readFileSync(join(inputDir, file), 'utf8')) as Case;
  writeFileSync(join(outputDir, `${file.slice(0, -3)}.out`), `${JSON.stringify(forecast(c))}\n`);
}
