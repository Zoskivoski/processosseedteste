import { stripAccents } from "@/lib/text";

export interface NreOption {
  nre: string;
  sigla: string;
}

export const NRE_OPTIONS: NreOption[] = [
  { nre: "APUCARANA", sigla: "APU" },
  { nre: "ÁREA METROPOLITANA NORTE", sigla: "MTN" },
  { nre: "ÁREA METROPOLITANA SUL", sigla: "MTS" },
  { nre: "ASSIS CHATEAUBRIAND", sigla: "ASD" },
  { nre: "CAMPO MOURÃO", sigla: "CPM" },
  { nre: "CASCAVEL", sigla: "CSC" },
  { nre: "CIANORTE", sigla: "CNE" },
  { nre: "CORNÉLIO PROCÓPIO", sigla: "CPP" },
  { nre: "CURITIBA", sigla: "CTA" },
  { nre: "DOIS VIZINHOS", sigla: "DVZ" },
  { nre: "FOZ DO IGUAÇU", sigla: "FOZ" },
  { nre: "FRANCISCO BELTRÃO", sigla: "FNB" },
  { nre: "GOIOERÊ", sigla: "GRE" },
  { nre: "GUARAPUAVA", sigla: "GRP" },
  { nre: "IBAITI", sigla: "IBT" },
  { nre: "IRATI", sigla: "IRI" },
  { nre: "IVAIPORÃ", sigla: "IVP" },
  { nre: "JACAREZINHO", sigla: "JZO" },
  { nre: "LARANJEIRAS DO SUL", sigla: "LDS" },
  { nre: "LOANDA", sigla: "LOA" },
  { nre: "LONDRINA", sigla: "LDA" },
  { nre: "MARINGÁ", sigla: "MGA" },
  { nre: "PARANAGUÁ", sigla: "PNG" },
  { nre: "PARANAVAÍ", sigla: "PVA" },
  { nre: "PATO BRANCO", sigla: "PBC" },
  { nre: "PITANGA", sigla: "PIG" },
  { nre: "PONTA GROSSA", sigla: "PGO" },
  { nre: "TELÊMACO BORBA", sigla: "TEB" },
  { nre: "TOLEDO", sigla: "TOO" },
  { nre: "UMUARAMA", sigla: "UMR" },
  { nre: "UNIÃO DA VITÓRIA", sigla: "UVA" },
  { nre: "WENCESLAU BRAZ", sigla: "WBZ" },
];

export const NRE_SIGLAS = new Set(NRE_OPTIONS.map(({ sigla }) => sigla));

export const NRE_BY_SIGLA = new Map(NRE_OPTIONS.map((option) => [option.sigla, option]));

export const NRE_BY_NAME = new Map(
  NRE_OPTIONS.map((option) => [stripAccents(option.nre).toUpperCase(), option.sigla]),
);

export function getNreName(sigla: string): string {
  return NRE_BY_SIGLA.get(sigla)?.nre ?? sigla;
}
