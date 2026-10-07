import { z } from "zod";
export const homeSectionSchema = z.object({
  id: z.enum([
    "trending",
    "popular",
    "genres",
    "continue",
    "donghua",
    "community",
  ]),
  title: z.string().min(1).max(70),
  visible: z.boolean(),
});
export const homeSchema = z.object({
  sections: z
    .array(homeSectionSchema)
    .max(6)
    .refine((a) => new Set(a.map((s) => s.id)).size === a.length),
});
export const settingSchemas: Record<string, z.ZodType> = {
  home: homeSchema,
  ads: z.object({ frequency: z.number().int().min(0).max(100) }),
  gamification: z.object({ completion_xp: z.number().int().min(0).max(100) }),
};
