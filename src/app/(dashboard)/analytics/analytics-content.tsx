'use client';

import { BarChart3, Clock, FileCode, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface PatternUsageStats {
  totalFetches: number;
  uniquePatterns: number;
  topPatterns: { name: string; count: number }[];
  usageByDay: { date: string; count: number }[];
}

interface AnalyticsContentProps {
  stats: PatternUsageStats;
  timeSaved: { hours: number; minutes: number };
}

export function AnalyticsContent({ stats, timeSaved }: AnalyticsContentProps) {
  // Format usage by day for chart - show last 14 days
  const chartData = stats.usageByDay.slice(-14).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: d.count,
  }));

  // Format pattern names nicely
  const formatPatternName = (name: string) => {
    return name
      .replace(/^\d+-/, '') // Remove leading numbers like "00-"
      .replace(/-/g, ' ') // Replace dashes with spaces
      .replace(/\.md$/, '') // Remove .md extension
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Usage Analytics</h1>
        <p className="text-neutral-400">
          Track your pattern usage and see the impact on your development
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 flex items-center justify-center">
                <FileCode className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stats.totalFetches}</p>
                <p className="text-sm text-neutral-400">Pattern Fetches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stats.uniquePatterns}</p>
                <p className="text-sm text-neutral-400">Unique Patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">
                  {timeSaved.hours > 0 ? `${timeSaved.hours}h` : `${timeSaved.minutes}m`}
                </p>
                <p className="text-sm text-neutral-400">Time Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">
                  {chartData.length > 1
                    ? Math.round(
                        ((chartData[chartData.length - 1]?.count || 0) /
                          Math.max(chartData[0]?.count || 1, 1)) *
                          100 -
                          100
                      )
                    : 0}
                  %
                </p>
                <p className="text-sm text-neutral-400">Trend</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Usage Over Time</CardTitle>
          <CardDescription className="text-neutral-400">
            Pattern fetches over the last 14 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    stroke="#525252"
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    axisLine={{ stroke: '#404040' }}
                  />
                  <YAxis
                    stroke="#525252"
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    axisLine={{ stroke: '#404040' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid #404040',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#ef4444' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#ef4444' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-neutral-400">No usage data yet. Start using patterns to see your analytics!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Patterns */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white">Top Patterns</CardTitle>
          <CardDescription className="text-neutral-400">
            Your most used patterns this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.topPatterns.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.topPatterns.slice(0, 8).map((p) => ({
                    name: formatPatternName(p.name),
                    count: p.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 100 }}
                >
                  <XAxis
                    type="number"
                    stroke="#525252"
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    axisLine={{ stroke: '#404040' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#525252"
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    axisLine={{ stroke: '#404040' }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid #404040',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fff' }}
                    itemStyle={{ color: '#ef4444' }}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-neutral-400">No patterns used yet. Start building to see your top patterns!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">How we calculate time saved</h3>
              <p className="text-sm text-neutral-400">
                Each pattern fetch is estimated to save approximately 15 minutes of development time.
                This includes time saved from not having to research best practices, write boilerplate code,
                and debug common issues. Actual savings may vary based on your experience and project complexity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
