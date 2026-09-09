"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, HardDrive, Cpu, FileBox, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UsageTotal {
  metric: string;
  quantity: number;
}

interface UsageHistoryItem {
  date: string;
  metric: string;
  quantity: number;
}

interface UsageReport {
  period: { start: string; end: string };
  totals: UsageTotal[];
  history: UsageHistoryItem[];
}

const METRIC_CONFIG: Record<string, { label: string; icon: any; color: string; unit?: string }> = {
  API_CALLS: { label: "API Calls", icon: Activity, color: "#18181b", unit: "reqs" },
  AI_TOKENS: { label: "AI Tokens", icon: Cpu, color: "#52525b", unit: "tokens" },
  STORAGE_MB: { label: "Storage", icon: HardDrive, color: "#71717a", unit: "MB" },
};

export function UsageDashboardClient({
  organizationId,
  initialData,
}: {
  organizationId: string;
  initialData: UsageReport;
}) {
  const [selectedMetric, setSelectedMetric] = useState<string>("ALL");

  const { totals, history, period } = initialData;
  const hasUsage = totals.length > 0;

  // Process history for chart
  const dates = Array.from(new Set(history.map((h) => h.date))).sort();
  const chartData = dates.map((date) => {
    const dataPoint: any = { date };
    history
      .filter((h) => h.date === date)
      .forEach((h) => {
        dataPoint[h.metric] = h.quantity;
      });
    return dataPoint;
  });

  // Daily breakdown rows (flattened and sorted desc by date)
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (selectedMetric === "ALL") return sortedHistory;
    return sortedHistory.filter((item) => item.metric === selectedMetric);
  }, [sortedHistory, selectedMetric]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header with breadcrumbs */}
      <PageHeader
        breadcrumbs={[
          { label: "Workspace", href: `/organizations/${organizationId}/dashboard` },
          { label: "Billing", href: `/organizations/${organizationId}/billing` },
          { label: "Usage" }
        ]}
        title="Usage"
        description="Monitor verified workspace resource consumption directly from the billing engine."
      />

      {!hasUsage ? (
        <Card className="border-dashed bg-zinc-50/50">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-10 h-10 rounded-md bg-zinc-100 flex items-center justify-center mb-3 text-zinc-400">
              <FileBox className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 mb-1">No usage recorded</h2>
            <p className="text-xs text-zinc-500 max-w-sm">
              There isn't any verified resource consumption recorded for this period yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {totals.map((total) => {
              const config = METRIC_CONFIG[total.metric] || { label: total.metric, icon: Activity, color: "#18181b", unit: "" };
              const Icon = config.icon;
              return (
                <Card key={total.metric} className="p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
                    <span className="font-medium">{config.label}</span>
                    <div className="p-1.5 rounded-md bg-zinc-100 text-zinc-600">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold text-zinc-950 tracking-tight">
                      {total.quantity.toLocaleString()}{" "}
                      {config.unit && <span className="text-xs font-normal text-zinc-500">{config.unit}</span>}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 font-mono">Period total</div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Chart Section */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-100">
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-900">Usage Over Time</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">Daily recorded consumption</p>
              </div>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="All Metrics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Metrics</SelectItem>
                  {totals.map((t) => {
                    const label = METRIC_CONFIG[t.metric]?.label || t.metric;
                    return <SelectItem key={t.metric} value={t.metric}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={(val) => {
                        const d = new Date(val as string);
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                      }}
                      dy={8}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    />
                    <Tooltip 
                      cursor={{ fill: "#f4f4f5" }}
                      contentStyle={{ borderRadius: "6px", border: "1px solid #e4e4e7", fontSize: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}
                      labelFormatter={(label) => {
                        const d = new Date(label as string);
                        return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
                      }}
                    />
                    
                    {selectedMetric === "ALL" ? (
                      totals.map((t) => (
                        <Bar 
                          key={t.metric} 
                          dataKey={t.metric} 
                          name={METRIC_CONFIG[t.metric]?.label || t.metric}
                          fill={METRIC_CONFIG[t.metric]?.color || "#71717a"} 
                          radius={[3, 3, 0, 0]}
                          maxBarSize={32}
                        />
                      ))
                    ) : (
                      <Bar 
                        dataKey={selectedMetric} 
                        name={METRIC_CONFIG[selectedMetric]?.label || selectedMetric}
                        fill={METRIC_CONFIG[selectedMetric]?.color || "#18181b"} 
                        radius={[3, 3, 0, 0]}
                        maxBarSize={48}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown Table */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-zinc-100">
              <CardTitle className="text-sm font-semibold text-zinc-900">Daily Breakdown</CardTitle>
              <p className="text-xs text-zinc-500 mt-0.5">Chronological log of daily recorded metric quantities</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="px-5 py-2.5">Date</th>
                      <th className="px-5 py-2.5">Metric</th>
                      <th className="px-5 py-2.5 text-right">Recorded Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {filteredHistory.map((item, idx) => (
                      <tr key={`${item.date}-${item.metric}-${idx}`} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="px-5 py-2.5 font-mono text-zinc-700">
                          {new Date(item.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC"
                          })}
                        </td>
                        <td className="px-5 py-2.5 font-medium text-zinc-900">
                          {METRIC_CONFIG[item.metric]?.label || item.metric}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono font-medium text-zinc-900">
                          {item.quantity.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 py-6 text-center text-xs text-zinc-400">
                          No daily entries found for this metric
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
