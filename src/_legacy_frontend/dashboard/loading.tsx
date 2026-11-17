/**
 * @route /dashboard/* (loading state)
 * @description Skeleton shown while dashboard server components fetch data.
 *   Mirrors the portal chrome (sidebar + header + content area) with animated
 *   placeholder blocks so the layout doesn't shift on load.
 */
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen bg-surface animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 border-r border-outline-variant bg-surface py-6 gap-3 px-4">
        <div className="h-6 w-24 bg-surface-container rounded mb-4" />
        <div className="h-10 bg-surface-container rounded mb-2" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 bg-surface-container/60 rounded" />
        ))}
      </aside>

      {/* Main area */}
      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        <header className="fixed top-0 right-0 h-16 border-b border-outline-variant bg-surface lg:w-[calc(100%-16rem)] w-full z-10 flex items-center px-8 gap-4">
          <div className="ml-auto h-8 w-32 bg-surface-container rounded" />
        </header>
        <main className="pt-24 pb-16 px-8">
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-surface-container rounded" />
            ))}
          </div>
          {/* Content */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-7 h-80 bg-surface-container rounded" />
            <div className="col-span-5 h-80 bg-surface-container rounded" />
            <div className="col-span-12 h-56 bg-surface-container rounded" />
          </div>
        </main>
      </div>
    </div>
  );
}
