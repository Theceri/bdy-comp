'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { WeightEntry } from './page';

interface Props {
  data: WeightEntry[];
}

function formatXTick(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m]} '${year.slice(2)}`;
}

function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m]} ${parseInt(day, 10)}, ${year}`;
}

// Pick ~12 evenly spaced tick indices across the data
function getXTicks(data: WeightEntry[]): string[] {
  if (data.length === 0) return [];
  const count = Math.min(12, data.length);
  const step = (data.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    data[Math.round(i * step)].date
  );
}

interface TooltipPayload {
  payload?: { date: string; weight: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const { date, weight } = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3">
      <p className="text-sm text-slate-500">{formatFullDate(date)}</p>
      <p className="text-xl font-semibold text-blue-600">{weight.toFixed(2)} kg</p>
    </div>
  );
}

export default function WeightChart({ data }: Props) {
  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const latest = data[data.length - 1];
  const lowest = data.reduce((a, b) => a.weight < b.weight ? a : b);
  const highest = data.reduce((a, b) => a.weight > b.weight ? a : b);

  const yMin = Math.floor(minW - 1);
  const yMax = Math.ceil(maxW + 1);
  const xTicks = getXTicks(data);

  const stats = [
    { label: 'Lowest', value: `${lowest.weight.toFixed(2)} kg`, sub: formatFullDate(lowest.date) },
    { label: 'Highest', value: `${highest.weight.toFixed(2)} kg`, sub: formatFullDate(highest.date) },
    { label: 'Latest', value: `${latest.weight.toFixed(2)} kg`, sub: formatFullDate(latest.date) },
    { label: 'Total Readings', value: data.length.toString(), sub: `${data[0].date.slice(0, 4)} – ${latest.date.slice(0, 4)}` },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Body Composition</h1>
          <p className="text-slate-500 mt-1">Weekly weight tracker</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1 truncate">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Chart card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-600 mb-4">Weight over time (kg)</h2>
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                ticks={xTicks}
                tickFormatter={formatXTick}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={v => `${v}kg`}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#weightGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>
    </main>
  );
}
