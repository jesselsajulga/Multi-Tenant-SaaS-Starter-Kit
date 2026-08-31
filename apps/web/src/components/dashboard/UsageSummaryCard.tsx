import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface UsageData {
  apiCalls: number;
  aiTokens: number;
  storageMb: number;
}

interface UsageSummaryCardProps {
  organizationId: string;
  usageData: UsageData | null; // null if error occurred loading
  error: boolean;
}

export function UsageSummaryCard({ organizationId, usageData, error }: UsageSummaryCardProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-zinc-900">Usage — Last 30 Days</h3>
      </div>
      
      <div className="flex-1">
        {error ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm bg-zinc-50 rounded-md p-4 border border-dashed border-zinc-200">
            Unable to load usage data
          </div>
        ) : !usageData ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm bg-zinc-50 rounded-md p-4 border border-dashed border-zinc-200">
            No usage recorded
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-sm text-zinc-600">API Calls</span>
              <span className="text-sm font-medium text-zinc-900">{usageData.apiCalls.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-sm text-zinc-600">AI Tokens</span>
              <span className="text-sm font-medium text-zinc-900">{usageData.aiTokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Storage</span>
              <span className="text-sm font-medium text-zinc-900">{usageData.storageMb.toLocaleString()} MB</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-100">
        <Link 
          href={`/organizations/${organizationId}/billing/usage`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 w-max"
        >
          View usage <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
