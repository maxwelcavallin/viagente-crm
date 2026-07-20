"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCsv } from "@/lib/csv-parse";
import {
  previewCsvRows,
  STAGE_COLUMN_KEY,
  type ColumnMapping,
  type DestinationConfig,
  type ImportPreviewRow,
} from "@/lib/csv-import-resolve";
import { CONTACT_SYSTEM_FIELDS, DEAL_SYSTEM_FIELDS } from "@/lib/webhook-fields";
import type { FieldDef } from "@/lib/custom-fields";
import { importCsvBatchAction, saveImportLogAction } from "./actions";

type Step = "upload" | "mapping" | "destination" | "preview" | "running" | "report";

type Pipeline = { id: string; name: string };
type Stage = { id: string; name: string; pipelineId: string; order: number };

const BATCH_SIZE = 25;
const IGNORE_VALUE = "__ignore__";

function buildMappingOptions(contactFieldDefs: FieldDef[], dealFieldDefs: FieldDef[]) {
  return [
    { key: IGNORE_VALUE, label: "Não mapear (ignorar coluna)" },
    ...CONTACT_SYSTEM_FIELDS,
    ...DEAL_SYSTEM_FIELDS,
    { key: STAGE_COLUMN_KEY, label: "Etapa/Funil na Clint (pra rotear por coluna)" },
    ...contactFieldDefs.map((f) => ({
      key: `contact.custom.${f.key}`,
      label: `${f.label} (campo de contato)`,
    })),
    ...dealFieldDefs.map((f) => ({
      key: `deal.custom.${f.key}`,
      label: `${f.label} (campo de negócio)`,
    })),
  ];
}

