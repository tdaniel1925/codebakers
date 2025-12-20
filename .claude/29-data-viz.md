# Data Visualization Module
# Charts, Graphs, Dashboards, D3.js, Recharts, Nivo

---

## Library Recommendations

| Library | Best For | Bundle Size |
|---------|----------|-------------|
| **Recharts** | Simple charts, quick setup | ~200KB |
| **Nivo** | Beautiful defaults, responsive | ~300KB |
| **Chart.js** | Canvas-based, performant | ~60KB |
| **Victory** | React Native compatible | ~150KB |
| **D3.js** | Full control, complex viz | ~250KB |
| **Visx** | D3 + React, composable | Varies |

**Recommendation:** Use Recharts for most SaaS dashboards. Use D3/Visx for custom visualizations.

---

## Recharts Setup

```bash
npm install recharts
```

### Line Chart

```tsx
// components/charts/line-chart.tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  date: string;
  value: number;
  previousValue?: number;
}

interface LineChartProps {
  data: DataPoint[];
  showComparison?: boolean;
  height?: number;
  color?: string;
  comparisonColor?: string;
}

export function SimpleLineChart({
  data,
  showComparison = false,
  height = 300,
  color = 'hsl(var(--primary))',
  comparisonColor = 'hsl(var(--muted-foreground))',
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          className="text-xs text-muted-foreground"
          tickFormatter={(value) => formatDate(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          className="text-xs text-muted-foreground"
          tickFormatter={(value) => formatNumber(value)}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'hsl(var(--muted))' }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2 }}
          name="Current"
        />
        {showComparison && (
          <Line
            type="monotone"
            dataKey="previousValue"
            stroke={comparisonColor}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Previous"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-sm font-medium">{formatDate(label)}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}
```

### Bar Chart

```tsx
// components/charts/bar-chart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartProps {
  data: { name: string; value: number }[];
  height?: number;
  color?: string;
  horizontal?: boolean;
}

export function SimpleBarChart({
  data,
  height = 300,
  color = 'hsl(var(--primary))',
  horizontal = false,
}: BarChartProps) {
  const Chart = horizontal ? (
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
    >
      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
      <XAxis type="number" tickLine={false} axisLine={false} />
      <YAxis
        dataKey="name"
        type="category"
        tickLine={false}
        axisLine={false}
        width={70}
      />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
    </BarChart>
  ) : (
    <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" tickLine={false} axisLine={false} />
      <YAxis tickLine={false} axisLine={false} />
      <Tooltip content={<CustomTooltip />} />
      <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
    </BarChart>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {Chart}
    </ResponsiveContainer>
  );
}

// Stacked Bar Chart
export function StackedBarChart({
  data,
  keys,
  colors,
}: {
  data: any[];
  keys: string[];
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="stack"
            fill={colors[index]}
            radius={index === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Area Chart

```tsx
// components/charts/area-chart.tsx
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

interface AreaChartProps {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
  gradient?: boolean;
}

