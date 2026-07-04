// Cliente para a Z-API (https://developer.z-api.io). Endpoints e formatos
// confirmados na documentação oficial:
// - status: GET /instances/{id}/token/{token}/status, header Client-Token
// - send-text: POST /instances/{id}/token/{token}/send-text, header
//   Client-Token, body { phone, message }, resposta { messageId }

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
