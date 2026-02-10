"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  reconnectAttempts?: number;
  reconnectIntervalMs?: number;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  reconnectAttempts = 5,
  reconnectIntervalMs = 1500,
  autoConnect = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectCountRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    intentionalCloseRef.current = false;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCountRef.current = 0;
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      if (intentionalCloseRef.current) return;
      if (reconnectCountRef.current >= reconnectAttempts) return;

      reconnectCountRef.current += 1;
      setTimeout(() => connectRef.current(), reconnectIntervalMs);
    };

    ws.onmessage = (event) => {
      const raw = event.data;
      try {
        const data = JSON.parse(raw);
        onMessageRef.current?.(data);
      } catch {
        onMessageRef.current?.(raw);
      }
    };
  }, [reconnectAttempts, reconnectIntervalMs, url]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const sendJSON = useCallback((data: unknown) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify(data));
    return true;
  }, []);

  useEffect(() => {
    if (!autoConnect) return;
    connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  // Mobile browsers often kill sockets in background; reconnect on foreground.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && !intentionalCloseRef.current) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [connect]);

  return { isConnected, connect, disconnect, sendJSON };
}
