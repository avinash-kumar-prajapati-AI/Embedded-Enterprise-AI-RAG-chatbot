import { randomBytes } from "crypto";

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

/** Public key, safe to expose in the embeddable widget's client-side snippet. */
export function generateSiteKey(): string {
  return `pk_${randomToken(24)}`;
}

/** Server-side secret, must never be sent to the browser. */
export function generateSecretKey(): string {
  return `sk_${randomToken(32)}`;
}
