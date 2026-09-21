/**
 * @route /supplier/* (loading state)
 * @description Skeleton shown while supplier portal server components fetch data.
 */
export default function SupplierLoading() {
  return (
    <div className="flex min-h-screen bg-surface animate-pulse">
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 border-r border-outline-variant bg-surface py-6 gap-3 px-4">
        <div className="h-6 w-24 bg-surface-container rounded mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-9 bg-surface-container/60 rounded" />
        ))}
      </aside>
      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        <header className="fixed top-0 right-0 h-16 border-b border-outline-variant bg-surface lg:w-[calc(100%-16rem)] w-full z-10 flex items-center px-8">
          <div className="h-6 w-40 bg-surface-container rounded" />
        </header>
        <main className="pt-24 pb-16 px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-surface-container rounded" />
            ))}
          </div>
          <div className="h-96 bg-surface-container rounded" />
        </main>
      </div>
    </div>
  );
}
