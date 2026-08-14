import { decimalString } from "./validations/shared";

export type ParsedPaymentMethod = "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY";

export interface ParsedTransaction {
  type: "EXPENSE" | "INCOME";
  amount: string;
  /** Merchant name for a card purchase, or the counterparty's name for a Yappy transfer. */
  merchant: string;
  /** Never actually null today -- every parser here always knows the rail (a card purchase defaults to Credit, a Yappy match of either direction is always Yappy) -- kept nullable for a future template that genuinely can't tell. */
  paymentMethod: ParsedPaymentMethod | null;
  /** Yappy's optional free-text "Mensaje" field -- present (non-null) only when the sender actually filled one in. Always null for a bank card purchase, which has no such field. */
  description: string | null;
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

/**
 * The purchase sentence itself never says which kind of card — best-effort:
 * if "débito"/"debito" appears anywhere in the email (some of the bank's
 * templates mention it near the card name), it's a debit purchase;
 * otherwise it defaults to credit, since that's this bank's more common
 * card product and the sample formats seen so far never say either way.
 */
const DEBIT_KEYWORD = /d[eé]bito/i;

export const purchaseNotificationParser: EmailParser = {
  name: "banco-general-purchase",
  match(body) {
    return PURCHASE_PATTERN.test(normalizeWhitespace(body));
  },
  extract(body) {
    const normalized = normalizeWhitespace(body);
    const match = normalized.match(PURCHASE_PATTERN);
    const rawAmount = match?.[1];
    const merchant = match?.[2]?.trim();
    if (!rawAmount || !merchant) return null;

    const amount = rawAmount.replace(/,/g, "");

    // Defensive: a regex-captured amount should already satisfy this, but
    // never hand an unvalidated value to Decimal — skip the message instead.
    if (!decimalString.safeParse(amount).success) return null;

    const paymentMethod: ParsedPaymentMethod = DEBIT_KEYWORD.test(normalized)
      ? "DEBIT_CARD"
      : "CREDIT_CARD";

    return { type: "EXPENSE", amount, merchant, paymentMethod, description: null };
  },
};

/**
 * Yappy's rendered notification text has no real whitespace between
 * adjacent fields once tags/layout are stripped away (e.g.
 * "Enviado porIsabella E.****-4820Fecha"), so the counterparty name is
 * captured non-greedily up to the literal "Fecha" that always follows it,
 * then cleaned of the trailing masked-account noise ("****-4820") or raw
 * phone digits ("69264820") that get swept up in that capture.
 */
function cleanYappyName(raw: string): string {
  return raw.trim().replace(/[\s*\-\d]+$/, "").trim();
}

// Yappy renders an optional free-text note the sender can attach, labeled
// "Mensaje", between the date and the confirmation code -- e.g.
// "...Fecha 11 ago 2026 03:25 p. m. Mensaje Devolucion Confirmación
// FCXDZ-79530470...". The label is always present even when the sender
// left it blank ("Mensaje Confirmación" with nothing between), which is
// exactly the case that needs surfacing to the user -- a P2P transfer's
// only other context is the counterparty's name, which doesn't say what
// the money was actually for.
const YAPPY_MESSAGE_PATTERN = /Mensaje\s*(.*?)\s*Confirmaci[oó]n/;

function extractYappyMessage(normalized: string): string | null {
  const raw = normalized.match(YAPPY_MESSAGE_PATTERN)?.[1]?.trim();
  return raw ? raw : null;
}

// "Te enviaron por Yappy $1.00 Enviado por Isabella E.****-4820 Fecha ..."
// — money received via Yappy. Group 1 = amount, group 2 = sender's name.
const YAPPY_RECEIVED_PATTERN =
  /Te enviaron por Yappy\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*Enviado por\s*(.+?)Fecha/;

export const yappyReceivedParser: EmailParser = {
  name: "yappy-received",
  match(body) {
    return YAPPY_RECEIVED_PATTERN.test(normalizeWhitespace(body));
  },
  extract(body) {
    const normalized = normalizeWhitespace(body);
    const match = normalized.match(YAPPY_RECEIVED_PATTERN);
    const rawAmount = match?.[1];
    const merchant = match?.[2] ? cleanYappyName(match[2]) : "";
    if (!rawAmount || !merchant) return null;

    const amount = rawAmount.replace(/,/g, "");
    if (!decimalString.safeParse(amount).success) return null;

    return {
      type: "INCOME",
      amount,
      merchant,
      paymentMethod: "YAPPY",
      description: extractYappyMessage(normalized),
    };
  },
};

// "Enviaste por Yappy $1.00 Enviado a Isabella Elias69264820 Fecha ..." —
// money sent via Yappy. Group 1 = amount, group 2 = recipient's name.
const YAPPY_SENT_PATTERN =
  /Enviaste por Yappy\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*Enviado a\s*(.+?)Fecha/;

export const yappySentParser: EmailParser = {
  name: "yappy-sent",
  match(body) {
    return YAPPY_SENT_PATTERN.test(normalizeWhitespace(body));
  },
  extract(body) {
    const normalized = normalizeWhitespace(body);
    const match = normalized.match(YAPPY_SENT_PATTERN);
    const rawAmount = match?.[1];
    const merchant = match?.[2] ? cleanYappyName(match[2]) : "";
    if (!rawAmount || !merchant) return null;

    const amount = rawAmount.replace(/,/g, "");
    if (!decimalString.safeParse(amount).success) return null;

    return {
      type: "EXPENSE",
      amount,
      merchant,
      paymentMethod: "YAPPY",
      description: extractYappyMessage(normalized),
    };
  },
};

/**
 * Tried in order; the first parser whose match() returns true wins. Adding
 * support for another email template (a reversal, an ATM withdrawal, an
 * incoming transfer) later is just appending one more { match, extract }
 * entry here — nothing else in the Gmail sync pipeline needs to change.
 */
export const parsers: EmailParser[] = [
  purchaseNotificationParser,
  yappyReceivedParser,
  yappySentParser,
];

export function parseTransactionEmail(body: string): ParsedTransaction | null {
  const parser = parsers.find((p) => p.match(body));
  return parser ? parser.extract(body) : null;
}