export function SimpleAreaChart({
  data,
  height = 300,
  color = 'hsl(var(--primary))',
  gradient = true,
}: AreaChartProps) {
  const gradientId = `gradient-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={gradient ? `url(#${gradientId})` : color}
          fillOpacity={gradient ? 1 : 0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Pie / Donut Chart

```tsx
// components/charts/pie-chart.tsx
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PieChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  donut?: boolean;
  showLabels?: boolean;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function SimplePieChart({
  data,
  height = 300,
  donut = false,
  showLabels = false,
}: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={donut ? '60%' : 0}
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          label={showLabels ? renderLabel : undefined}
          labelLine={showLabels}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const item = payload[0].payload;
            const percentage = ((item.value / total) * 100).toFixed(1);
            return (
              <div className="rounded-lg border bg-background p-2 shadow-lg">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.value.toLocaleString()} ({percentage}%)
                </p>
              </div>
            );
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function renderLabel({ name, percent }: any) {
  return `${name} (${(percent * 100).toFixed(0)}%)`;
}

// Donut with center text
export function DonutWithTotal({ data, label }: { data: any[]; label: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative">
      <SimplePieChart data={data} donut />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{total.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
```

---

## Dashboard Metrics Cards

```tsx
// components/dashboard/metric-card.tsx
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  chart?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  chart,
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {change !== undefined && (
          <span
            className={cn(
              'flex items-center text-sm font-medium',
              isPositive && 'text-green-600',
              isNegative && 'text-red-600',
              isNeutral && 'text-muted-foreground'
            )}
          >
            {isPositive && <ArrowUp className="h-4 w-4" />}
            {isNegative && <ArrowDown className="h-4 w-4" />}
            {isNeutral && <Minus className="h-4 w-4" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      {changeLabel && change !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">{changeLabel}</p>
      )}

      {chart && <div className="mt-4">{chart}</div>}
    </div>
  );
}

// Sparkline for metric cards
export function Sparkline({ data, color = 'hsl(var(--primary))' }: {
  data: number[];
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data.map((value, i) => ({ value, i }))}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Data Tables with Sorting

```tsx
// components/tables/data-table.tsx
'use client';

import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  searchKey?: keyof T;
  pageSize?: number;
}

export function DataTable<T>({
  data,
  columns,
  searchable = false,
  searchKey,
  pageSize = 10,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: { pageSize },
    },
  });

  return (
    <div className="space-y-4">
      {searchable && (
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm px-3 py-2 border rounded-lg"
        />
      )}

      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className="flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-2 border rounded disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-2 border rounded disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Heatmaps

```tsx
// components/charts/heatmap.tsx
'use client';

interface HeatmapProps {
  data: {
    x: string;
    y: string;
    value: number;
  }[];
  xLabels: string[];
  yLabels: string[];
  colorScale?: [string, string]; // [min color, max color]
}

export function Heatmap({
  data,
  xLabels,
  yLabels,
  colorScale = ['#f0f0f0', 'hsl(var(--primary))'],
}: HeatmapProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));

  const getColor = (value: number) => {
    const ratio = (value - minValue) / (maxValue - minValue);
    return interpolateColor(colorScale[0], colorScale[1], ratio);
  };

  const getValue = (x: string, y: string) => {
    return data.find((d) => d.x === x && d.y === y)?.value ?? 0;
  };

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="p-2" />
            {xLabels.map((label) => (
              <th key={label} className="p-2 text-xs font-medium text-center">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {yLabels.map((yLabel) => (
            <tr key={yLabel}>
              <td className="p-2 text-xs font-medium">{yLabel}</td>
              {xLabels.map((xLabel) => {
                const value = getValue(xLabel, yLabel);
                return (
                  <td
                    key={`${xLabel}-${yLabel}`}
                    className="p-1"
                    title={`${xLabel}, ${yLabel}: ${value}`}
                  >
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-xs"
                      style={{
                        backgroundColor: getColor(value),
                        color: value > (maxValue - minValue) / 2 ? 'white' : 'black',
                      }}
                    >
                      {value}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function interpolateColor(color1: string, color2: string, ratio: number): string {
  // Simple hex interpolation
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

// Activity calendar (GitHub style)
export function ActivityCalendar({ data }: {
  data: { date: string; count: number }[];
}) {
  // Generate last 365 days
  const weeks = generateCalendarWeeks(data);

  return (
    <div className="flex gap-1">
      {weeks.map((week, i) => (
        <div key={i} className="flex flex-col gap-1">
          {week.map((day, j) => (
            <div
              key={j}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: getActivityColor(day.count) }}
              title={`${day.date}: ${day.count} contributions`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## Geographic Maps

```tsx
// components/charts/map.tsx
'use client';

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';

interface MapProps {
  markers?: { coordinates: [number, number]; name: string; value?: number }[];
  highlightedRegions?: string[];
}

const geoUrl = 'https://unpkg.com/world-atlas@2/countries-110m.json';

export function WorldMap({ markers = [], highlightedRegions = [] }: MapProps) {
  return (
    <ComposableMap projectionConfig={{ scale: 150 }}>
      <Geographies geography={geoUrl}>
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={
                highlightedRegions.includes(geo.properties.name)
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--muted))'
              }
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              style={{
                hover: { fill: 'hsl(var(--primary))' },
              }}
            />
          ))
        }
      </Geographies>
      {markers.map((marker, i) => (
        <Marker key={i} coordinates={marker.coordinates}>
          <circle r={4} fill="hsl(var(--destructive))" />
          <text
            textAnchor="middle"
            y={-10}
            className="text-xs fill-current"
          >
            {marker.name}
          </text>
        </Marker>
      ))}
    </ComposableMap>
  );
}
```

---

## Real-time Charts

```tsx
// components/charts/realtime-chart.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface RealtimeChartProps {
  dataSource: () => Promise<number> | number;
  interval?: number; // ms
  maxPoints?: number;
}

export function RealtimeChart({
  dataSource,
  interval = 1000,
  maxPoints = 60,
}: RealtimeChartProps) {
  const [data, setData] = useState<{ time: number; value: number }[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const fetchData = async () => {
      const value = await dataSource();
      timeRef.current += 1;

      setData((prev) => {
        const newData = [...prev, { time: timeRef.current, value }];
        // Keep only last N points
        return newData.slice(-maxPoints);
      });
    };

    fetchData(); // Initial fetch
    const timer = setInterval(fetchData, interval);

    return () => clearInterval(timer);
  }, [dataSource, interval, maxPoints]);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <XAxis dataKey="time" hide />
        <YAxis domain={['auto', 'auto']} hide />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Usage with WebSocket
export function WebSocketChart({ url }: { url: string }) {
  const [data, setData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      const value = JSON.parse(event.data).value;
      setData((prev) => [...prev.slice(-59), { time: Date.now(), value }]);
    };

    return () => ws.close();
  }, [url]);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Chart Color Tokens

```css
/* globals.css */
:root {
  --chart-1: 220 70% 50%;  /* Blue */
  --chart-2: 160 60% 45%;  /* Teal */
  --chart-3: 30 80% 55%;   /* Orange */
  --chart-4: 280 65% 60%;  /* Purple */
  --chart-5: 340 75% 55%;  /* Pink */
}

.dark {
  --chart-1: 220 70% 60%;
  --chart-2: 160 60% 55%;
  --chart-3: 30 80% 65%;
  --chart-4: 280 65% 70%;
  --chart-5: 340 75% 65%;
}
```

---

## Performance Tips

```tsx
// 1. Memoize chart data
const chartData = useMemo(() => {
  return rawData.map(transformData);
}, [rawData]);

// 2. Use isAnimationActive={false} for real-time charts
<Line isAnimationActive={false} />

// 3. Limit data points for large datasets
const limitedData = data.slice(-100);

// 4. Use canvas for 10k+ points (Chart.js)
import { Chart } from 'chart.js';
// Chart.js uses canvas by default

// 5. Virtualize long data tables
import { useVirtualizer } from '@tanstack/react-virtual';
```

---

## Quality Checklist

Before shipping:
- [ ] Charts are responsive (use ResponsiveContainer)
- [ ] Colors work in light and dark mode
- [ ] Tooltips show formatted values
- [ ] Loading states for async data
- [ ] Empty states when no data
- [ ] Axis labels are readable
- [ ] Large numbers are formatted (1K, 1M)
- [ ] Dates are formatted correctly
- [ ] Charts are accessible (aria-labels)
- [ ] Performance tested with large datasets
