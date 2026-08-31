export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 bg-zinc-200 rounded w-48 mb-2"></div>
        <div className="h-4 bg-zinc-200 rounded w-64"></div>
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-lg border border-zinc-200 bg-white shadow-sm flex flex-col">
            <div className="h-4 bg-zinc-200 rounded w-24 mb-4"></div>
            <div className="h-8 bg-zinc-200 rounded w-32 mb-2"></div>
            <div className="h-3 bg-zinc-100 rounded w-16"></div>
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="p-6 rounded-lg border border-zinc-200 bg-white shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-200 rounded w-32"></div>
          <div className="h-8 bg-zinc-200 rounded w-28"></div>
        </div>
        <div className="h-[300px] w-full flex items-end gap-2 px-4 pb-4">
          {[...Array(12)].map((_, i) => (
            <div 
              key={i} 
              className="w-full bg-zinc-100 rounded-t-md" 
              style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}
