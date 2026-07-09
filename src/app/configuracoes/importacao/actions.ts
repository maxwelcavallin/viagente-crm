"use server";

import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { csvImports } from "@/db/schema";
import {
  importCsvBatch,
  type ColumnMapping,
  type DestinationConfig,
  type ImportBatchResult,
} from "@/lib/csv-import";

async function requireAdminUserId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session.user.id;
}

export async function importCsvBatchAction(params: {
  headers: string[];
  rows: string[][];
  startRowNumber: number;
  mapping: ColumnMapping;
  destination: DestinationConfig;
}): Promise<ImportBatchResult> {
  const userId = await requireAdminUserId();
  if (!userId) {
    return {
      contactsCreated: 0,
      contactsUpdated: 0,
      dealsCreated: 0,
      errors: [{ row: 0, message: "Acesso negado." }],
    };
  }
  return importCsvBatch(params);
}

export type SaveImportLogState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; id: string };

export async function saveImportLogAction(params: {
  fileName: string;
  pipelineId: string | null;
  contactsCreated: number;
  contactsUpdated: number;
  dealsCreated: number;
  errors: { row: number; message: string }[];
}): Promise<SaveImportLogState> {
  const userId = await requireAdminUserId();
  if (!userId) return { status: "error", message: "Acesso negado." };

  const [created] = await db
    .insert(csvImports)
    .values({
      fileName: params.fileName,
      createdBy: userId,
      pipelineId: params.pipelineId,
      contactsCreated: params.contactsCreated,
      contactsUpdated: params.contactsUpdated,
      dealsCreated: params.dealsCreated,
      errorCount: params.errors.length,
      errors: params.errors,
    })
    .returning({ id: csvImports.id });

  return { status: "success", id: created.id };
}

export async function getRecentImportLogs() {
  return db
    .select()
    .from(csvImports)
    .orderBy(desc(csvImports.createdAt))
    .limit(10);
}
