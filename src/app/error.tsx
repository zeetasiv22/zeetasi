"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page empty-state">
      <h1>Terjadi gangguan sementara.</h1>
      <p>Data belum dapat dimuat. Silakan coba kembali.</p>
      <button className="button lime" onClick={reset}>
        Coba lagi
      </button>
    </div>
  );
}
