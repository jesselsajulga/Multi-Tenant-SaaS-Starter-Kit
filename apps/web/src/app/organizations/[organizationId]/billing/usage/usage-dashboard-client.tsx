"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, HardDrive, Cpu, FileBox } from "lucide-react";
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

const METRIC_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  API_CALLS: { label: "API Calls", icon: Activity, color: "#3b82f6" },
  STORAGE_MB: { label: "Storage (MB)", icon: HardDrive, color: "#10b981" },
  AI_TOKENS: { label: "AI Tokens", icon: Cpu, color: "#8b5cf6" },
};

export function UsageDashboardClient({
  organizationId,
  initialData,
}: {
  organizationId: string;
  initialData: UsageReport;
}) {
  const [selectedMetric, setSelectedMetric] = useState<string>("ALL");

  const { totals, history } = initialData;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Usage & Billing"
        description="Monitor your organization's resource consumption."
      />

      {!hasUsage ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-16 text-center">
            <FileBox className="w-12 h-12 text-zinc-300 mb-4" />
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">No usage recorded</h2>
            <p className="text-zinc-500 max-w-sm">
              There isn't any usage for this period yet. Try selecting a different date range or start using the platform.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {totals.map((total) => {
              const config = METRIC_CONFIG[total.metric] || { label: total.metric, icon: Activity, color: "#6b7280" };
              const Icon = config.icon;
              return (
                <Card key={total.metric}>
                  <CardContent className="p-5 flex flex-col">
                    <div className="flex items-center gap-2 text-zinc-500 font-medium text-sm mb-4">
                      <Icon className="w-4 h-4" />
                      <span>{config.label}</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">
                      {total.quantity.toLocaleString()}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">Total usage</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Chart Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
              <CardTitle className="text-lg">Usage over time</CardTitle>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-[180px]">
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
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: "#71717a" }}
                      tickFormatter={(val) => {
                        // Basic formatting without date-fns: "Aug 15"
                        const d = new Date(val as string);
                        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                      }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: "#71717a" }}
                      tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    />
                    <Tooltip 
                      cursor={{ fill: "#f4f4f5" }}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e4e4e7", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      labelFormatter={(label) => {
                        const d = new Date(label as string);
                        return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
                      }}
                    />
                    
                    {selectedMetric === "ALL" ? (
                      totals.map((t) => (
                        <Bar 
                          key={t.metric} 
                          dataKey={t.metric} 
                          name={METRIC_CONFIG[t.metric]?.label || t.metric}
                          fill={METRIC_CONFIG[t.metric]?.color || "#6b7280"} 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      ))
                    ) : (
                      <Bar 
                        dataKey={selectedMetric} 
                        name={METRIC_CONFIG[selectedMetric]?.label || selectedMetric}
                        fill={METRIC_CONFIG[selectedMetric]?.color || "#6b7280"} 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
