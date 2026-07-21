// Espelha upload-media-client.ts (fluxo de 2 passos: pede URL assinada, manda
// o arquivo direto pro R2), mas mais simples — sem passo de "finalizar
// envio", quem chama grava a referência no banco depois (ver
// updateAvatarAction em src/app/perfil/actions.ts).
export async function uploadAvatarFile(file: File): Promise<void> {
  const uploadRes = await fetch("/api/avatars/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type }),
  });
  if (!uploadRes.ok) {
    const data = await uploadRes.json().catch(() => ({}));
    throw new Error(data.error ?? "Falha ao preparar upload da foto.");
  }
  const { uploadUrl } = (await uploadRes.json()) as { uploadUrl: string };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Falha ao enviar a foto.");
  }
}
