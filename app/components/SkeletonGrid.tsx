import React from 'react';

export default function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="bg-zinc-900/40 rounded-xl overflow-hidden border border-zinc-800/80 animate-pulse flex flex-col"
        >
          <div className="aspect-[2/3] bg-zinc-800/60 w-full" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-zinc-800/80 rounded w-3/4" />
            <div className="h-2 bg-zinc-800/50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}