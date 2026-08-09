import { decimalString } from "./validations/shared";

export interface ParsedTransaction {
  type: "EXPENSE";
  amount: string;
  merchant: string;
}

export interface EmailParser {
  name: string;
  match(body: string): boolean;
  extract(body: string): ParsedTransaction | null;
}

/**
 * Real email bodies from Gmail (especially the plain-text rendering of an
 * HTML email) can wrap lines unpredictably and introduce extra whitespace —
 * collapsing to single spaces makes the pattern below robust to that
 * without needing to special-case line breaks.
 */
function normalizeWhitespace(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

// "La tarjeta VISA CONNECTMILES PLATINUM a nombre de DIEGO UREÑA, terminación
// 9162 pagó $36.85 en METRO BELLA VISTA 4730PANAMA PA." — a fixed,
// system-generated sentence; card name and cardholder name aren't captured
// since nothing downstream needs them. The merchant capture is non-greedy up
// to the first ". " (or end of string) after "en ", since the merchant
// string itself is never expected to contain a period. The amount group
// allows comma thousand-separators (e.g. "$1,234.56") since the bank does
// use them on larger purchases — stripped out below before validation,
// since decimalString (and the Decimal column it feeds) doesn't accept them.
// Group 1 = amount, group 2 = merchant.
const PURCHASE_PATTERN =
  /La tarjeta .+? a nombre de .+?, terminaci[oó]n \d+ pag[oó] \$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?) en (.+?)\.(?:\s|$)/;

export const purchaseNotificationParser: EmailParser = {
  name: "banco-general-purchase",
  match(body) {
    return PURCHASE_PATTERN.test(normalizeWhitespace(body));
  },
  extract(body) {
    const match = normalizeWhitespace(body).match(PURCHASE_PATTERN);
    const rawAmount = match?.[1];
    const merchant = match?.[2]?.trim();
    if (!rawAmount || !merchant) return null;

    const amount = rawAmount.replace(/,/g, "");

    // Defensive: a regex-captured amount should already satisfy this, but
    // never hand an unvalidated value to Decimal — skip the message instead.
    if (!decimalString.safeParse(amount).success) return null;

    return { type: "EXPENSE", amount, merchant };
  },
};

/**
 * Tried in order; the first parser whose match() returns true wins. Adding
 * support for another email template (a reversal, an ATM withdrawal, an
 * incoming transfer) later is just appending one more { match, extract }
 * entry here — nothing else in the Gmail sync pipeline needs to change.
 */
export const parsers: EmailParser[] = [purchaseNotificationParser];

export function parseTransactionEmail(body: string): ParsedTransaction | null {
  const parser = parsers.find((p) => p.match(body));
  return parser ? parser.extract(body) : null;
}
