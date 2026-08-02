import { z } from "zod";
import { decimalString } from "./shared";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(100),
  lifetimeTargetAmount: decimalString,
  recurringAmount: decimalString.optional(),
});
