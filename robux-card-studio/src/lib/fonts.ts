export const FONT_CANDIDATES = [
  "Montserrat",
  "Oswald",
  "Roboto Condensed",
  "Arial Black",
  "Georgia",
  "Courier New",
];

export function suggestFonts(role: string): string[] {
  if (role === "denomination") {
    return ["Oswald", "Montserrat", "Arial Black"];
  }
  if (role === "title") {
    return ["Montserrat", "Roboto Condensed", "Georgia"];
  }
  return ["Montserrat", "Roboto Condensed", "Arial"];
}
