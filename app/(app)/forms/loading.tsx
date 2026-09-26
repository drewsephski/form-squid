export default function FormsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8" aria-busy="true" aria-label="Loading forms">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-56 animate-pulse rounded-md bg-muted/70" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-4 rounded-xl border p-4">
            <div className="hidden h-28 w-40 shrink-0 animate-pulse rounded-xl bg-muted/50 sm:block" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 max-w-48 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded-md bg-muted/70" />
              <div className="h-3 w-2/3 max-w-64 animate-pulse rounded-md bg-muted/60" />
              <div className="h-3 w-40 animate-pulse rounded-md bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
