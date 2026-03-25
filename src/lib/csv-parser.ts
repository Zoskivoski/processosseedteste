import Papa from "papaparse";
import type { ProcessRecord } from "@/types/process";
import { parseBrazilianDate } from "@/lib/date";
import { stripAccents } from "@/lib/text";

type CsvFieldKey = keyof Omit<ProcessRecord, "diasAtraso" | "emAtraso" | "encerrado" | "sourceFile">;
type CsvFieldRecord = Pick<ProcessRecord, CsvFieldKey>;

function isWeekday(date: Date): boolean {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}

function calculateBusinessDays(dateStr: string): number {
  const date = parseBrazilianDate(dateStr);
  if (!date) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (now <= d) return 0;

  let count = 0;
  const cursor = new Date(d);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= now) {
    if (isWeekday(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const COLUMN_MAP: Record<string, CsvFieldKey> = {
  "protocolo": "protocolo",
  "tipo do processo": "tipoProcesso",
  "motivo tramite": "motivoTramite",
  "data envio": "dataEnvio",
  "local de": "localDe",
  "local atual": "localAtual",
  "assunto - palavra chave": "palavraChave",
  "interessado": "interessado",
  "detalhamento": "detalhamento",
  "protocolo cabeca": "protocoloCabeca",
};

export function parseCSVFile(file: File): Promise<ProcessRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transformHeader: (header: string) => {
        return stripAccents(header.trim().toLowerCase().replace(/\s+/g, " "));
      },
      complete: (results) => {
        const grouped = new Map<string, ProcessRecord>();

        for (const row of results.data as Record<string, string>[]) {
          const rawProtocolo = ((row["protocolo"] || "") as string).trim();

          // Descartar protocolos com asterisco
          if (rawProtocolo.startsWith("*")) continue;

          // Descartar protocolos antigos (ano < 21)
          const yearPrefix = parseInt(rawProtocolo.substring(0, 2), 10);
          if (isNaN(yearPrefix) || yearPrefix < 21) continue;

          const record: Partial<ProcessRecord> = { sourceFile: file.name };
          const csvFieldRecord = record as Partial<CsvFieldRecord>;

          for (const [normalizedKey, value] of Object.entries(row)) {
            const mappedKey = COLUMN_MAP[normalizedKey];
            if (mappedKey) {
              csvFieldRecord[mappedKey] = (value || "").trim();
            }
          }

          if (!record.protocolo) continue;

          // Regra de encerramento
          const motivoLower = (record.motivoTramite || "").toLowerCase();
          const localAtualLower = (record.localAtual || "").toLowerCase();
          const isEncerrado = motivoLower.includes("arquivado") || localAtualLower.includes("arq");
          record.encerrado = isEncerrado;

          // Cálculo de atraso baseado em data envio (só para ativos)
          if (!isEncerrado && record.dataEnvio) {
            record.diasAtraso = calculateBusinessDays(record.dataEnvio);
            record.emAtraso = record.diasAtraso > 3;
          } else {
            record.diasAtraso = 0;
            record.emAtraso = false;
          }

          // Deduplicação: manter apenas a linha mais recente por protocolo
          const existing = grouped.get(record.protocolo);
          if (existing) {
            const existingDate = parseBrazilianDate(existing.dataEnvio);
            const newDate = parseBrazilianDate(record.dataEnvio || "");
            if (newDate && (!existingDate || newDate > existingDate)) {
              grouped.set(record.protocolo, record as ProcessRecord);
            }
          } else {
            grouped.set(record.protocolo, record as ProcessRecord);
          }
        }

        resolve(Array.from(grouped.values()));
      },
      error: (error) => reject(error),
    });
  });
}

export async function parseMultipleCSVFiles(files: File[]): Promise<ProcessRecord[]> {
  const results = await Promise.all(files.map(parseCSVFile));
  // Deduplicação global entre arquivos
  const grouped = new Map<string, ProcessRecord>();
  for (const record of results.flat()) {
    const existing = grouped.get(record.protocolo);
    if (existing) {
      const existingDate = parseBrazilianDate(existing.dataEnvio);
      const newDate = parseBrazilianDate(record.dataEnvio);
      if (newDate && (!existingDate || newDate > existingDate)) {
        grouped.set(record.protocolo, record);
      }
    } else {
      grouped.set(record.protocolo, record);
    }
  }
  return Array.from(grouped.values());
}
