export function parseBrazilianDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();
  const [datePart, timePart] = trimmed.split(" ");
  const parts = datePart.split("/");

  if (parts.length !== 3) return null;

  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;

  const date = new Date(year, month - 1, day);

  if (timePart) {
    const [hours, minutes] = timePart.split(":").map(Number);
    if (!Number.isNaN(hours)) date.setHours(hours);
    if (!Number.isNaN(minutes)) date.setMinutes(minutes);
  }

  return date;
}
