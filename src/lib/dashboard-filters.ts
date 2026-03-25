import { NRE_OPTIONS } from "@/constants/nre";
import type { DashboardRecord } from "@/lib/process-metadata";

export interface DashboardFilters {
  nreSiglas: string[];
  technician: string | null;
}

export function filterDashboardRecords(records: DashboardRecord[], filters: DashboardFilters): DashboardRecord[] {
  const allowedNres = filters.nreSiglas.length > 0 ? new Set(filters.nreSiglas) : null;

  return records.filter((record) => {
    const matchesNre = !allowedNres || (record.nreSigla ? allowedNres.has(record.nreSigla) : false);
    const matchesTechnician = !filters.technician || record.technician === filters.technician;
    return matchesNre && matchesTechnician;
  });
}

export function getAvailableTechnicians(records: DashboardRecord[]): string[] {
  return Array.from(
    new Set(records.map((record) => record.technician).filter((technician): technician is string => Boolean(technician))),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function getAvailableNres(records: DashboardRecord[]) {
  const counts = new Map<string, number>();

  for (const record of records) {
    if (!record.nreSigla) continue;
    counts.set(record.nreSigla, (counts.get(record.nreSigla) ?? 0) + 1);
  }

  return NRE_OPTIONS.filter((option) => counts.has(option.sigla)).map((option) => ({
    ...option,
    count: counts.get(option.sigla) ?? 0,
  }));
}
