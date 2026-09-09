import Link from "next/link";
import { ArrowRight, Activity, Cpu, HardDrive } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageData {
  apiCalls: number;
  aiTokens: number;
  storageMb: number;
}

interface UsageSummaryCardProps {
  organizationId: string;
  usageData: UsageData | null;
  error: boolean;
}

export function UsageSummaryCard({ organizationId, usageData, error }: UsageSummaryCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-500">Resource Consumption</CardTitle>
          <span className="text-xs text-zinc-400 font-mono">Last 30 days</span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pb-4">
        {error ? (
          <div className="flex items-center justify-center h-28 text-zinc-500 text-xs bg-zinc-50 rounded-md p-4 border border-dashed border-zinc-200">
            Unable to load usage data from billing service
          </div>
        ) : !usageData ? (
          <div className="flex items-center justify-center h-28 text-zinc-500 text-xs bg-zinc-50 rounded-md p-4 border border-dashed border-zinc-200">
            No consumption recorded in this period
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <span>API Calls</span>
              </div>
              <div className="text-xl font-semibold text-zinc-950 tracking-tight">
                {usageData.apiCalls.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                <span>AI Tokens</span>
              </div>
              <div className="text-xl font-semibold text-zinc-950 tracking-tight">
                {usageData.aiTokens.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-md bg-zinc-50 border border-zinc-100">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                <span>Storage</span>
              </div>
              <div className="text-xl font-semibold text-zinc-950 tracking-tight">
                {usageData.storageMb.toLocaleString()} <span className="text-xs font-normal text-zinc-500">MB</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t border-zinc-100">
        <Link 
          href={`/organizations/${organizationId}/billing/usage`}
          className="text-xs font-medium text-zinc-700 hover:text-zinc-950 flex items-center gap-1 transition-colors"
        >
          Detailed usage analytics <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
