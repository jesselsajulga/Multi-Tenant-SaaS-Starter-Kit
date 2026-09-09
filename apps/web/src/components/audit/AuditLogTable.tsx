"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ChevronDown, ChevronRight, ActivitySquare, ListFilter } from "lucide-react";
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

function formatActionHuman(log: AuditLog): string {
  const actor = log.actorId ? "Member" : "System";
  switch (log.action) {
    case "PROJECT_CREATED":
      return `${actor} created project ${log.metadata?.name ? `"${log.metadata.name}"` : ""}`;
    case "PROJECT_UPDATED":
      return `${actor} updated project ${log.metadata?.name ? `"${log.metadata.name}"` : ""}`;
    case "PROJECT_DELETED":
      return `${actor} deleted project`;
    case "MEMBER_INVITED":
      return `${actor} invited ${log.metadata?.email || "new member"}`;
    case "MEMBER_JOINED":
      return `New member joined workspace`;
    case "MEMBER_REMOVED":
      return `${actor} removed a member from the workspace`;
    case "ORGANIZATION_UPDATED":
      return `${actor} updated organization settings`;
    case "BILLING_SUBSCRIPTION_UPDATED":
      return `Subscription plan updated`;
    default:
      return `${actor} performed ${log.action.toLowerCase().replace(/_/g, " ")}`;
  }
}

export function AuditLogTable({ organizationId, initialData }: AuditLogTableProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialData.auditLogs);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialData.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"timeline" | "raw">("timeline");

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    setIsLoading(true);
    try {
      const res = await apiClient(`/organizations/${organizationId}/audit-logs?cursor=${nextCursor}&limit=50`);
      if (res.error) throw new Error(res.error);
      
      const data = res as AuditLogsResponse;
      setLogs((prev) => {
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
      <div className="flex flex-col items-center justify-center p-12 text-center bg-zinc-50/50">
        <ActivitySquare className="w-8 h-8 text-zinc-300 mb-2" />
        <h3 className="text-xs font-semibold text-zinc-900 mb-0.5">No activity recorded yet</h3>
        <p className="text-xs text-zinc-500 max-w-sm">
          Audit logs will appear here when members join or actions are taken in your organization.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* View Toggle Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-100 text-xs">
        <span className="font-medium text-zinc-600">
          Showing {logs.length} recorded event{logs.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1 bg-zinc-200/60 p-0.5 rounded-md">
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
              viewMode === "timeline" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Activity Timeline
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
              viewMode === "raw" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Technical Ledger
          </button>
        </div>
      </div>

      {viewMode === "timeline" ? (
        /* Human Readable Activity View */
        <div className="divide-y divide-zinc-100">
          {logs.map((log) => {
            const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
            const isExpanded = expandedRows.has(log.id);
            return (
              <div key={log.id} className="p-4 hover:bg-zinc-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1.5 rounded-full bg-zinc-100 text-zinc-600 shrink-0">
                      <ActivitySquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-900 leading-snug">
                        {formatActionHuman(log)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 font-mono">
                        <span>{formatDate(log.createdAt)}</span>
                        <span>•</span>
                        <span>{log.resourceType}</span>
                        {log.resourceId && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{log.resourceId.slice(0, 8)}...</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {hasMetadata && (
                    <button
                      onClick={() => toggleRow(log.id, hasMetadata)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-0.5 shrink-0 pt-0.5"
                    >
                      <span>Payload</span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {isExpanded && hasMetadata && (
                  <div className="mt-3 pl-8">
                    <pre className="text-[11px] font-mono text-zinc-700 bg-zinc-50 p-3 rounded-md border border-zinc-200 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Technical Compliance Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Resource</th>
                <th className="px-4 py-2.5">Metadata Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {logs.map((log) => {
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                const isExpanded = expandedRows.has(log.id);
                
                let metadataPreview = "";
                if (hasMetadata) {
                  const stringified = JSON.stringify(log.metadata);
                  metadataPreview = stringified.length > 40 ? stringified.slice(0, 40) + "..." : stringified;
                }
                
                return (
                  <React.Fragment key={log.id}>
                    <tr className={`transition-colors ${hasMetadata ? "hover:bg-zinc-50" : ""}`}>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {hasMetadata ? (
                          <button
                            onClick={() => toggleRow(log.id, hasMetadata)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Collapse metadata" : "Expand metadata"}
                            className="p-0.5 rounded-sm hover:bg-zinc-200/50 transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-800 whitespace-nowrap font-mono text-[11px]">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-zinc-700">
                          {log.actorId ? `${log.actorId.slice(0, 8)}...` : "System"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="font-mono text-[10px] font-medium tracking-wide shadow-none">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-600">
                          <span>{log.resourceType}:</span>
                          <span className="text-zinc-500">{log.resourceId.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 font-mono text-[11px] truncate max-w-[180px]">
                        {metadataPreview || <span className="text-zinc-300">-</span>}
                      </td>
                    </tr>
                    {isExpanded && hasMetadata && (
                      <tr className="bg-zinc-50/50">
                        <td colSpan={6} className="px-4 py-3 border-t border-zinc-100">
                          <div className="pl-6">
                            <pre className="text-[11px] text-zinc-800 bg-white p-3 rounded-md border border-zinc-200 overflow-x-auto font-mono">
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
      )}

      {nextCursor && (
        <div className="p-3 border-t border-zinc-100 flex justify-center bg-zinc-50/50">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isLoading}
            className="text-xs h-7"
          >
            {isLoading ? "Loading..." : "Load Older Logs"}
          </Button>
        </div>
      )}
    </div>
  );
}
