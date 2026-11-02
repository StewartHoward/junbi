/** Features that can be switched on or off for every club from the Junbi admin page. Off until switched on. */
export const FEATURES = [
  { key: "events", label: "Gradings and events", hint: "The Gradings page, invitations, online booking and card payment, and bookings in the parent login." },
  { key: "shop", label: "Club shop", hint: "The Shop page, each club's online shop and the shop link in the parent login." },
  { key: "website", label: "Club websites", hint: "The Website editor, club websites at junbi.co.uk/c/..., own domains and club pages in the sitemap." },
  { key: "family", label: "Parent login", hint: "Parents and members signing in at junbi.co.uk/family, and the links to it." },
] as const;

export type Feature = (typeof FEATURES)[number]["key"];
export type FeatureFlags = Record<Feature, boolean>;

export const ALL_OFF: FeatureFlags = Object.fromEntries(FEATURES.map((f) => [f.key, false])) as FeatureFlags;

/** Marketing pages that describe a feature, hidden while it's off. */
export const LANDING_FEATURE: Record<string, Feature> = { "feature/gradings": "events", "feature/club-website": "website", "feature/parent-login": "family" };
