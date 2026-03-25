export interface ProcessRecord {
  protocolo: string;
  tipoProcesso: string;
  motivoTramite: string;
  dataEnvio: string;
  localDe: string;
  localAtual: string;
  palavraChave: string;
  interessado: string;
  detalhamento: string;
  protocoloCabeca: string;
  diasAtraso: number;
  emAtraso: boolean;
  encerrado: boolean;
  sourceFile: string;
}
