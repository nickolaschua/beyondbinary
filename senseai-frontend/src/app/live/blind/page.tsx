import { LiveWorkspace } from "@/components/LiveWorkspace";

export default async function LiveBlindPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ws = typeof params.ws === "string" ? params.ws : "ws://localhost:8001";
  const key = typeof params.key === "string" ? params.key : "";
  const sid = typeof params.sid === "string" ? params.sid : "session-local";

  return <LiveWorkspace profileId="blind" wsUrl={ws} apiKey={key} sessionId={sid} />;
}
