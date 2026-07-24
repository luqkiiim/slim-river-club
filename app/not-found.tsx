import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-10">
      <section className="panel w-full p-6 text-center">
        <MagnifyingGlass aria-hidden className="mx-auto text-moss" size={38} weight="duotone" />
        <h1 className="mt-4 text-2xl font-semibold">That page isn’t here</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">The profile may have moved, or you may not have access to it.</p>
        <Link className="primary-button mt-5 w-full" href="/dashboard">
          <ArrowLeft aria-hidden size={20} weight="bold" />
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
