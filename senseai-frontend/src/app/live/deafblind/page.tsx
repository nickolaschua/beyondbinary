import { LiveWorkspace } from "@/components/LiveWorkspace";
import { API_URL, WS_URL } from "@/lib/constants";

export default async function LiveDeafblindPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const apiUrl = typeof params.api === "string" ? params.api : API_URL;
  const ws = typeof params.ws === "string" ? params.ws : WS_URL;
  const key = typeof params.key === "string" ? params.key : "";
  // Support both 'room' and 'sid' params for room ID (room takes precedence)
  const roomId = typeof params.room === "string" ? params.room : (typeof params.sid === "string" ? params.sid : "session-local");

  return <LiveWorkspace profileId="deafblind" apiUrl={apiUrl} wsUrl={ws} apiKey={key} sessionId={roomId} />;
}
