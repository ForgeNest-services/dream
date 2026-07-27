'use client';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = 'h-12 w-full', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${className} animate-pulse bg-linear-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded`}
        />
      ))}
    </>
  );
}
