import { z } from "zod";

// Strict E.164: leading `+`, then 8–15 digits, no other characters. We use
// this everywhere a phone enters the system so the database only ever holds
// canonical strings — anything looser would corrupt deduplication on
// (tenant_id, whatsapp_e164).
const E164 = /^\+[1-9]\d{7,14}$/;

export const e164Schema = z
  .string()
  .trim()
  .regex(E164, "Phone must be in E.164 format, e.g. +254712345678");

export function isE164(value: string): boolean {
  return E164.test(value.trim());
}
