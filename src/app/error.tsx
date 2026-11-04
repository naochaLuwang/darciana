'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="page-width empty-state">
      <h1>The shop couldn’t load.</h1>
      <button onClick={reset} className="button button-dark">
        Try again
      </button>
    </main>
  );
}
