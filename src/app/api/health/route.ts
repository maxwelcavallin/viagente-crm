import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ok", db: "connected" });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        db: "disconnected",
        message: error instanceof Error ? error.message : "erro desconhecido",
      },
      { status: 500 }
    );
  }
}
