import { describe, expect, it } from "vitest";
import {
  parseTransactionEmail,
  purchaseNotificationParser,
  yappyReceivedParser,
  yappySentParser,
} from "./gmail-parsers";

// The exact real sample provided by the user (Banco General, Panama).
const SAMPLE_BODY =
  "La tarjeta VISA CONNECTMILES PLATINUM a nombre de DIEGO UREÑA, terminación 9162 pagó $36.85 en METRO BELLA VISTA 4730PANAMA PA.\n\n" +
  "Si no reconoces la transacción llámanos al 300-5000.\n\n" +
  "Descarga Banca Móvil para recibir los mensajes directamente en la aplicación.\n\n" +
  "Por ser este un correo masivo, te agradecemos no contestes a esta dirección.\n\n" +
  "Cancelar suscripción";

describe("purchaseNotificationParser", () => {
  it("matches the real Banco General purchase notification format", () => {
    expect(purchaseNotificationParser.match(SAMPLE_BODY)).toBe(true);
  });

  it("extracts the amount and merchant from the sample email", () => {
    const result = purchaseNotificationParser.extract(SAMPLE_BODY);
    expect(result).toEqual({
      type: "EXPENSE",
      amount: "36.85",
      merchant: "METRO BELLA VISTA 4730PANAMA PA",
      paymentMethod: "CREDIT_CARD",
      description: null,
    });
  });

  it("does not include the trailing sentence period, or any following paragraph, in the merchant", () => {
    const result = purchaseNotificationParser.extract(SAMPLE_BODY);
    expect(result?.merchant).not.toContain(".");
    expect(result?.merchant).not.toContain("Si no reconoces");
  });

  it("is robust to extra whitespace/line-wrapping around the sentence", () => {
    const wrapped = "  La tarjeta VISA\n  a nombre de DIEGO UREÑA, terminación 9162   pagó $10.00  en\nSTORE X.  \nMore text after.";
    const result = purchaseNotificationParser.extract(wrapped);
    expect(result).toEqual({
      type: "EXPENSE",
      amount: "10.00",
      merchant: "STORE X",
      paymentMethod: "CREDIT_CARD",
      description: null,
    });
  });

  it("handles an amount with no cents", () => {
    const body = "La tarjeta VISA a nombre de X, terminación 1234 pagó $5 en SOME STORE.";
    expect(purchaseNotificationParser.extract(body)).toEqual({
      type: "EXPENSE",
      amount: "5",
      merchant: "SOME STORE",
      paymentMethod: "CREDIT_CARD",
      description: null,
    });
  });

  it("handles a comma-separated thousands amount", () => {
    const body = "La tarjeta VISA a nombre de X, terminación 1234 pagó $1,234.56 en BIG PURCHASE STORE.";
    expect(purchaseNotificationParser.extract(body)).toEqual({
      type: "EXPENSE",
      amount: "1234.56",
      merchant: "BIG PURCHASE STORE",
      paymentMethod: "CREDIT_CARD",
      description: null,
    });
  });

  it("handles a comma-separated thousands amount with no cents", () => {
    const body = "La tarjeta VISA a nombre de X, terminación 1234 pagó $2,000 en ANOTHER STORE.";
    expect(purchaseNotificationParser.extract(body)).toEqual({
      type: "EXPENSE",
      amount: "2000",
      merchant: "ANOTHER STORE",
      paymentMethod: "CREDIT_CARD",
      description: null,
    });
  });

  it("defaults to CREDIT_CARD when the email doesn't say which kind of card", () => {
    const result = purchaseNotificationParser.extract(SAMPLE_BODY);
    expect(result?.paymentMethod).toBe("CREDIT_CARD");
  });

  it("detects DEBIT_CARD when the email body mentions débito", () => {
    const body =
      "La tarjeta de débito VISA a nombre de X, terminación 1234 pagó $15.00 en DEBIT STORE.";
    expect(purchaseNotificationParser.extract(body)?.paymentMethod).toBe("DEBIT_CARD");
  });

  it("detects DEBIT_CARD without the accent too (debito)", () => {
    const body = "La tarjeta debito VISA a nombre de X, terminación 1234 pagó $15.00 en DEBIT STORE.";
    expect(purchaseNotificationParser.extract(body)?.paymentMethod).toBe("DEBIT_CARD");
  });

  it("does not match an unrelated email body", () => {
    const body = "Your monthly statement is now available. Please review your account activity.";
    expect(purchaseNotificationParser.match(body)).toBe(false);
    expect(purchaseNotificationParser.extract(body)).toBeNull();
  });

  it("does not match and does not throw on an empty body", () => {
    expect(purchaseNotificationParser.match("")).toBe(false);
    expect(purchaseNotificationParser.extract("")).toBeNull();
  });
});

// Real samples (with a fictitious counterparty name) — copy-pasted from a
// rendered Yappy email, so adjacent fields run together with no whitespace
// between them (e.g. "Enviado porJuan P.****-4820Fecha").
const YAPPY_RECEIVED_BODY =
  "Yappy-logoTe enviaron por Yappy$1.00 Enviado porJuan P.****-4820Fecha\t11 ago 2026 03:25 p. m.\t   Mensaje\tDevolucion   Confirmación\tFCXDZ-79530470\t Estamos aquí para ayudarte.";
