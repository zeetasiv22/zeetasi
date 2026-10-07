/** Full film, including credits. Source and license checked against Blender's Peach project. */
export const openFilm = {
  id: "big-buck-bunny",
  episodeId: "00000000-0000-4000-8000-000000000003",
  title: "Big Buck Bunny",
  description:
    "Film pendek animasi Blender Foundation (2008). Seekor kelinci menghadapi tiga penghuni hutan yang jahil. Edisi Sunflower, film penuh termasuk kredit penutup; bukan episode anime atau donghua.",
  sources: [480, 360].map((height) => ({
    id: `bbb-${height}`,
    url: `https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.${height}p.vp9.webm`,
    height,
  })),
  duration: 634,
  license: "Creative Commons Attribution 3.0",
  attribution: "© Blender Foundation | www.blender.org",
  licenseUrl: "https://peach.blender.org/about/",
};
