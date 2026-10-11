/** Colour for the ring round a student's initials: their belt colour, or a plain line for new starters. */
export function ringColour(beltColour: string | null | undefined) {
  if (!beltColour || beltColour === "none") return "var(--line)";
  if (beltColour === "white") return "var(--line)";
  return `var(--belt-${beltColour})`;
}
