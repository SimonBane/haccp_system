import { getHealth } from "@/lib/api-client";

export default async function Home() {
  const health = await getHealth();

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          HACCP System
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Monorepo skeleton
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Next.js web app connected to the standalone Hono API.
        </p>

        <section className="mt-8 rounded-xl bg-zinc-50 p-6 dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            API health
          </h2>
          {health ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Status</dt>
                <dd className="font-medium text-emerald-600">{health.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Service</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {health.service}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Timestamp</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {health.timestamp}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-red-600">
              API unreachable. Start the monorepo with{" "}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-800">
                pnpm dev
              </code>
              .
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
