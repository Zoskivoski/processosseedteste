import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  MapPin,
  MoonStar,
  Search,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NRE_OPTIONS, NRE_SIGLAS } from "@/constants/nre";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { parseBrazilianDate } from "@/lib/date";
import { enrichProcessRecord, formatInteressado } from "@/lib/process-metadata";
import { cn } from "@/lib/utils";
import type { ProcessRecord } from "@/types/process";
import logoSeed from "@/assets/logo-seed.png";
import logoUtgi from "@/assets/logo-utgi.png";

interface DashboardViewProps {
  data: ProcessRecord[];
  onReset: () => void;
}

type SortField = "diasAtraso" | "dataEnvio" | "protocolo";
type SortDir = "asc" | "desc";
type GroupFilterValue = "__UTGI__" | "__SEAP__" | "__DPGE__" | "__NRE__" | "__OUTROS__";

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface GroupSubfilterOption extends FilterOption {
  description?: string;
}

type GroupSubfilterSelections = Record<GroupFilterValue, string[]>;

interface TableFilterCollections {
  groupCounts: Record<GroupFilterValue, number>;
  groupSubfilters: Record<GroupFilterValue, GroupSubfilterOption[]>;
}

const ITEMS_PER_PAGE = 12;
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];
const GROUP_ORDER: GroupFilterValue[] = ["__UTGI__", "__SEAP__", "__DPGE__", "__NRE__", "__OUTROS__"];
const GROUP_LABELS: Record<GroupFilterValue, string> = {
  "__UTGI__": "UTGI",
  "__SEAP__": "SEAP",
  "__DPGE__": "DPGE",
  "__NRE__": "NRE",
  "__OUTROS__": "Outros",
};
const UTGI_SUBUNITS = new Set(["UTGI", "CBI", "CH", "CREG", "DDR", "DOADER", "LOC", "PTV", "TAC", "TMI"]);
const SUBFILTER_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function buildProtocolUrl(protocolo: string): string {
  const cleaned = protocolo.replace(/[.\s-]/g, "");
  return `https://www.eprotocolo.pr.gov.br/spiweb/consultarProtocoloDigital.do?action=pesquisar&numeroProtocolo=${cleaned}`;
}

function getSortableTimestamp(dateValue: string): number {
  return parseBrazilianDate(dateValue)?.getTime() ?? 0;
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const pages: (number | "ellipsis")[] = [];

  if (totalPages <= 7) {
    for (let index = 1; index <= totalPages; index += 1) {
      pages.push(index);
    }
    return pages;
  }

  pages.push(1);
  if (currentPage > 3) pages.push("ellipsis");

  for (let index = Math.max(2, currentPage - 1); index <= Math.min(totalPages - 1, currentPage + 1); index += 1) {
    pages.push(index);
  }

  if (currentPage < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);

  return pages;
}

function getSeverity(dias: number) {
  if (dias >= 15) {
    return "bg-destructive/[0.12] text-destructive border-destructive/20";
  }

  if (dias >= 7) {
    return "bg-warning/[0.15] text-warning-foreground border-warning/25";
  }

  return "bg-primary/[0.12] text-primary border-primary/20";
}

function isGroupFilterValue(value: string): value is GroupFilterValue {
  return GROUP_ORDER.includes(value as GroupFilterValue);
}

function createEmptyGroupSubfilterSelections(): GroupSubfilterSelections {
  return {
    "__UTGI__": [],
    "__SEAP__": [],
    "__DPGE__": [],
    "__NRE__": [],
    "__OUTROS__": [],
  };
}

function getSelectedSubfilterCount(selections: GroupSubfilterSelections) {
  return GROUP_ORDER.reduce((count, group) => count + selections[group].length, 0);
}

