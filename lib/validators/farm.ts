import { z } from "zod";

export const OWNERSHIP_TYPES = ["owned", "rented"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

// Empty string from <input type="number"> means "not provided" — keep it
// optional and coerce only when present.
const optionalCoord = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce
      .number()
      .gte(min, `${label} must be ≥ ${min}`)
      .lte(max, `${label} must be ≤ ${max}`)
      .optional(),
  );

const farmFields = {
  name: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().min(1, "Location is required").max(200),
  size_acres: z.coerce
    .number()
    .gt(0, "Size must be greater than 0")
    .lte(100000, "Size looks unrealistic"),
  ownership_type: z.enum(OWNERSHIP_TYPES),
  latitude: optionalCoord(-90, 90, "Latitude"),
  longitude: optionalCoord(-180, 180, "Longitude"),
};

const bothOrNeitherCoord = {
  message: "Provide both latitude and longitude, or neither",
  path: ["longitude"] as const,
  check: (v: { latitude?: number; longitude?: number }) =>
    (v.latitude === undefined && v.longitude === undefined) ||
    (v.latitude !== undefined && v.longitude !== undefined),
};

export const farmCreateSchema = z
  .object(farmFields)
  .refine(bothOrNeitherCoord.check, {
    path: [...bothOrNeitherCoord.path],
    message: bothOrNeitherCoord.message,
  });

export const farmUpdateSchema = z
  .object({ id: z.string().uuid(), ...farmFields })
  .refine(bothOrNeitherCoord.check, {
    path: [...bothOrNeitherCoord.path],
    message: bothOrNeitherCoord.message,
  });

export type FarmCreateInput = z.infer<typeof farmCreateSchema>;
export type FarmUpdateInput = z.infer<typeof farmUpdateSchema>;
