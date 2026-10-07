import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page empty-state">
      <span className="eyebrow">404 · DI LUAR ORBIT</span>
      <h1>Halaman tidak ditemukan.</h1>
      <Link href="/" className="button lime">
        Kembali ke beranda
      </Link>
    </div>
  );
}
