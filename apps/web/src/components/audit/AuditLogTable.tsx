"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ChevronDown, ChevronRight, ActivitySquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-50 border-t border-zinc-200 border-dashed rounded-b-lg">
        <ActivitySquare className="w-12 h-12 text-zinc-300 mb-4" />
        <h3 className="text-lg font-medium text-zinc-900 mb-1">No activity yet</h3>
        <p className="text-sm text-zinc-500 max-w-sm">
          Audit logs will appear here when members join or actions are taken in your organization.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase w-10"></th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Timestamp</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Actor</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Action</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Resource</th>
              <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase">Metadata Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {logs.map((log) => {
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
                    className={`transition-colors ${hasMetadata ? "hover:bg-zinc-50 focus-within:bg-zinc-50/50" : ""}`}
                  >
                    <td className="px-4 py-3 text-zinc-400">
                      {hasMetadata ? (
                        <button
                          onClick={() => toggleRow(log.id, hasMetadata)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Collapse metadata" : "Expand metadata"}
                          className="p-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 hover:bg-zinc-200/50 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-900 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={log.actorId ? "bg-zinc-100 text-zinc-700 text-xs" : "bg-blue-50 text-blue-700 text-xs font-semibold"}>
                            {log.actorId ? log.actorId.slice(0, 2).toUpperCase() : "SY"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-900">
                            {log.actorId ? "User" : "System"}
                          </span>
                          {log.actorId && (
                            <span className="text-xs text-zinc-500 font-mono truncate max-w-[120px]" title={log.actorId}>
                              {log.actorId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-[11px] font-medium tracking-wide shadow-none">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="secondary" className="font-mono text-[10px] shadow-none">
                          {log.resourceType}
                        </Badge>
                        <span className="font-mono text-xs text-zinc-600 truncate max-w-[150px]" title={log.resourceId}>
                          {log.resourceId}
                        </span>
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
            })}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="p-4 border-t border-zinc-200 flex justify-center bg-zinc-50/50">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load Older Logs"}
          </Button>
        </div>
      )}
    </div>
  );
}