function getRecordGroup(record: ReturnType<typeof enrichProcessRecord>): GroupFilterValue | null {
  const localUpper = record.localLabel.toUpperCase();
  const rawUpper = (record.localAtual ?? "").toUpperCase().trim();
  const head = localUpper.split("/")[0]?.trim() ?? "";

  if (rawUpper.startsWith("SEED/DG/UTGI/") || UTGI_SUBUNITS.has(head) || head === "UTGI") return "__UTGI__";
  if (rawUpper.startsWith("SEAP/") || head === "SEAP") return "__SEAP__";
  if (rawUpper.startsWith("SEED/DPGE/") || head === "DPGE") return "__DPGE__";
  if (NRE_SIGLAS.has(head) || localUpper.startsWith("NRE")) return "__NRE__";
  return "__OUTROS__";
}

function mapCountsToOptions(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, count]) => ({ value: label, label, count }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function buildTableFilterCollections(records: ReturnType<typeof enrichProcessRecord>[]): TableFilterCollections {
  const groupCounts: Record<GroupFilterValue, number> = {
    "__UTGI__": 0,
    "__SEAP__": 0,
    "__DPGE__": 0,
    "__NRE__": 0,
    "__OUTROS__": 0,
  };
  const groupSubfilterCounts: Record<GroupFilterValue, Map<string, number>> = {
    "__UTGI__": new Map<string, number>(),
    "__SEAP__": new Map<string, number>(),
    "__DPGE__": new Map<string, number>(),
    "__NRE__": new Map<string, number>(),
    "__OUTROS__": new Map<string, number>(),
  };

  for (const record of records) {
    const group = getRecordGroup(record);

    if (!group) continue;

    groupCounts[group] += 1;

    if (group === "__NRE__" && record.nreSigla) {
      groupSubfilterCounts.__NRE__.set(record.nreSigla, (groupSubfilterCounts.__NRE__.get(record.nreSigla) ?? 0) + 1);
    } else {
      groupSubfilterCounts[group].set(record.localLabel, (groupSubfilterCounts[group].get(record.localLabel) ?? 0) + 1);
    }
  }

  return {
    groupCounts,
    groupSubfilters: {
      "__UTGI__": mapCountsToOptions(groupSubfilterCounts.__UTGI__),
      "__SEAP__": mapCountsToOptions(groupSubfilterCounts.__SEAP__),
      "__DPGE__": mapCountsToOptions(groupSubfilterCounts.__DPGE__),
      "__NRE__": NRE_OPTIONS.filter((option) => groupSubfilterCounts.__NRE__.has(option.sigla)).map((option) => ({
        value: option.sigla,
        label: option.sigla,
        count: groupSubfilterCounts.__NRE__.get(option.sigla) ?? 0,
        description: option.nre,
      })),
      "__OUTROS__": mapCountsToOptions(groupSubfilterCounts.__OUTROS__),
    },
  };
}

function buildFilterButtonLabel(selected: string[], options: Map<string, string>, fallback: string) {
  if (selected.length === 0) return fallback;

  const labels = selected.map((item) => options.get(item) ?? item);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} selecionados`;
}

function HeaderPill({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 items-center rounded-2xl border border-white/[0.14] bg-white/[0.08] px-3 text-white shadow-sm backdrop-blur-md">
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "red" | "green";
}) {
  const glowClass = {
    blue: "kpi-glow-blue",
    amber: "kpi-glow-amber",
    red: "kpi-glow-red",
    green: "kpi-glow-green",
  }[tone];

  const iconClass = {
    blue: "bg-primary/[0.12] text-primary",
    amber: "bg-warning/[0.18] text-warning-foreground",
    red: "bg-destructive/[0.12] text-destructive",
    green: "bg-accent/[0.12] text-accent",
  }[tone];

  return (
    <div className={cn("glass-card-elevated rounded-3xl p-5 sm:p-6", glowClass)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <div className={cn("rounded-2xl p-2", iconClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-display font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}

const DashboardView = ({ data, onReset }: DashboardViewProps) => {
  const { isDark, setTheme, theme } = useThemePreference();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("diasAtraso");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedSectorFilters, setSelectedSectorFilters] = useState<string[]>([]);
  const [selectedGroupSubfilters, setSelectedGroupSubfilters] = useState<GroupSubfilterSelections>(
    createEmptyGroupSubfilterSelections,
  );
  const [isSectorPopoverOpen, setIsSectorPopoverOpen] = useState(false);

  const records = useMemo(() => data.map(enrichProcessRecord), [data]);

  const ativos = useMemo(() => records.filter((record) => !record.encerrado), [records]);
  const encerrados = useMemo(() => records.filter((record) => record.encerrado), [records]);
  const atrasados = useMemo(() => ativos.filter((record) => record.emAtraso), [ativos]);

  const percentAtraso = ativos.length > 0 ? (atrasados.length / ativos.length) * 100 : 0;
  const maiorAtraso = useMemo(() => Math.max(0, ...atrasados.map((record) => record.diasAtraso)), [atrasados]);
  const tableFilterCollections = useMemo(() => buildTableFilterCollections(atrasados), [atrasados]);

  const sectorOptions = useMemo(
    () =>
      GROUP_ORDER.filter((value) => tableFilterCollections.groupCounts[value] > 0).map((value) => ({
        value,
        label: GROUP_LABELS[value],
        count: tableFilterCollections.groupCounts[value],
      })),
    [tableFilterCollections],
  );
  const selectedGroupedSectors = useMemo(
    () => selectedSectorFilters.filter(isGroupFilterValue),
    [selectedSectorFilters],
  );

  useEffect(() => {
    const availableSectorValues = new Set(sectorOptions.map((option) => option.value));
    setSelectedSectorFilters((current) => {
      const next = current.filter((value) => availableSectorValues.has(value));
      return next.length === current.length ? current : next;
    });
  }, [sectorOptions]);

  useEffect(() => {
    const activeGroups = new Set(selectedGroupedSectors);
    setSelectedGroupSubfilters((current) => {
      let changed = false;
      const next = createEmptyGroupSubfilterSelections();

      for (const group of GROUP_ORDER) {
        if (!activeGroups.has(group)) {
          if (current[group].length > 0) changed = true;
          continue;
        }

        const availableValues = new Set(tableFilterCollections.groupSubfilters[group].map((option) => option.value));
        next[group] = current[group].filter((value) => availableValues.has(value));
        if (next[group].length !== current[group].length) changed = true;
      }

      return changed ? next : current;
    });
  }, [selectedGroupedSectors, tableFilterCollections]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedSectorFilters, selectedGroupSubfilters]);

  const topAssuntosData = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const record of ativos) {
      const assunto = record.palavraChave?.trim();
      if (!assunto || assunto === "null") continue;
      counts[assunto] = (counts[assunto] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }, [ativos]);

  const statusData = useMemo(
    () =>
      [
        { name: "Estoque ativo", value: ativos.length, fill: CHART_COLORS[0] },
        { name: "Encerrados", value: encerrados.length, fill: isDark ? CHART_COLORS[3] : CHART_COLORS[2] },
      ].filter((item) => item.value > 0),
    [ativos.length, encerrados.length, isDark],
  );

  const atrasoPorSetor = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const record of atrasados) {
      counts[record.localLabel] = (counts[record.localLabel] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  }, [atrasados]);

  const filteredAtrasados = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    let list = [...atrasados];

    if (selectedSectorFilters.length > 0) {
      list = list.filter((record) => {
        const recordGroup = getRecordGroup(record);
        const matchesGroupedSector = selectedGroupedSectors.some((group) => {
          if (recordGroup !== group) return false;

          const selectedValues = selectedGroupSubfilters[group];
          if (selectedValues.length === 0) return true;

          if (group === "__NRE__") {
            return Boolean(record.nreSigla && selectedValues.includes(record.nreSigla));
          }

          return selectedValues.includes(record.localLabel);
        });

        return matchesGroupedSector;
      });
    }

    if (normalizedSearch) {
      list = list.filter((record) =>
        [
          record.protocolo,
          record.tipoProcesso,
          record.interessado,
          record.palavraChave,
          record.localLabel,
          record.nreSigla,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch)),
      );
    }

    list.sort((left, right) => {
      let comparison = 0;

      switch (sortField) {
        case "diasAtraso":
          comparison = left.diasAtraso - right.diasAtraso;
          break;
        case "protocolo":
          comparison = left.protocolo.localeCompare(right.protocolo, "pt-BR");
          break;
        case "dataEnvio":
          comparison = getSortableTimestamp(left.dataEnvio) - getSortableTimestamp(right.dataEnvio);
          break;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    return list;
  }, [atrasados, search, selectedGroupedSectors, selectedGroupSubfilters, selectedSectorFilters.length, sortDir, sortField]);

  const totalPages = Math.ceil(filteredAtrasados.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (totalPages === 0 && page !== 1) {
      setPage(1);
      return;
    }

    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedData = filteredAtrasados.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const selectedSubfilterCount = useMemo(
    () => getSelectedSubfilterCount(selectedGroupSubfilters),
    [selectedGroupSubfilters],
  );
  const hasTableFilters = search.trim().length > 0 || selectedSectorFilters.length > 0 || selectedSubfilterCount > 0;
  const sectorLabelMap = useMemo(
    () => new Map(sectorOptions.map((option) => [option.value, option.label])),
    [sectorOptions],
  );
  const sectorFilterLabel = buildFilterButtonLabel(selectedSectorFilters, sectorLabelMap, "Todos os setores");

  const tooltipContentStyle = useMemo(
    () => ({
      background: isDark ? "rgba(18, 26, 38, 0.9)" : "rgba(255, 255, 255, 0.96)",
      backdropFilter: "blur(10px)",
      border: isDark ? "1px solid rgba(148, 163, 184, 0.12)" : "1px solid hsl(210, 18%, 87%)",
      borderRadius: "12px",
      boxShadow: isDark ? "0 12px 28px rgba(2, 8, 23, 0.18)" : "0 12px 30px rgba(15, 23, 42, 0.08)",
      color: isDark ? "rgba(241, 245, 249, 0.94)" : "rgba(15, 23, 42, 0.92)",
      fontSize: "12px",
    }),
    [isDark],
  );
  const tooltipLabelStyle = useMemo(
    () => ({
      color: isDark ? "rgba(226, 232, 240, 0.86)" : "rgba(15, 23, 42, 0.76)",
      fontWeight: 600,
      marginBottom: "4px",
    }),
    [isDark],
  );
  const tooltipItemStyle = useMemo(
    () => ({
      color: isDark ? "rgba(248, 250, 252, 0.94)" : "rgba(15, 23, 42, 0.92)",
      fontWeight: 500,
    }),
    [isDark],
  );

  const chartAxisColor = isDark ? "rgba(203, 213, 225, 0.72)" : "hsl(210, 10%, 46%)";
  const chartGridColor = isDark ? "rgba(148, 163, 184, 0.12)" : "hsl(210, 18%, 87%)";
  const chartHoverCursor = { fill: isDark ? "rgba(148, 163, 184, 0.06)" : "rgba(148, 163, 184, 0.1)" };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "diasAtraso" ? "desc" : "asc");
    }

    setPage(1);
  };

  const toggleSectorFilter = (value: string) => {
    setSelectedSectorFilters((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  };

  const toggleGroupSubfilter = (group: GroupFilterValue, value: string) => {
    setSelectedGroupSubfilters((current) => ({
      ...current,
      [group]: current[group].includes(value) ? current[group].filter((item) => item !== value) : [...current[group], value],
    }));
  };

  const clearTableFilters = () => {
    setSearch("");
    setSelectedSectorFilters([]);
    setSelectedGroupSubfilters(createEmptyGroupSubfilterSelections());
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />;
    }

    return sortDir === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-primary" />
    );
  };

  const SortableHead = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={cn("cursor-pointer select-none transition-colors hover:bg-muted/60", className)}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        <SortIcon field={field} />
      </span>
    </TableHead>
  );

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-texture" />

      <header className="pr-header sticky top-0 z-40 border-b border-white/10">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 gap-1.5 rounded-xl border border-white/10 bg-white/[0.08] px-3 text-white/[0.85] hover:bg-white/[0.14] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Upload</span>
            </Button>

            <div className="hidden h-6 w-px bg-white/15 sm:block" />

            <div className="flex items-center gap-3">
              <img src={logoSeed} alt="SEED" className="h-7 brightness-0 invert opacity-95" />
              <img src={logoUtgi} alt="UTGI" className="hidden h-6 brightness-0 invert opacity-90 md:block" />
              <div className="hidden md:block">
                <p className="font-display text-sm font-semibold text-white">Painel de Processos</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">SEED / UTGI</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HeaderPill>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-white/70" />
                <span className="font-medium text-white">{data.length.toLocaleString("pt-BR")} processos</span>
              </div>
            </HeaderPill>

            <HeaderPill>
              <div className="flex items-center gap-2.5">
                {isDark ? <MoonStar className="h-4 w-4 text-white" /> : <Sun className="h-4 w-4 text-white" />}
                <span className="hidden text-sm font-medium text-white sm:inline">
                  {theme === "dark" ? "Modo escuro" : "Modo claro"}
                </span>
                <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
              </div>
            </HeaderPill>
          </div>
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Processos carregados"
            value={records.length.toLocaleString("pt-BR")}
            helper="total de protocolos únicos"
            icon={BarChart3}
            tone="blue"
          />
          <StatCard
            label="Estoque ativo"
            value={ativos.length.toLocaleString("pt-BR")}
            helper="processos em tramitação"
            icon={Clock}
            tone="amber"
          />
          <StatCard
            label="Em atraso"
            value={atrasados.length.toLocaleString("pt-BR")}
            helper={`${percentAtraso.toFixed(1)}% do estoque ativo`}
            icon={AlertTriangle}
            tone="red"
          />
          <StatCard
            label="Maior atraso"
            value={maiorAtraso.toLocaleString("pt-BR")}
            helper="dias úteis acumulados"
            icon={TrendingUp}
            tone="green"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <div className="glass-card-elevated rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">Top 5 Assuntos</h2>
                <p className="mt-1 text-sm text-muted-foreground">Distribuição dos assuntos mais recorrentes da base carregada.</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                {ativos.length.toLocaleString("pt-BR")} ativos
              </Badge>
            </div>

            {topAssuntosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topAssuntosData} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridColor} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: chartAxisColor }} />
                  <YAxis type="category" dataKey="name" width={185} tick={{ fontSize: 11, fill: chartAxisColor }} />
                  <Tooltip
                    formatter={(value: number) => [value, "Processos"]}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    cursor={chartHoverCursor}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
                    {topAssuntosData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl bg-muted/[0.35] text-sm text-muted-foreground">
                Sem dados disponíveis.
              </div>
            )}
          </div>

          <div className="glass-card-elevated rounded-3xl p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="font-display text-base font-semibold text-foreground">Status Geral</h2>
              <p className="mt-1 text-sm text-muted-foreground">Comparativo entre estoque ativo e processos encerrados.</p>
            </div>

            {statusData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [value, "Processos"]}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-3 grid w-full gap-2">
                  {statusData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-2xl bg-muted/[0.35] px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{item.value.toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl bg-muted/[0.35] text-sm text-muted-foreground">
                Sem dados disponíveis.
              </div>
            )}
          </div>
        </div>

        {atrasoPorSetor.length > 0 && (
          <div className="glass-card-elevated rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">Atrasos por Setor</h2>
                <p className="mt-1 text-sm text-muted-foreground">Concentração dos protocolos em atraso por local atual.</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={atrasoPorSetor} margin={{ bottom: 54, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  tick={{ fontSize: 10, fill: chartAxisColor }}
                  height={72}
                />
                <YAxis tick={{ fontSize: 11, fill: chartAxisColor }} />
                <Tooltip
                  formatter={(value: number) => [value, "Em atraso"]}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={chartHoverCursor}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={30}>
                  {atrasoPorSetor.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="glass-card-elevated overflow-hidden rounded-3xl">
          <div className="border-b border-border/60 p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl bg-destructive/10 p-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <h2 className="font-display text-base font-semibold text-foreground">Protocolos em Atraso</h2>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {filteredAtrasados.length.toLocaleString("pt-BR")}
                </Badge>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Popover open={isSectorPopoverOpen} onOpenChange={setIsSectorPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 rounded-2xl border-border/70 bg-muted/[0.25] px-3 text-xs">
                        <Building2 className="mr-2 h-3.5 w-3.5" />
                        Setor: {sectorFilterLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(92vw,320px)] rounded-3xl border-border/70 bg-popover/[0.98] p-0 shadow-xl">
                      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Filtrar por Setor</p>
                          <p className="text-xs text-muted-foreground">Agrupamento principal da tabela de atrasos.</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSectorFilters([]);
                            setSelectedGroupSubfilters(createEmptyGroupSubfilterSelections());
                          }}
                          className="rounded-xl text-xs text-muted-foreground hover:text-foreground"
                          disabled={selectedSectorFilters.length === 0 && selectedSubfilterCount === 0}
                        >
                          Limpar
                        </Button>
                      </div>

                      <div className="max-h-80 space-y-1 overflow-y-auto p-2.5">
                        {sectorOptions.map((option) => {
                          const isChecked = selectedSectorFilters.includes(option.value);
                          const groupValue = isGroupFilterValue(option.value) ? option.value : null;
                          const nestedOptions = groupValue ? tableFilterCollections.groupSubfilters[groupValue] : [];
                          const hasNestedOptions = Boolean(groupValue && nestedOptions.length > 0);
                          const showNestedOptions = Boolean(groupValue && isChecked && nestedOptions.length > 0);

                          return (
                            <div key={option.value} className="space-y-1">
                              <button
                                onClick={() => toggleSectorFilter(option.value)}
                                aria-expanded={hasNestedOptions ? showNestedOptions : undefined}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                                  isChecked ? "bg-primary/10 text-primary" : "hover:bg-muted/70",
                                )}
                              >
                                <span
                                  aria-hidden
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                                    isChecked
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-primary/40 bg-background text-transparent",
                                  )}
                                >
                                  {isChecked && <Check className="h-3 w-3" />}
                                </span>
                                <span className="flex-1 truncate text-sm font-medium">{option.label}</span>
                                {hasNestedOptions ? (
                                  <ChevronDown
                                    style={{ transitionTimingFunction: SUBFILTER_EASING }}
                                    className={cn(
                                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none",
                                      showNestedOptions ? "rotate-180 text-primary" : "rotate-0",
                                    )}
                                  />
                                ) : null}
                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                                  {option.count}
                                </Badge>
                              </button>

                              {groupValue && hasNestedOptions ? (
                                <div
                                  style={{ transitionTimingFunction: SUBFILTER_EASING }}
                                  className={cn(
                                    "grid transition-[grid-template-rows,opacity,margin] duration-300 motion-reduce:transition-none",
                                    showNestedOptions ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                                  )}
                                >
                                  <div className="min-h-0 overflow-hidden">
                                    <div
                                      style={{ transitionTimingFunction: SUBFILTER_EASING }}
                                      className={cn(
                                        "ml-7 space-y-1 border-l border-border/60 pl-3 transition-[transform,opacity] duration-300 motion-reduce:transition-none",
                                        showNestedOptions ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
                                      )}
                                    >
                                      {nestedOptions.map((nestedOption) => {
                                        const isNestedChecked = selectedGroupSubfilters[groupValue].includes(nestedOption.value);

                                        return (
                                          <button
                                            key={`${groupValue}-${nestedOption.value}`}
                                            onClick={() => toggleGroupSubfilter(groupValue, nestedOption.value)}
                                            className={cn(
                                              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                                              isNestedChecked ? "bg-primary/10 text-primary" : "hover:bg-muted/70",
                                            )}
                                          >
                                            <span
                                              aria-hidden
                                              className={cn(
                                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                                                isNestedChecked
                                                  ? "border-primary bg-primary text-primary-foreground"
                                                  : "border-primary/40 bg-background text-transparent",
                                              )}
                                            >
                                              {isNestedChecked && <Check className="h-3 w-3" />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-2">
                                                <span className="truncate text-sm font-medium">{nestedOption.label}</span>
                                                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                                                  {nestedOption.count}
                                                </Badge>
                                              </div>
                                              {nestedOption.description ? (
                                                <p className="truncate text-xs text-muted-foreground">{nestedOption.description}</p>
                                              ) : null}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTableFilters}
                    className="h-10 rounded-2xl px-3 text-xs text-primary hover:bg-primary/10"
                    disabled={!hasTableFilters}
                  >
                    Limpar filtros
                    <X className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="relative w-full xl:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar protocolo, assunto, interessado..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-10 rounded-2xl border-border/70 bg-muted/[0.35] pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredAtrasados.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/[0.45]">
                  {hasTableFilters ? <Search className="h-6 w-6 text-muted-foreground" /> : <AlertTriangle className="h-6 w-6 text-primary" />}
                </div>
                <p className="font-medium text-foreground">
                  {hasTableFilters ? "Nenhum resultado encontrado" : "Nenhum protocolo em atraso"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasTableFilters ? "Ajuste a pesquisa ou limpe os filtros da tabela." : "Todos os processos estão em dia."}
                </p>
              </div>
            ) : (
              <Table className="table-fixed min-w-[900px] w-full">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <SortableHead field="protocolo" className="w-[150px] min-w-[150px] px-3">
                      Protocolo
                    </SortableHead>
                    <SortableHead field="dataEnvio" className="w-[170px] min-w-[170px] px-3 text-center">
                      Último Envio
                    </SortableHead>
                    <SortableHead field="diasAtraso" className="w-[110px] min-w-[110px] px-3 text-center">
                      Atraso
                    </SortableHead>
                    <TableHead className="w-[180px] min-w-[180px] px-4 text-center">Setor</TableHead>
                    <TableHead className="w-[370px] min-w-[370px] px-4">Interessado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((record, index) => (
                    <TableRow key={`${record.protocolo}-${index}`} className="transition-colors hover:bg-muted/30">
                      <TableCell className="w-[150px] min-w-[150px] px-3 py-3 font-mono text-sm">
                        <a
                          href={buildProtocolUrl(record.protocolo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
                        >
                          {record.protocolo}
                        </a>
                      </TableCell>
                      <TableCell className="w-[170px] min-w-[170px] px-3 py-3 text-center text-sm text-muted-foreground">
                        {record.dataEnvio || "—"}
                      </TableCell>
                      <TableCell className="w-[110px] min-w-[110px] px-3 py-3 text-center">
                        <Badge className={cn("border text-xs font-bold", getSeverity(record.diasAtraso))}>
                          {record.diasAtraso} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[180px] min-w-[180px] truncate px-4 py-3 text-center text-sm text-muted-foreground">
                        {record.localLabel}
                      </TableCell>
                      <TableCell className="w-[370px] min-w-[370px] px-4 py-3 text-sm leading-5 text-muted-foreground">
                        {formatInteressado(record.interessado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * ITEMS_PER_PAGE) + 1}
                {"–"}
                {Math.min(page * ITEMS_PER_PAGE, filteredAtrasados.length)} de {filteredAtrasados.length} protocolos em atraso
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="h-9 rounded-xl px-3 text-xs"
                >
                  Anterior
                </Button>

                {getPageNumbers(page, totalPages).map((item, index) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant={page === item ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPage(item)}
                      className="h-9 w-9 rounded-xl p-0 text-xs"
                    >
                      {item}
                    </Button>
                  ),
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="h-9 rounded-xl px-3 text-xs"
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardView;
