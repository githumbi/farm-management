import { z } from "zod";

import { e164Schema } from "@/lib/validators/phone";

export const managerAssignSchema = z.object({
  farm_id: z.string().uuid(),
  display_name: z.string().trim().min(1, "Name is required").max(80),
  whatsapp_e164: e164Schema,
});

export type ManagerAssignInput = z.infer<typeof managerAssignSchema>;
