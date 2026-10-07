import { z } from "zod";
export const adminSections: Record<
  string,
  { table: string; label: string; permission: string }
> = {
  users: { table: "profiles", label: "Pengguna", permission: "operations" },
  roles: { table: "user_roles", label: "Peran & izin", permission: "roles" },
  premium: {
    table: "subscriptions",
    label: "Premium",
    permission: "entitlements",
  },
  catalog: { table: "catalog_titles", label: "Katalog", permission: "catalog" },
  episodes: { table: "episodes", label: "Episode", permission: "catalog" },
  genres: { table: "genres", label: "Genre", permission: "operations" },
  playback: {
    table: "playback_sources",
    label: "Sumber pemutaran",
    permission: "catalog",
  },
  "playback-sources": {
    table: "playback_sources",
    label: "Sumber pemutaran",
    permission: "catalog",
  },
  subtitles: {
    table: "episode_subtitles",
    label: "Subtitle episode",
    permission: "catalog",
  },
  comments: { table: "comments", label: "Komentar", permission: "moderate" },
  reports: { table: "reports", label: "Laporan", permission: "moderate" },
  badges: {
    table: "badge_definitions",
    label: "Badge",
    permission: "operations",
  },
  "avatar-items": {
    table: "avatar_items",
    label: "Item avatar",
    permission: "operations",
  },
  titles: {
    table: "title_definitions",
    label: "Gelar komunitas",
    permission: "operations",
  },
  levels: {
    table: "application_settings",
    label: "XP & level",
    permission: "operations",
  },
  leaderboard: {
    table: "xp_transactions",
    label: "Riwayat XP",
    permission: "operations",
  },
  subscriptions: {
    table: "subscriptions",
    label: "Langganan",
    permission: "operations",
  },
  payments: {
    table: "payment_events",
    label: "Pembayaran",
    permission: "operations",
  },
  ads: {
    table: "ad_campaigns",
    label: "Kampanye iklan",
    permission: "operations",
  },
  notifications: {
    table: "notifications",
    label: "Notifikasi",
    permission: "operations",
  },
  analytics: {
    table: "episode_completions",
    label: "Episode selesai",
    permission: "operations",
  },
  "audit-logs": {
    table: "admin_audit_logs",
    label: "Audit log",
    permission: "operations",
  },
  settings: {
    table: "application_settings",
    label: "Pengaturan",
    permission: "operations",
  },
  integrations: {
    table: "integration_status",
    label: "Integrasi",
    permission: "operations",
  },
  announcements: {
    table: "announcements",
    label: "Pengumuman",
    permission: "operations",
  },
};
const image = z
  .string()
  .refine(
    (x) => /^https:\/\//.test(x) || /^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(x),
    "URL gambar tidak valid",
  );
export const adminSchemas: Record<string, z.ZodType> = {
  catalog: z.object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(100),
    title: z.string().min(1).max(200),
    description: z.string().max(5000),
    poster: image,
    banner: image,
    year: z.number().int().min(1900).max(2200).nullable(),
    genres: z.array(z.string().max(40)).max(20),
    country: z.string().max(2),
    published: z.boolean(),
    license: z.string().min(5).max(1000),
  }),
  episodes: z.object({
    id: z.uuid(),
    title_id: z.string().max(100),
    number: z.number().int().positive(),
    title: z.string().min(1).max(200),
    duration: z.number().int().min(10).max(86400),
    published: z.boolean(),
  }),
  playback: z.object({
    id: z.uuid(),
    episode_id: z.uuid(),
    url: z.url().startsWith("https://"),
    license: z.string().min(5).max(1000),
    type: z.enum(["video/mp4", "video/webm"]),
    height: z.number().int().min(144).max(4320).nullable().default(null),
    premium_only: z.boolean(),
    enabled: z.boolean(),
  }),
  subtitles: z.object({
    id: z.uuid(),
    episode_id: z.uuid(),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
      .max(35),
    label: z.string().trim().min(1).max(60),
    url: z
      .string()
      .max(2000)
      .refine(
        (value) =>
          /^\/media\/[a-zA-Z0-9/_-]+\.vtt$/.test(value) ||
          (URL.canParse(value) && new URL(value).protocol === "https:"),
      ),
    license: z.string().trim().min(5).max(1000),
    enabled: z.boolean(),
  }),
  badges: z.object({
    id: z.string().max(50),
    label: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    icon: z.enum(["check", "shield", "crown", "star"]),
  }),
  "avatar-items": z.object({
    id: z.string().max(50),
    name: z.string().min(1).max(50),
    kind: z.enum(["frame", "avatar"]),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    required_xp: z.number().int().nonnegative(),
    premium: z.boolean(),
  }),
  titles: z.object({
    id: z.string().max(50),
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    required_xp: z.number().int().nonnegative(),
  }),
  announcements: z.object({
    id: z.uuid(),
    title: z.string().min(1).max(150),
    body: z.string().min(1).max(5000),
    published: z.boolean(),
  }),
  ads: z
    .object({
      id: z.uuid(),
      name: z.string().min(1).max(150),
      image_url: image,
      destination: z.url().startsWith("https://"),
      starts_at: z.iso.datetime(),
      ends_at: z.iso.datetime(),
      enabled: z.boolean(),
    })
    .refine((v) => v.ends_at > v.starts_at),
};
