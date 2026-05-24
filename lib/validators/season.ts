import { z } from "zod";

export const SEASON_STATUSES = ["planned", "active", "closed"] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const seasonCreateSchema = z
  .object({
    farm_id: z.string().uuid(),
    name: z.string().trim().min(1, "Name is required").max(120),
    crop_type: z.string().trim().min(1, "Crop type is required").max(80),
    start_date: isoDate,
    end_date: isoDate,
    status: z.enum(SEASON_STATUSES).default("planned"),
  })
  .refine((v) => new Date(v.end_date) >= new Date(v.start_date), {
    path: ["end_date"],
    message: "End date must be on or after start date",
  });

export type SeasonCreateInput = z.infer<typeof seasonCreateSchema>;
