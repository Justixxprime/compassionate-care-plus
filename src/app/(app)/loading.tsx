// Drawn instantly while a screen inside the app is being prepared on the
// server, so a click always answers at once. Grey blocks, no spinner.

export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading</span>
      <div className="h-8 w-56 rounded-md bg-sage" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-md bg-sage/70" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-24 rounded-md bg-sage/70" />
        <div className="h-24 rounded-md bg-sage/70" />
        <div className="h-24 rounded-md bg-sage/70" />
        <div className="h-24 rounded-md bg-sage/70" />
      </div>
      <div className="mt-8 h-64 rounded-md bg-sage/50" />
    </div>
  );
}
