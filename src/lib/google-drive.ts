// Leitura de conteúdo do Drive (Etapa 31 — notas do Gemini). Docs nativos
// do Google (mimeType application/vnd.google-apps.document) não suportam
// `alt=media`, só `export` com um mimeType de destino — por isso não dá
// pra reaproveitar um helper genérico de download de arquivo.
export async function fetchDriveFileText(accessToken: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[google-drive] falha ao exportar arquivo", fileId, res.status, text);
    throw new Error(`GOOGLE_DRIVE_ERROR: ${res.status}`);
  }
  return res.text();
}
