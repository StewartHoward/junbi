import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, signState, verifyState } from "@/lib/payments/crypto";
import { formEncode, verifyStripeSignature } from "@/lib/payments/stripe";
import { verifyGoCardlessSignature } from "@/lib/payments/gocardless";

describe("payment helpers", () => {
  it("encrypts tokens so they can be read back, and never in plain text", () => {
    const blob = encrypt("live_token_123");
    expect(blob).not.toContain("live_token_123");
    expect(decrypt(blob)).toBe("live_token_123");
    expect(() => decrypt(blob.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toThrow();
  });

  it("signs the connect state and rejects tampering or expiry", () => {
    const st = signState({ clubId: "club-1", provider: "stripe" });
    expect(verifyState(st)).toEqual({ clubId: "club-1", provider: "stripe" });
    const [body, sig] = st.split(".");
    const forged = Buffer.from(JSON.stringify({ clubId: "club-2", provider: "stripe", exp: 9999999999 })).toString("base64url");
    expect(verifyState(`${forged}.${sig}`)).toBeNull();
    expect(verifyState(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(verifyState(signState({ clubId: "c", provider: "stripe" }, -10))).toBeNull();
    expect(verifyState(null)).toBeNull();
  });

  it("encodes nested Stripe parameters", () => {
    expect(decodeURIComponent(formEncode({ mode: "subscription", payment_method_types: ["bacs_debit"], line_items: [{ quantity: 1, price_data: { unit_amount: 3500 } }] }))).toBe(
      "mode=subscription&payment_method_types[0]=bacs_debit&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=3500",
    );
  });

  it("checks Stripe webhook signatures, including the time window", () => {
    const secret = "whsec_test";
    const body = '{"id":"evt_1"}';
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    expect(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret)).toBe(true);
    expect(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t - 1000},v1=${createHmac("sha256", secret).update(`${t - 1000}.${body}`).digest("hex")}`, secret)).toBe(false);
    expect(verifyStripeSignature(body, null, secret)).toBe(false);
  });

  it("checks GoCardless webhook signatures", () => {
    const secret = "gc_secret";
    const body = '{"events":[]}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyGoCardlessSignature(body, sig, secret)).toBe(true);
    expect(verifyGoCardlessSignature(body, sig.replace(/^./, "0"), secret)).toBe(false);
    expect(verifyGoCardlessSignature(body, sig, "")).toBe(false);
  });
});
