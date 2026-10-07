/**
 * The pick-a-user sign-in page is allowed in two cases only:
 * - local development with JUNBI_DEV_LOGIN=1
 * - a public demo running on fake data with JUNBI_DEMO_MODE=1
 * Never set JUNBI_DEMO_MODE on a deployment that holds a real club's data.
 */
export function devLoginEnabled(): boolean {
  if (process.env.JUNBI_DEMO_MODE === "1") return true;
  return process.env.NODE_ENV !== "production" && process.env.JUNBI_DEV_LOGIN === "1";
}
