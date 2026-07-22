"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateUserAction, type UpdateUserState } from "./actions";

const idleState: UpdateUserState = { status: "idle" };

const NO_DEFAULT_PIPELINE = "none";

type PipelineRow = { id: string; name: string; visible: boolean };

function buildInitialPipelineRows(
  allPipelines: { id: string; name: string }[],
  settings: { pipelineId: string; visible: boolean; order: number }[]
): PipelineRow[] {
  const byId = new Map(settings.map((s) => [s.pipelineId, s]));
  return allPipelines
    .map((p, index) => ({
      id: p.id,
      name: p.name,
      visible: byId.get(p.id)?.visible ?? true,
      sortOrder: byId.get(p.id)?.order ?? index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, name, visible }) => ({ id, name, visible }));
}

// Lista de pipelines visíveis + ordem, editada localmente (só grava no
// "Salvar" do form, junto do resto — sem auto-save por linha, diferente de
// configuracoes/campos/fields-list.tsx). Mover pra cima/baixo em vez de
// arraste: lista curta (poucas pipelines), menos código pra manter dentro
// de um modal que já tem bastante coisa.
function PipelinesSection({
  rows,
  onChange,
  defaultPipelineId,
  onDefaultPipelineChange,
  idPrefix,
}: {
  rows: PipelineRow[];
  onChange: (rows: PipelineRow[]) => void;
  defaultPipelineId: string;
  onDefaultPipelineChange: (id: string) => void;
  idPrefix: string;
}) {
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function toggleVisible(id: string, visible: boolean) {
    const next = rows.map((r) => (r.id === id ? { ...r, visible } : r));
    onChange(next);
    // Pipeline padrão só pode ser uma visível — se acabou de esconder a que
    // estava selecionada, volta pra "nenhuma".
    if (!visible && defaultPipelineId === id) {
      onDefaultPipelineChange(NO_DEFAULT_PIPELINE);
    }
  }

  const visibleRows = rows.filter((r) => r.visible);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-default-pipeline`}>Pipeline padrão</Label>
        <input type="hidden" name="defaultPipelineId" value={defaultPipelineId} />
        <Select
          value={defaultPipelineId}
          onValueChange={(v) => onDefaultPipelineChange(v ?? NO_DEFAULT_PIPELINE)}
          items={{
            [NO_DEFAULT_PIPELINE]: "Nenhuma (usa a primeira visível)",
            ...Object.fromEntries(visibleRows.map((r) => [r.id, r.name])),
          }}
        >
          <SelectTrigger id={`${idPrefix}-default-pipeline`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT_PIPELINE}>
              Nenhuma (usa a primeira visível)
            </SelectItem>
            {visibleRows.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Pipelines visíveis e ordem</Label>
        <input
          type="hidden"
          name="pipelineSettings"
          value={JSON.stringify(rows.map((r) => ({ id: r.id, visible: r.visible })))}
        />
        <div className="space-y-1.5">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="flex items-center gap-2 rounded-md border border-border p-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Mover pra cima"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp size={14} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Mover pra baixo"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown size={14} strokeWidth={1.75} />
                </button>
              </div>
              <span className="flex-1 truncate text-sm">{row.name}</span>
              <Switch
                size="sm"
                checked={row.visible}
                onCheckedChange={(checked) => toggleVisible(row.id, checked)}
                aria-label={`Mostrar pipeline ${row.name}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditUserDialog({
  user,
  allPipelines,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "atendente";
    restrictToOwnRecords: boolean;
    defaultPipelineId: string | null;
    pipelineSettings: { pipelineId: string; visible: boolean; order: number }[];
  };
  allPipelines: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "atendente">(user.role);
  const [restrictToOwnRecords, setRestrictToOwnRecords] = useState(
    user.restrictToOwnRecords
  );
  const [pipelineRows, setPipelineRows] = useState<PipelineRow[]>(() =>
    buildInitialPipelineRows(allPipelines, user.pipelineSettings)
  );
  const [defaultPipelineId, setDefaultPipelineId] = useState(
    user.defaultPipelineId ?? NO_DEFAULT_PIPELINE
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await updateUserAction(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRole(user.role);
          setRestrictToOwnRecords(user.restrictToOwnRecords);
          setPipelineRows(buildInitialPipelineRows(allPipelines, user.pipelineSettings));
          setDefaultPipelineId(user.defaultPipelineId ?? NO_DEFAULT_PIPELINE);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {user.name}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <input type="hidden" name="id" value={user.id} />
          <div className="space-y-2">
            <Label htmlFor={`edit-name-${user.id}`}>Nome</Label>
            <Input id={`edit-name-${user.id}`} name="name" defaultValue={user.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
            <Input
              id={`edit-email-${user.id}`}
              name="email"
              type="email"
              defaultValue={user.email}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-role-${user.id}`}>Role</Label>
            <input type="hidden" name="role" value={role} />
            <Select
              value={role}
              onValueChange={(v) => setRole((v as "admin" | "atendente") ?? "atendente")}
              items={{ atendente: "Atendente", admin: "Admin" }}
            >
              <SelectTrigger id={`edit-role-${user.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atendente">Atendente</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`edit-restrict-${user.id}`}>
                Restringir aos próprios negócios/atendimentos
              </Label>
              <p className="text-xs text-muted-foreground">
                Se ligado, esse usuário só vê negócios e atendimentos dele mesmo ou sem
                dono — nunca os de outros atendentes.
              </p>
            </div>
            <input
              type="hidden"
              name="restrictToOwnRecords"
              value={String(restrictToOwnRecords)}
            />
            <Switch
              id={`edit-restrict-${user.id}`}
              checked={restrictToOwnRecords}
              onCheckedChange={setRestrictToOwnRecords}
            />
          </div>

          {allPipelines.length > 0 && (
            <PipelinesSection
              rows={pipelineRows}
              onChange={setPipelineRows}
              defaultPipelineId={defaultPipelineId}
              onDefaultPipelineChange={setDefaultPipelineId}
              idPrefix={`edit-${user.id}`}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
