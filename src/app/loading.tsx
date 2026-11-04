export default function Loading() {
  return (
    <main id="main" className="page-width section-space" role="status">
      <p>Loading…</p>
      <div className="loading-grid">
        {[0, 1, 2, 3].map((item) => (
          <div className="loading-card" key={item} />
        ))}
      </div>
    </main>
  );
}
