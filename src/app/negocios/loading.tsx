import { Skeleton } from "@/components/ui/skeleton";

export default function NegociosLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Negócios</h1>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-72 shrink-0 flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
