import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZetaHub",
    short_name: "ZetaHub",
    description: "Semua Hiburan, Satu Tempat.",
    id: "/",
    scope: "/",
    start_url: "/",
    shortcuts: [{ name: "Cari judul", url: "/search" }, { name: "Siap ditonton", url: "/watch-now" }],
    display: "standalone",
    background_color: "#050807",
    theme_color: "#050807",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
