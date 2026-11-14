export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export type LiveKitConnectionOptions = {
  assistantId?: string;
  roomName?: string;
  participantName?: string;
  /** Embed/first-party session token (`X-Sts-Session`). Required by the endpoint. */
  sessionToken?: string;
};

export async function fetchLiveKitConnectionDetails(
  options: LiveKitConnectionOptions = {}
): Promise<ConnectionDetails> {
  const endpoint =
    process.env.NEXT_PUBLIC_LIVEKIT_CONNECTION_ENDPOINT ?? '/api/livekit/connection-details';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.sessionToken ? { 'X-Sts-Session': options.sessionToken } : {}),
    },
    body: JSON.stringify({
      roomName: options.roomName,
      participantName: options.participantName,
      assistantId: options.assistantId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // Surface the server's own message (e.g. "Add your Deepgram API key…") instead of raw JSON.
    let message = `LiveKit connection failed: ${res.status} ${text}`;
    try {
      const body = JSON.parse(text) as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) message = body.error;
    } catch {
      // non-JSON body: keep the raw text
    }
    throw new Error(message);
  }

  return res.json();
}

