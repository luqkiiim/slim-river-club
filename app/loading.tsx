import { CircleNotch } from "@phosphor-icons/react/dist/ssr";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-5" role="status">
      <div className="text-center">
        <CircleNotch aria-hidden className="mx-auto animate-spin text-moss motion-reduce:animate-none" size={34} weight="bold" />
        <p className="mt-4 font-semibold text-ink">Loading your club…</p>
        <p className="mt-1 text-sm text-ink/70">Refreshing progress and monthly results.</p>
      </div>
    </main>
  );
}
