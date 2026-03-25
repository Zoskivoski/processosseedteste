const LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "no", "na"]);

export function stripAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function normalizeKey(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim();
}