export function ImportWizard({
  pipelines,
  stages,
  contactFieldDefs,
  dealFieldDefs,
}: {
  pipelines: Pipeline[];
  stages: Stage[];
  contactFieldDefs: FieldDef[];
  dealFieldDefs: FieldDef[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [destMode, setDestMode] = useState<"fixed" | "by_column">("fixed");
  const [fixedPipelineId, setFixedPipelineId] = useState("");
  const [fixedStageId, setFixedStageId] = useState("");
  const [byColumnPipelineId, setByColumnPipelineId] = useState("");
  const [stageMap, setStageMap] = useState<Record<string, string>>({});

  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [report, setReport] = useState<{
    contactsCreated: number;
    contactsUpdated: number;
    dealsCreated: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const mappingOptions = useMemo(
    () => buildMappingOptions(contactFieldDefs, dealFieldDefs),
    [contactFieldDefs, dealFieldDefs]
  );
  const stageLabelById = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);

  const stagesForFixedPipeline = useMemo(
    () => stages.filter((s) => s.pipelineId === fixedPipelineId).sort((a, b) => a.order - b.order),
    [stages, fixedPipelineId]
  );
  const stagesForByColumnPipeline = useMemo(
    () => stages.filter((s) => s.pipelineId === byColumnPipelineId).sort((a, b) => a.order - b.order),
    [stages, byColumnPipelineId]
  );

  const stageColumnName = useMemo(
    () => Object.entries(mapping).find(([, target]) => target === STAGE_COLUMN_KEY)?.[0] ?? null,
    [mapping]
  );
  const uniqueStageValues = useMemo(() => {
    if (!stageColumnName) return [];
    const index = headers.indexOf(stageColumnName);
    if (index === -1) return [];
    const set = new Set<string>();
    for (const row of rows) {
      const value = (row[index] ?? "").trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort();
  }, [headers, rows, stageColumnName]);

  const phoneOrEmailMapped =
    Object.values(mapping).includes("contact.phone") ||
    Object.values(mapping).includes("contact.email");
  const ignoredColumns = headers.filter((h) => !mapping[h]);

  function resetAll() {
    setStep("upload");
    setFileName("");
    setFileRef(null);
    setHeaders([]);
    setRows([]);
    setUploadError(null);
    setMapping({});
    setDestMode("fixed");
    setFixedPipelineId("");
    setFixedStageId("");
    setByColumnPipelineId("");
    setStageMap({});
    setProgress({ processed: 0, total: 0 });
    setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function loadFile(file: File, encoding?: string) {
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setUploadError("Não foi possível ler nenhuma coluna neste arquivo.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setFileName(file.name);
      setFileRef(file);
    };
    reader.onerror = () => setUploadError("Falha ao ler o arquivo.");
    if (encoding) reader.readAsText(file, encoding);
    else reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }

  function setColumnTarget(column: string, target: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (target === IGNORE_VALUE) delete next[column];
      else next[column] = target;
      return next;
    });
  }

  function destinationConfig(): DestinationConfig | null {
    if (destMode === "fixed") {
      if (!fixedPipelineId || !fixedStageId) return null;
      return { mode: "fixed", pipelineId: fixedPipelineId, stageId: fixedStageId };
    }
    if (!byColumnPipelineId || !stageColumnName) return null;
    return {
      mode: "by_column",
      pipelineId: byColumnPipelineId,
      stageColumn: stageColumnName,
      stageMap,
    };
  }

  const destination = destinationConfig();

  const previewRows: ImportPreviewRow[] = useMemo(() => {
    if (!destination) return [];
    return previewCsvRows(headers, rows.slice(0, 10), mapping, destination, stageLabelById);
  }, [headers, rows, mapping, destination, stageLabelById]);

  async function runImport() {
    if (!destination) return;
    setStep("running");
    setProgress({ processed: 0, total: rows.length });

    let contactsCreated = 0;
    let contactsUpdated = 0;
    let dealsCreated = 0;
    const errors: { row: number; message: string }[] = [];

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);
      const result = await importCsvBatchAction({
        headers,
        rows: batch,
        startRowNumber: start + 1,
        mapping,
        destination,
      });
      contactsCreated += result.contactsCreated;
      contactsUpdated += result.contactsUpdated;
      dealsCreated += result.dealsCreated;
      errors.push(...result.errors);
      setProgress({ processed: Math.min(start + batch.length, rows.length), total: rows.length });
    }

    const finalReport = { contactsCreated, contactsUpdated, dealsCreated, errors };
    setReport(finalReport);

    // Os contatos/negócios já foram criados nos batches acima — mesmo que
    // salvar o log de auditoria falhe (ex: sessão expirada), o relatório
    // real precisa aparecer pro admin em vez de travar em "Importando...".
    try {
      await saveImportLogAction({
        fileName,
        pipelineId: destMode === "fixed" ? fixedPipelineId : byColumnPipelineId,
        ...finalReport,
      });
    } catch (e) {
      console.error("Falha ao salvar o log de auditoria da importação", e);
    }

    setStep("report");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar contatos e negócios (CSV)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
          <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-status-warning" />
          <p>
            Negócios são sempre criados novos por linha — <strong>não rode o mesmo arquivo duas vezes</strong>{" "}
            sem necessidade, ou os negócios ficam duplicados. Contatos com telefone já existente são
            atualizados, não duplicados.
          </p>
        </div>

        {step === "upload" && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={handleFileChange}
            />
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} strokeWidth={1.75} />
              Selecionar arquivo CSV
            </Button>
            {fileName && (
              <div className="space-y-1 text-sm">
                <p>
                  <strong>{fileName}</strong> — {rows.length} linha(s), {headers.length} coluna(s)
                </p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => fileRef && loadFile(fileRef, "windows-1252")}
                >
                  Acentuação saiu errada? Tentar reler como Windows-1252 (Excel)
                </button>
              </div>
            )}
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            <div>
              <Button type="button" disabled={headers.length === 0} onClick={() => setStep("mapping")}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha pra qual campo do CRM cada coluna do CSV vai. Colunas não mapeadas são ignoradas.
            </p>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {headers.map((column) => (
                <div
                  key={column}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_1fr]"
                >
                  <span className="truncate text-sm font-medium" title={column}>
                    {column}
                  </span>
                  <Select
                    items={Object.fromEntries(mappingOptions.map((o) => [o.key, o.label]))}
                    value={mapping[column] ?? IGNORE_VALUE}
                    onValueChange={(v) => setColumnTarget(column, v ?? IGNORE_VALUE)}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingOptions.map((o) => (
                        <SelectItem key={o.key} value={o.key}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {!phoneOrEmailMapped && (
              <p className="text-sm text-destructive">
                Mapeie uma coluna pra &quot;Telefone do contato&quot; e/ou &quot;Email do contato&quot; — pelo
                menos um dos dois é obrigatório pra identificar/criar o contato.
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button type="button" disabled={!phoneOrEmailMapped} onClick={() => setStep("destination")}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "destination" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={destMode === "fixed" ? "default" : "outline"}
                onClick={() => setDestMode("fixed")}
              >
                Destino único
              </Button>
              <Button
                type="button"
                variant={destMode === "by_column" ? "default" : "outline"}
                onClick={() => setDestMode("by_column")}
              >
                Destino por coluna
              </Button>
            </div>

            {destMode === "fixed" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
                  <Select
                    items={Object.fromEntries(pipelines.map((p) => [p.id, p.name]))}
                    value={fixedPipelineId || null}
                    onValueChange={(v) => {
                      setFixedPipelineId(v ?? "");
                      setFixedStageId("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Etapa</p>
                  <Select
                    items={Object.fromEntries(stagesForFixedPipeline.map((s) => [s.id, s.name]))}
                    value={fixedStageId || null}
                    onValueChange={(v) => setFixedStageId(v ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stagesForFixedPipeline.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : !stageColumnName ? (
              <p className="text-sm text-destructive">
                Volte na etapa de mapeamento e mapeie uma coluna pra &quot;Etapa/Funil na Clint&quot; pra usar
                destino por coluna.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Pipeline de destino</p>
                  <Select
                    items={Object.fromEntries(pipelines.map((p) => [p.id, p.name]))}
                    value={byColumnPipelineId || null}
                    onValueChange={(v) => {
                      setByColumnPipelineId(v ?? "");
                      setStageMap({});
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {byColumnPipelineId && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      De-para: etapa na coluna &quot;{stageColumnName}&quot; → etapa no CRM
                    </p>
                    {uniqueStageValues.map((rawValue) => (
                      <div
                        key={rawValue}
                        className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_1fr]"
                      >
                        <span className="truncate text-sm font-medium" title={rawValue}>
                          {rawValue}
                        </span>
                        <Select
                          items={Object.fromEntries(stagesForByColumnPipeline.map((s) => [s.id, s.name]))}
                          value={stageMap[rawValue] ?? null}
                          onValueChange={(v) =>
                            setStageMap((prev) => {
                              const next = { ...prev };
                              if (v) next[rawValue] = v;
                              else delete next[rawValue];
                              return next;
                            })
                          }
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue placeholder="Sem correspondência (vira erro)" />
                          </SelectTrigger>
                          <SelectContent>
                            {stagesForByColumnPipeline.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("mapping")}>
                Voltar
              </Button>
              <Button type="button" disabled={!destination} onClick={() => setStep("preview")}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {ignoredColumns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Colunas ignoradas: {ignoredColumns.join(", ")}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Prévia das primeiras {previewRows.length} de {rows.length} linha(s):
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone/Email</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.row}>
                    <TableCell>{row.row}</TableCell>
                    <TableCell>{row.contactName}</TableCell>
                    <TableCell>{row.contactPhone ?? row.contactEmail ?? "—"}</TableCell>
                    <TableCell>{row.dealTitle}</TableCell>
                    <TableCell>{row.stageLabel}</TableCell>
                    <TableCell>
                      {row.error ? (
                        <Badge variant="danger">{row.error}</Badge>
                      ) : (
                        <Badge variant="success">
                          <CheckCircle2 size={11} strokeWidth={1.75} />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("destination")}>
                Voltar
              </Button>
              <Button type="button" onClick={runImport}>
                Confirmar importação ({rows.length} linha(s))
              </Button>
            </div>
          </div>
        )}

        {step === "running" && (
          <div className="space-y-3">
            <p className="text-sm">
              Importando... {progress.processed} de {progress.total} linha(s)
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {step === "report" && report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Contatos criados
                </p>
                <p className="text-xl font-bold">{report.contactsCreated}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Contatos atualizados
                </p>
                <p className="text-xl font-bold">{report.contactsUpdated}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Negócios criados
                </p>
                <p className="text-xl font-bold">{report.dealsCreated}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  Erros
                </p>
                <p className="text-xl font-bold text-destructive">{report.errors.length}</p>
              </div>
            </div>
            {report.errors.length > 0 && (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {report.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    Linha {err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
            <Button type="button" onClick={resetAll}>
              Nova importação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
