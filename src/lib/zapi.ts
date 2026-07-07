// Cliente para a Z-API (https://developer.z-api.io). Endpoints e formatos
// confirmados na documentação oficial:
// - status: GET /instances/{id}/token/{token}/status, header Client-Token
// - send-text: POST /instances/{id}/token/{token}/send-text, header
//   Client-Token, body { phone, message }, resposta { messageId }
// - send-image/send-video/send-audio/send-document/{extension}: mesmo
//   header, body { phone, image|video|audio|document (URL ou base64),
//   caption?, fileName? }, resposta { zaapId, messageId, id } — usamos
//   sempre URL (assinada de curta duração do R2), nunca base64, pra evitar
//   o limite de payload das serverless functions com áudio/vídeo grandes.

export type ZapiChannelCredentials = {
  zapiInstanceId: string;
  zapiToken: string;
  zapiClientToken: string;
};

function baseUrl(creds: ZapiChannelCredentials) {
  return `https://api.z-api.io/instances/${creds.zapiInstanceId}/token/${creds.zapiToken}`;
}

export type ZapiStatus = {
  connected: boolean;
  error?: string;
  smartphoneConnected?: boolean;
};

export async function checkZapiStatus(
  creds: ZapiChannelCredentials
): Promise<ZapiStatus> {
  const res = await fetch(`${baseUrl(creds)}/status`, {
    headers: { "Client-Token": creds.zapiClientToken },
    cache: "no-store",
  });

  if (!res.ok) {
    return { connected: false, error: `Z-API respondeu ${res.status}` };
  }

  const data = (await res.json()) as {
    connected?: boolean;
    error?: string;
    smartphoneConnected?: boolean;
  };

  return {
    connected: Boolean(data.connected),
    error: data.error,
    smartphoneConnected: data.smartphoneConnected,
  };
}

export async function sendZapiText(
  creds: ZapiChannelCredentials,
  phone: string,
  message: string
): Promise<{ messageId: string }> {
  const res = await fetch(`${baseUrl(creds)}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": creds.zapiClientToken,
    },
    body: JSON.stringify({ phone, message }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Falha ao enviar mensagem via Z-API (status ${res.status}): ${text}`
    );
  }

  const data = (await res.json()) as { messageId?: string };
  if (!data.messageId) {
    throw new Error("Z-API não retornou messageId na resposta de envio");
  }

  return { messageId: data.messageId };
}

async function postZapiMedia(
  creds: ZapiChannelCredentials,
  path: string,
  body: Record<string, unknown>
): Promise<{ messageId: string }> {
  const res = await fetch(`${baseUrl(creds)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": creds.zapiClientToken,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Falha ao enviar mídia via Z-API (status ${res.status}): ${text}`
    );
  }

  const data = (await res.json()) as { messageId?: string };
  if (!data.messageId) {
    throw new Error("Z-API não retornou messageId na resposta de envio");
  }

  return { messageId: data.messageId };
}

export function sendZapiImage(
  creds: ZapiChannelCredentials,
  phone: string,
  imageUrl: string,
  caption?: string
) {
  return postZapiMedia(creds, "/send-image", { phone, image: imageUrl, caption });
}

export function sendZapiVideo(
  creds: ZapiChannelCredentials,
  phone: string,
  videoUrl: string,
  caption?: string
) {
  return postZapiMedia(creds, "/send-video", { phone, video: videoUrl, caption });
}

// waveform=true: exibe como nota de voz (PTT) com onda sonora, no lugar de
// um arquivo de áudio comum — é o formato usado pelo gravador do composer.
export function sendZapiAudio(
  creds: ZapiChannelCredentials,
  phone: string,
  audioUrl: string,
  waveform = true
) {
  return postZapiMedia(creds, "/send-audio", { phone, audio: audioUrl, waveform });
}

export function sendZapiDocument(
  creds: ZapiChannelCredentials,
  phone: string,
  documentUrl: string,
  extension: string,
  fileName?: string
) {
  return postZapiMedia(creds, `/send-document/${extension}`, {
    phone,
    document: documentUrl,
    fileName,
  });
}
