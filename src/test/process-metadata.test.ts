import { describe, expect, it } from "vitest";
import { filterDashboardRecords } from "@/lib/dashboard-filters";
import {
  enrichProcessRecord,
  extractTechnicianFirstName,
  formatLocal,
  getNreSigla,
  getNreSiglaFromRecord,
} from "@/lib/process-metadata";
import type { ProcessRecord } from "@/types/process";

const baseRecord: ProcessRecord = {
  protocolo: "24001-1",
  tipoProcesso: "Solicitação",
  motivoTramite: "Encaminhamento",
  dataEnvio: "22/03/2026 10:00",
  localDe: "SEED/DG/UTGI",
  localAtual: "SEED/DG/UTGI/APU",
  palavraChave: "Infraestrutura",
  interessado: "NÚCLEO REGIONAL DE EDUCAÇÃO DE APUCARANA",
  detalhamento: "",
  protocoloCabeca: "",
  diasAtraso: 5,
  emAtraso: true,
  encerrado: false,
  sourceFile: "relatorio_yeda_processos.csv",
};

describe("process metadata", () => {
  it("normalizes local and detects NRE siglas", () => {
    expect(formatLocal("SEED/DG/UTGI/APU")).toBe("APU");
    expect(getNreSigla("SEED/DG/UTGI/APU")).toBe("APU");
    expect(getNreSigla("SEED/LDA/EDI")).toBe("LDA");
    expect(getNreSigla("NÚCLEO REGIONAL DE EDUCAÇÃO DE MARINGÁ")).toBe("MGA");
  });

  it("falls back to interessado and detalhamento when local fields do not contain the NRE", () => {
    expect(
      getNreSiglaFromRecord({
        localAtual: "SEED/NAS/ARQ",
        localDe: "SEED/DG/UTGI/CBI",
        interessado: "SEED/NRE DE TELEMACO BORBA",
        detalhamento: "",
      }),
    ).toBe("TEB");

    expect(
      getNreSiglaFromRecord({
        localAtual: "SEED/DG/UTGI/LOC",
        localDe: "SEED/DG/UTGI/LOC",
        interessado: "SEED/GAS/CH",
        detalhamento: "Locação de imóvel para atender o NRE de Francisco Beltrão.",
      }),
    ).toBe("FNB");
  });

  it("extracts the first technician name from the source file", () => {
    expect(extractTechnicianFirstName("relatorio_yeda_processos.csv")).toBe("Yeda");
    expect(extractTechnicianFirstName("tecnico_Ágata_exportacao.csv")).toBe("Ágata");
  });

  it("combines technician and NRE filters over enriched records", () => {
    const records = [
      enrichProcessRecord(baseRecord),
      enrichProcessRecord({
        ...baseRecord,
        protocolo: "24001-2",
        localAtual: "SEED/DG/UTGI/MGA",
        sourceFile: "relatorio_yeda_processos.csv",
      }),
      enrichProcessRecord({
        ...baseRecord,
        protocolo: "24001-3",
        localAtual: "SEED/DG/UTGI/APU",
        sourceFile: "relatorio_mauricio_processos.csv",
      }),
    ];

    const filtered = filterDashboardRecords(records, {
      nreSiglas: ["APU"],
      technician: "Yeda",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.protocolo).toBe("24001-1");
  });
});
