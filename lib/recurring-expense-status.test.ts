import { describe, expect, it } from "vitest";
import { getOngoingRecurringExpenseStatus, getRecurringExpensePaymentStatus } from "./recurring-expense-status";

describe("getRecurringExpensePaymentStatus", () => {
  it("is not-started when nothing has been paid yet", () => {
    expect(getRecurringExpensePaymentStatus(0, 9.99)).toBe("not-started");
  });

  it("is partial when some but not all of the target has been paid", () => {
    expect(getRecurringExpensePaymentStatus(5, 9.99)).toBe("partial");
  });

  it("is paid once the actual amount meets the target", () => {
    expect(getRecurringExpensePaymentStatus(9.99, 9.99)).toBe("paid");
  });

  it("is paid-over (not a plain calm 'paid') for a mild overage within the same warning band the category bar uses", () => {
    expect(getRecurringExpensePaymentStatus(11, 9.99)).toBe("paid-over");
  });

  it("is exceeded only once spend passes the shared 120% critical threshold", () => {
    expect(getRecurringExpensePaymentStatus(13, 9.99)).toBe("exceeded");
  });
});

describe("getOngoingRecurringExpenseStatus", () => {
  it("is not-logged when nothing has been paid yet", () => {
    expect(getOngoingRecurringExpenseStatus(0)).toBe("not-logged");
  });

  it("is logged once anything at all has been paid, regardless of how it compares to the typical amount", () => {
    // Deliberately far from any "typical" amount -- there's no target to
    // compare against for an Ongoing item, so any positive actual counts.
    expect(getOngoingRecurringExpenseStatus(0.01)).toBe("logged");
    expect(getOngoingRecurringExpenseStatus(500)).toBe("logged");
  });
});
