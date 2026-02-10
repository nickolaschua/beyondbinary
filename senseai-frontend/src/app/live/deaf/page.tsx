import { LiveWorkspace } from "@/components/LiveWorkspace";
import { API_URL, WS_URL } from "@/lib/constants";

export default async function LiveDeafPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const apiUrl = typeof params.api === "string" ? params.api : API_URL;
  const ws = typeof params.ws === "string" ? params.ws : WS_URL;
  const key = typeof params.key === "string" ? params.key : "";
  const sid = typeof params.sid === "string" ? params.sid : "session-local";

  return <LiveWorkspace profileId="deaf" apiUrl={apiUrl} wsUrl={ws} apiKey={key} sessionId={sid} />;
}
