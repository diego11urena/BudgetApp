import { z } from "zod";

/** A non-negative USD amount with up to 2 decimal places, e.g. "1234.56". */
export const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (e.g. 1234.56)");
