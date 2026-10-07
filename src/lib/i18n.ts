// Shared message keys for progressively extracting UI copy. Indonesian remains default.
export const supportedLocales = ["id", "en"] as const;
export type Locale = (typeof supportedLocales)[number];
export const messages = {
  id: {
    home: "Beranda",
    explore: "Jelajahi",
    community: "Komunitas",
    watchlist: "Daftar Saya",
    login: "Masuk",
    tagline: "Semua Hiburan, Satu Tempat.",
    retry: "Coba lagi",
  },
  en: {
    home: "Home",
    explore: "Explore",
    community: "Community",
    watchlist: "My List",
    login: "Sign in",
    tagline: "All Your Entertainment, One Place.",
    retry: "Try again",
  },
} satisfies Record<Locale, Record<string, string>>;
export function localeOrDefault(value: string | undefined): Locale {
  return value === "en" ? "en" : "id";
}
