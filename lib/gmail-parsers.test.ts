import { describe, expect, it } from "vitest";
import { parseTransactionEmail, purchaseNotificationParser } from "./gmail-parsers";

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
    expect(result).toEqual({ type: "EXPENSE", amount: "10.00", merchant: "STORE X" });
  });

  it("handles an amount with no cents", () => {
    const body = "La tarjeta VISA a nombre de X, terminación 1234 pagó $5 en SOME STORE.";
    expect(purchaseNotificationParser.extract(body)).toEqual({
      type: "EXPENSE",
      amount: "5",
      merchant: "SOME STORE",
    });
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

describe("parseTransactionEmail", () => {
  it("returns a parsed transaction for a matching email", () => {
    expect(parseTransactionEmail(SAMPLE_BODY)).toEqual({
      type: "EXPENSE",
      amount: "36.85",
      merchant: "METRO BELLA VISTA 4730PANAMA PA",
    });
  });

  it("returns null when no parser matches", () => {
    expect(parseTransactionEmail("Some unrelated marketing email.")).toBeNull();
  });
});
