"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ChevronDown, ChevronRight } from "lucide-react";

type AuditLog = {
  id: string;
  organizationId: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: any | null;
  createdAt: string;
};

type AuditLogsResponse = {
  auditLogs: AuditLog[];
  nextCursor?: string;
};

interface AuditLogTableProps {
  organizationId: string;
  initialData: AuditLogsResponse;
}

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(dateString));
};

export function AuditLogTable({ organizationId, initialData }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialData.auditLogs);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialData.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await apiClient(`/organizations/${organizationId}/audit-logs?cursor=${nextCursor}&limit=50`);
      if (res.error) throw new Error(res.error);
      
      const data = res as AuditLogsResponse;
      setLogs((prev) => {
        // Prevent duplicates
        const existingIds = new Set(prev.map(l => l.id));
        const newLogs = data.auditLogs.filter(l => !existingIds.has(l.id));
        return [...prev, ...newLogs];
      });
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to load more audit logs", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (id: string, hasMetadata: boolean) => {
    if (!hasMetadata) return;
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase w-10"></th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Timestamp</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Actor</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Action</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Resource</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Metadata Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                const isExpanded = expandedRows.has(log.id);
                
                let metadataPreview = "";
                if (hasMetadata) {
                  const stringified = JSON.stringify(log.metadata);
                  metadataPreview = stringified.length > 50 ? stringified.slice(0, 50) + "..." : stringified;
                }
                
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      className={`transition-colors ${hasMetadata ? "hover:bg-zinc-50 cursor-pointer" : ""}`}
                      onClick={() => toggleRow(log.id, hasMetadata)}
                    >
                      <td className="px-4 py-3 text-zinc-400">
                        {hasMetadata ? (
                          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-900 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {log.actorId ? (
                          <div className="font-mono text-xs truncate max-w-[120px]" title={log.actorId}>
                            {log.actorId.slice(0, 8)}...
                          </div>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded">System</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[10px] uppercase tracking-wider text-zinc-400">{log.resourceType}</span>
                          <span className="font-mono text-xs truncate max-w-[150px]" title={log.resourceId}>{log.resourceId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px] truncate max-w-[200px]">
                        {metadataPreview || <span className="text-zinc-300">-</span>}
                      </td>
                    </tr>
                    {isExpanded && hasMetadata && (
                      <tr className="bg-zinc-50/50">
                        <td colSpan={6} className="px-4 py-4 border-t border-zinc-100">
                          <div className="pl-10">
                            <div className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Metadata Payload</div>
                            <pre className="text-xs text-zinc-800 bg-white p-4 rounded-md border border-zinc-200 overflow-x-auto shadow-sm font-mono">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="p-4 border-t border-zinc-200 flex justify-center bg-zinc-50/50">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
          >
            {isLoading ? "Loading..." : "Load Older Logs"}
          </button>
        </div>
      )}
    </div>
  );
}
