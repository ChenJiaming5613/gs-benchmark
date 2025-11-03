import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-24 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">GS Benchmark</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Evaluate training outputs across experiments in one place.
        </h1>
        <p className="mt-6 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Import local model paths, review metrics, and visually compare renders between iterations.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/eval"
            className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-300"
          >
            Go to Evaluation
          </Link>
          <a
            href="https://superspl.at/editor"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 px-6 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Go to SuperSplat
          </a>
        </div>
      </div>
    </main>
  );
}
