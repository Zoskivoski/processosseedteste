import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import DashboardView from "@/components/DashboardView";
import { parseMultipleCSVFiles } from "@/lib/csv-parser";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { useToast } from "@/hooks/use-toast";
import type { ProcessRecord } from "@/types/process";

const LAST_PROCESSED_DATA_KEY = "processseed:last-processed-data:v1";

const Index = () => {
  const [data, setData] = useLocalStorageState<ProcessRecord[] | null>(LAST_PROCESSED_DATA_KEY, null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleProcess = async (files: File[]) => {
    setIsProcessing(true);
    try {
      const records = await parseMultipleCSVFiles(files);
      if (records.length === 0) {
        toast({ title: "Nenhum registro encontrado", description: "Verifique se os arquivos CSV possuem dados válidos.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
      setData(records);
      const ativos = records.filter((r) => !r.encerrado);
      const atrasados = ativos.filter((r) => r.emAtraso).length;
      toast({
        title: "Dados processados com sucesso!",
        description: `${records.length} protocolos únicos carregados. ${ativos.length} ativos, ${atrasados} em atraso.`,
        duration: 3000,
      });
    } catch {
      toast({ title: "Erro ao processar", description: "Verifique o formato dos arquivos CSV.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (data) {
    return <DashboardView data={data} onReset={() => setData(null)} />;
  }

  return <FileUpload onProcess={handleProcess} isProcessing={isProcessing} />;
};

export default Index;
