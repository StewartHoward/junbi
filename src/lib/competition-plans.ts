/**
 * Junbi Competitions hosting prices. One source for the Competitions pages (and later, checkout).
 * Prices are in pence. Hosts pay one flat fee per competition, never a cut of entry fees.
 * Entering a competition is always free for clubs.
 */

export const COMPETITION_PLANS = [
  { id: "small", name: "Small", for: "Club championships and local opens.", pence: 4900, limit: "Up to 150 entries" },
  { id: "standard", name: "Standard", for: "Regional and open championships.", pence: 9900, limit: "Up to 400 entries" },
  { id: "large", name: "Large", for: "National championships and big opens.", pence: 14900, limit: "Unlimited entries" },
] as const;

/** A seminar or course, priced per event. */
export const SEMINAR_PENCE = 1900;

/** Clubs on any Junbi club plan get this much off hosting. */
export const JUNBI_CLUB_DISCOUNT_PERCENT = 50;

/** Every host's first competition is free, whatever its size. */
export const FIRST_COMPETITION_FREE = true;

/** Everything every competition gets, whatever its size. */
export const COMPETITION_FEATURES = [
  "Poomsae and WT sparring",
  "Categories picked for every athlete",
  "Entry limit and waiting list",
  "Entry fees paid straight to you",
  "Lists for the scoring table",
  "Your own event page",
] as const;

export const poundsFromPence = (pence: number) => `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;
