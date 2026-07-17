// Sobe um anexo de email direto pro R2 (mesmo raciocínio de
// uploadAndSendMedia: URL assinada de PUT, arquivo não passa pela
// serverless function) — retorna só {filename, key}; o envio de verdade
// (com todos os anexos juntos) é feito depois por /api/emails/send.
export async function uploadEmailAttachment(
  file: File
): Promise<{ filename: string; key: string }> {
  const contentType = file.type || "application/octet-stream";
  const uploadRes = await fetch("/api/emails/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType }),
  });
  if (!uploadRes.ok) {
    const data = await uploadRes.json().catch(() => ({}));
    throw new Error(data.error ?? "Falha ao preparar upload do anexo.");
  }
  const { key, uploadUrl } = (await uploadRes.json()) as { key: string; uploadUrl: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Falha ao enviar o anexo.");
  }

  return { filename: file.name, key };
}
