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
};

export async function fetchLiveKitConnectionDetails(
  options: LiveKitConnectionOptions = {}
): Promise<ConnectionDetails> {
  const endpoint =
    process.env.NEXT_PUBLIC_LIVEKIT_CONNECTION_ENDPOINT ?? '/api/livekit/connection-details';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: options.roomName,
      participantName: options.participantName,
      assistantId: options.assistantId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiveKit connection failed: ${res.status} ${text}`);
  }

  return res.json();
}

