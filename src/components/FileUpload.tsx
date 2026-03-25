import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import logoSeed from "@/assets/logo-seed.png";
import logoUtgi from "@/assets/logo-utgi.png";

interface FileUploadProps {
  onProcess: (files: File[]) => void;
  isProcessing: boolean;
}

const FileUpload = ({ onProcess, isProcessing }: FileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const csvFiles = Array.from(newFiles).filter((f) => {
      if (!f.name.toLowerCase().endsWith(".csv")) {
        toast({ title: "Arquivo inválido", description: `"${f.name}" não é um arquivo CSV.`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const combined = [...prev, ...csvFiles];
      if (combined.length > 4) {
        toast({ title: "Limite excedido", description: "Máximo de 4 arquivos CSV permitidos.", variant: "destructive" });
        return combined.slice(0, 4);
      }
      return combined;
    });
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6">
      {/* Background texture */}
      <div className="fixed inset-0 -z-10 bg-texture pointer-events-none" />
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent/[0.06] blur-3xl" />
      </div>

      <div className="w-full max-w-xl space-y-8 animate-fade-in">
        {/* Institutional Header */}
        <div className="text-center space-y-5">
          <div className="flex items-center justify-center gap-6">
            <img src={logoSeed} alt="Governo do Paraná - SEED" className="h-12 sm:h-14 object-contain" />
            <div className="h-10 w-px bg-border" />
            <img src={logoUtgi} alt="UTGI" className="h-10 sm:h-12 object-contain" />
          </div>
          <div className="pr-header-bar w-32 mx-auto rounded-full" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
              Painel de Processos
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed mt-2">
              Análise inteligente de protocolos, identificação de gargalos e atrasos.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`glass-card-elevated rounded-2xl transition-all duration-300 cursor-pointer group ${
            isDragOver
              ? "ring-2 ring-primary/40 bg-primary/5 scale-[1.01]"
              : "hover:shadow-lg hover:scale-[1.005]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".csv";
            input.multiple = true;
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              if (target.files) addFiles(target.files);
            };
            input.click();
          }}
        >
          <div className="flex flex-col items-center justify-center py-14 px-6 gap-4">
            <div className={`rounded-2xl p-4 transition-colors duration-300 ${
              isDragOver ? "bg-primary/[0.15]" : "bg-primary/[0.08] group-hover:bg-primary/[0.12]"
            }`}>
              <Upload className={`h-8 w-8 transition-colors duration-300 ${
                isDragOver ? "text-primary" : "text-primary/70 group-hover:text-primary"
              }`} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Arraste e solte seus arquivos aqui</p>
              <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar • CSV • máx. 4 arquivos</p>
            </div>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              {files.length} {files.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}
            </p>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="glass-card flex items-center justify-between rounded-xl p-3.5 animate-slide-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-primary/[0.08] p-2 shrink-0">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            <Button
              className="w-full mt-2 h-12 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90"
              onClick={() => onProcess(files)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
              ) : (
                <>Analisar {files.length} {files.length === 1 ? "arquivo" : "arquivos"} <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
