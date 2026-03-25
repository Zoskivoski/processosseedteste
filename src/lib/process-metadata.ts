import type { ProcessRecord } from "@/types/process";
import { NRE_BY_NAME, NRE_SIGLAS } from "@/constants/nre";
import { stripAccents, toTitleCase } from "@/lib/text";

export interface DashboardRecord extends ProcessRecord {
  localLabel: string;
  nreSigla: string | null;
  technician: string | null;
}

const TECHNICIAN_HINTS = new Set(["tecnico", "tecnica", "responsavel", "utgi"]);
const TECHNICIAN_STOP_WORDS = new Set([
  "arquivo",
  "arquivos",
  "atrasados",
  "base",
  "csv",
  "dados",
  "eprotocolo",
  "exportacao",
  "exportacoes",
  "painel",
  "processo",
  "processos",
  "protocolo",
  "protocolos",
  "relatorio",
  "relatorios",
  "seed",
  "tramite",
  "tramites",
  "tramitacao",
  "utgi",
]);

export function formatLocal(local: string | undefined | null): string {
  if (!local || local === "null" || !local.trim()) return "UTGI";

  let cleaned = local.trim();
  cleaned = cleaned.replace(/^SEED\/DG\/UTGI\//i, "").trim();
  cleaned = cleaned.replace(/^SEED\//i, "").trim();

  const uppercase = cleaned.toUpperCase();
  if (NRE_SIGLAS.has(uppercase)) return uppercase;

  if (uppercase.startsWith("DPGE")) {
    const parts = cleaned.split("/");
    return parts.length > 1 ? parts.slice(0, 2).join("/") : cleaned;
  }

  return cleaned || "UTGI";
}

function normalizeNreText(value: string): string {
  return stripAccents(value)
    .toUpperCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNreText(value: string): string {
  return normalizeNreText(value).replace(/[^A-Z0-9]/g, "");
}

function extractNreSiglaFromText(value: string | undefined | null): string | null {
  if (!value || value === "null" || !value.trim()) return null;

  const normalized = normalizeNreText(value);
  const compact = compactNreText(value);

  const pathSegments = normalized.split("/").map((segment) => segment.trim()).filter(Boolean);
  for (const segment of pathSegments) {
    if (NRE_SIGLAS.has(segment)) return segment;
    const fromName = NRE_BY_NAME.get(segment);
    if (fromName) return fromName;
  }

  for (const token of normalized.match(/\b[A-Z]{3}\b/g) ?? []) {
    if (NRE_SIGLAS.has(token)) return token;
  }

  const directName = NRE_BY_NAME.get(normalized);
  if (directName) return directName;

  for (const [cityName, sigla] of NRE_BY_NAME.entries()) {
    const cityCompact = cityName.replace(/[^A-Z0-9]/g, "");

    if (
      normalized.includes(`SEED/NRE DE ${cityName}`) ||
      normalized.includes(`NRE DE ${cityName}`) ||
      compact.includes(`NUCLEOREGIONALDEEDUCACAODE${cityCompact}`) ||
      compact.includes(`NUCLEODEEDUCACAO${cityCompact}`) ||
      compact.includes(`SEEDNREDE${cityCompact}`) ||
      compact.includes(`NREDE${cityCompact}`)
    ) {
      return sigla;
    }
  }

  return null;
}

export function getNreSigla(local: string | undefined | null): string | null {
  const formatted = formatLocal(local);
  return extractNreSiglaFromText(formatted) ?? extractNreSiglaFromText(local);
}

export function getNreSiglaFromRecord(record: Pick<ProcessRecord, "localAtual" | "localDe" | "interessado" | "detalhamento">): string | null {
  return (
    extractNreSiglaFromText(record.localAtual) ??
    extractNreSiglaFromText(record.localDe) ??
    extractNreSiglaFromText(record.interessado) ??
    extractNreSiglaFromText(record.detalhamento) ??
    null
  );
}

export function formatInteressado(name: string | undefined | null): string {
  if (!name || name === "null" || !name.trim()) return "—";
  const text = name.trim();

  const explicitNreSigla = extractNreSiglaFromText(text);
  if (explicitNreSigla && normalizeNreText(text).includes("NRE")) {
    return `NRE ${explicitNreSigla}`;
  }

  const nreMatch = text.match(/N[UÚ]CLEO\s+REGIONAL\s+DE\s+EDUCA[CÇ][AÃ]O\s+(?:DE\s+)?(.+)/i);
  if (nreMatch?.[1]) {
    const sigla = NRE_BY_NAME.get(stripAccents(nreMatch[1]).toUpperCase());
    return sigla ? `NRE ${sigla}` : `NRE ${toTitleCase(nreMatch[1].trim())}`;
  }

  if (text.length <= 40) return toTitleCase(text);

  const words = text.split(/\s+/);
  const skippedWords = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "A", "O", "EM", "NO", "NA"]);
  let built = "";
  let initials = "";
  let abbreviating = false;

  for (const word of words) {
    if (!abbreviating && built.length + word.length < 35) {
      built += `${built ? " " : ""}${toTitleCase(word.toLowerCase())}`;
      continue;
    }

    abbreviating = true;
    if (!skippedWords.has(word.toUpperCase()) && word.length > 1) {
      initials += word[0].toUpperCase();
    }
  }

  return initials ? `${built} - ${initials}` : built;
}

function cleanToken(token: string): string {
  const cleaned = token.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, "");
  return cleaned ? toTitleCase(cleaned) : "";
}

export function extractTechnicianFirstName(sourceFile: string | undefined | null): string | null {
  if (!sourceFile) return null;

  const basename = sourceFile.replace(/\.[^.]+$/, "");
  const tokens = basename.split(/[\s._-]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const normalizedTokens = tokens.map((token) => stripAccents(token).toLowerCase().replace(/[^a-z]/g, ""));

  for (let index = 0; index < normalizedTokens.length - 1; index += 1) {
    if (!TECHNICIAN_HINTS.has(normalizedTokens[index])) continue;

    const candidate = cleanToken(tokens[index + 1]);
    const normalizedCandidate = stripAccents(candidate).toLowerCase();
    if (candidate && !TECHNICIAN_STOP_WORDS.has(normalizedCandidate)) {
      return candidate;
    }
  }

  for (let index = 0; index < normalizedTokens.length; index += 1) {
    const normalized = normalizedTokens[index];
    if (!normalized || normalized.length < 3 || TECHNICIAN_STOP_WORDS.has(normalized)) continue;

    const candidate = cleanToken(tokens[index]);
    if (candidate) return candidate;
  }

  return null;
}

export function enrichProcessRecord(record: ProcessRecord): DashboardRecord {
  return {
    ...record,
    localLabel: formatLocal(record.localAtual),
    nreSigla: getNreSiglaFromRecord(record),
    technician: extractTechnicianFirstName(record.sourceFile),
  };
}
