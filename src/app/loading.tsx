export default function Loading() {
  return (
    <div className="page" role="status" aria-label="Memuat halaman">
      <p className="muted">Memuat cerita untukmu…</p>
      <div className="catalog-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </div>
  );
}
