export default function FormEditorLoading() {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col px-4 py-8" aria-busy="true" aria-label="Loading form editor">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted/70" />
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted/70" />
          </div>
          <div className="min-h-72 animate-pulse rounded-xl border bg-muted/30" />
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
            <div className="h-8 w-14 animate-pulse rounded-md bg-muted/70" />
            <div className="h-8 w-12 animate-pulse rounded-md bg-muted/60" />
          </div>
          <div className="h-28 animate-pulse rounded-lg bg-muted/40" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-48 animate-pulse rounded-md bg-muted/60" />
        </div>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-8 space-y-3">
        <div className="flex gap-2">
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted/70" />
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted/60" />
        </div>
        <div className="h-40 animate-pulse rounded-xl border bg-muted/20" />
      </div>
    </main>
  );
}
