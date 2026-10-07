/** Editorial links verified through YouTube oEmbed on 2026-10-01.
 * These are provider-hosted uploads, not a claim of worldwide playback or complete catalog coverage.
 */
export type OfficialStream = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  catalogIds: string[];
  channel: string;
  channelHandle: string;
  subtitleNote: string;
  coverage: string;
  playlistId?: string;
  videos: { id: string; label: string }[];
};
export const officialStreams: OfficialStream[] = [
  {
    id: "wistoria",
    title: "Wistoria: Wand and Sword",
    category: "anime",
    categoryLabel: "Anime",
    catalogIds: ["anilist-174576"],
    channel: "Muse Indonesia",
    channelHandle: "MuseIndonesia",
    subtitleNote: "Takarir Indonesia menurut kanal Muse Indonesia.",
    coverage:
      "Playlist resmi; cakupan mengikuti video yang tersedia di playlist. Unggahan individual di bawah belum mencakup semua episode.",
    playlistId: "PLPanbgyToztZL03NxAn1aHQxDsnCu_-xl",
    videos: [
      { id: "6XwEyFvkDos", label: "Episode 01 · Takarir Indonesia" },
      { id: "SDoKL_8oRoc", label: "Episode 07 · Takarir Indonesia" },
      { id: "EFytT-m460w", label: "Episode 12 · Takarir Indonesia" },
      {
        id: "ESLhrQHEkBk",
        label: "Kompilasi “Semua Episode” dari Muse Indonesia",
      },
    ],
  },
  {
    id: "the-demon-hunter",
    title: "Pemburu Iblis — The Demon Hunter",
    category: "donghua",
    categoryLabel: "Donghua",
    catalogIds: ["anilist-155244"],
    channel: "YOUKU Indonesia",
    channelHandle: "youkuindonesia",
    subtitleNote: "INDO SUB menurut judul unggahan YOUKU.",
    coverage:
      "Kompilasi episode 01–66 dalam satu video; tidak dipisah menjadi 66 episode buatan.",
    videos: [
      { id: "UTDPfDRSZRM", label: "Kompilasi episode 01–66 · INDO SUB" },
    ],
  },
  {
    id: "legend-of-xianwu",
    title: "Legenda Xianwu",
    category: "donghua",
    categoryLabel: "Donghua",
    catalogIds: ["anilist-152889"],
    channel: "YOUKU Indonesia",
    channelHandle: "youkuindonesia",
    subtitleNote: "INDO SUB menurut judul unggahan YOUKU.",
    coverage: "Kompilasi episode 01–50 dalam satu video.",
    videos: [
      { id: "_EhT4-ojNPE", label: "Kompilasi episode 01–50 · INDO SUB" },
    ],
  },
  {
    id: "full-house",
    title: "Full House (2004)",
    category: "drama-korea",
    categoryLabel: "Drama Korea",
    catalogIds: ["tmdb-tv-3504"],
    channel: "KBS WORLD Indonesian",
    channelHandle: "KBSWORLDIndonesian",
    subtitleNote: "SUB INDO menurut judul unggahan KBS.",
    coverage: "Episode 01. Episode lain belum masuk pilihan ini.",
    videos: [{ id: "VOfbfQANz1Q", label: "Episode 01 · SUB INDO" }],
  },
  {
    id: "hidden-love",
    title: "Cinta Tersembunyi — Hidden Love",
    category: "drama-china",
    categoryLabel: "Drama China",
    catalogIds: ["tmdb-tv-210733"],
    channel: "YOUKU Indonesia",
    channelHandle: "youkuindonesia",
    subtitleNote: "INDO SUB menurut judul unggahan YOUKU.",
    coverage: "Episode 01. Episode lain belum masuk pilihan ini.",
    videos: [{ id: "ezCLS1TYdoY", label: "Episode 01 · INDO SUB" }],
  },
  {
    id: "mendadak-kaya",
    title: "Mendadak Kaya",
    category: "movies",
    categoryLabel: "Film",
    catalogIds: ["tmdb-movie-609619"],
    channel: "WeTV Dunia Drama",
    channelHandle: "WeTVDuniaDrama",
    subtitleNote: "Film berbahasa Indonesia; ketersediaan CC mengikuti player.",
    coverage: "Unggahan berlabel FULL MOVIE dari WeTV Dunia Drama.",
    videos: [{ id: "IpddBxlY498", label: "Film penuh · Bahasa Indonesia" }],
  },
];
export function streamForCatalog(id: string) {
  return officialStreams.find((source) => source.catalogIds.includes(id));
}
export function selectOfficialVideo(
  source: OfficialStream,
  requested?: string,
) {
  return (
    source.videos.find((video) => video.id === requested) || source.videos[0]
  );
}
export function youtubeErrorMessage(code: number) {
  if (code === 100)
    return "Video dihapus, privat, atau tidak ditemukan oleh YouTube.";
  if (code === 101 || code === 150)
    return "YouTube membatasi pemutaran ini. Penyebabnya dapat berupa wilayah, persyaratan akun, verifikasi bukan bot, atau pembatasan embed. Coba unggahan lain yang tersedia.";
  if (code === 153)
    return "YouTube tidak menerima identitas situs pemutar. Periksa pengaturan privasi browser atau coba kembali.";
  if (code === 5)
    return "Format video YouTube tidak didukung oleh browser ini.";
  return "Player YouTube belum dapat memutar video. Coba muat ulang.";
}