const YAPPY_SENT_BODY =
  "Yappy-logoEnviaste por Yappy$1.00 Enviado aJuan Perez69264820Fecha\t11 ago 2026 03:25 p. m.\t   Mensaje\t   Confirmación\tMIBYK-08548568\t Estamos aquí para ayudarte.";

describe("yappyReceivedParser", () => {
  it("matches and extracts an INCOME transaction from a real 'Te enviaron por Yappy' email", () => {
    expect(yappyReceivedParser.match(YAPPY_RECEIVED_BODY)).toBe(true);
    expect(yappyReceivedParser.extract(YAPPY_RECEIVED_BODY)).toEqual({
      type: "INCOME",
      amount: "1.00",
      merchant: "Juan P.",
      paymentMethod: "YAPPY",
      description: "Devolucion",
    });
  });

  it("strips the masked account number that runs into the name", () => {
    const result = yappyReceivedParser.extract(YAPPY_RECEIVED_BODY);
    expect(result?.merchant).not.toContain("*");
    expect(result?.merchant).not.toContain("4820");
  });

  it("extracts null (not an empty string) when the sender left the Mensaje field blank", () => {
    const bodyWithBlankMessage =
      "Yappy-logoTe enviaron por Yappy$5.00 Enviado porAna R.****-1234Fecha 12 ago 2026 09:00 a. m.    Mensaje    Confirmación GHIJK-11111111 Estamos aquí para ayudarte.";
    expect(yappyReceivedParser.extract(bodyWithBlankMessage)?.description).toBeNull();
  });

  it("does not match a 'sent' email or an unrelated body", () => {
    expect(yappyReceivedParser.match(YAPPY_SENT_BODY)).toBe(false);
    expect(yappyReceivedParser.match("Your statement is ready.")).toBe(false);
    expect(yappyReceivedParser.extract("Your statement is ready.")).toBeNull();
  });
});

describe("yappySentParser", () => {
  it("matches and extracts an EXPENSE transaction from a real 'Enviaste por Yappy' email", () => {
    expect(yappySentParser.match(YAPPY_SENT_BODY)).toBe(true);
    expect(yappySentParser.extract(YAPPY_SENT_BODY)).toEqual({
      type: "EXPENSE",
      amount: "1.00",
      merchant: "Juan Perez",
      paymentMethod: "YAPPY",
      description: null,
    });
  });

  it("strips the raw phone-number digits that run into the name", () => {
    const result = yappySentParser.extract(YAPPY_SENT_BODY);
    expect(result?.merchant).not.toContain("6926");
  });

  it("extracts a filled-in Mensaje too, same as the received side", () => {
    const bodyWithMessage =
      "Yappy-logoEnviaste por Yappy$25.00 Enviado aMaria Lopez98765432Fecha 12 ago 2026 09:00 a. m.    Mensaje    Almuerzo   Confirmación LMNOP-22222222 Estamos aquí para ayudarte.";
    expect(yappySentParser.extract(bodyWithMessage)?.description).toBe("Almuerzo");
  });

  it("does not match a 'received' email or an unrelated body", () => {
    expect(yappySentParser.match(YAPPY_RECEIVED_BODY)).toBe(false);
    expect(yappySentParser.match("Your statement is ready.")).toBe(false);
    expect(yappySentParser.extract("Your statement is ready.")).toBeNull();
  });
});

describe("parseTransactionEmail", () => {
  it("returns a parsed transaction for a matching email", () => {
    expect(parseTransactionEmail(SAMPLE_BODY)).toEqual({
      type: "EXPENSE",
      amount: "36.85",
      merchant: "METRO BELLA VISTA 4730PANAMA PA",
      paymentMethod: "CREDIT_CARD",
      description: null,
    });
  });

  it("returns null when no parser matches", () => {
    expect(parseTransactionEmail("Some unrelated marketing email.")).toBeNull();
  });

  // Regression anchor for the ReDoS fix: PURCHASE_PATTERN's two free-text
  // spans used to be unbounded `.+?`, which measured O(k·n) against a body
  // repeating the literal " a nombre de " -- 35.9s for a 1MB body. Bounded
  // negated character classes plus the MAX_PARSE_LENGTH cap in
  // parseTransactionEmail should keep this linear regardless of input.
  it("parses an adversarial 1MB body in well under a second", () => {
    const adversarialBody = "La tarjeta " + " a nombre de ".repeat(5000);
    const start = performance.now();
    const result = parseTransactionEmail(adversarialBody);
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(50);
    expect(result).toBeNull();
  });

  it("dispatches a Yappy 'received' email to an INCOME transaction", () => {
    expect(parseTransactionEmail(YAPPY_RECEIVED_BODY)).toEqual({
      type: "INCOME",
      amount: "1.00",
      merchant: "Juan P.",
      paymentMethod: "YAPPY",
      description: "Devolucion",
    });
  });

  it("dispatches a Yappy 'sent' email to an EXPENSE transaction", () => {
    expect(parseTransactionEmail(YAPPY_SENT_BODY)).toEqual({
      type: "EXPENSE",
      amount: "1.00",
      merchant: "Juan Perez",
      paymentMethod: "YAPPY",
      description: null,
    });
  });
});
