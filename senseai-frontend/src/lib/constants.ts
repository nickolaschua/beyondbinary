export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";
export const VIDEO_CALL_POC_URL = process.env.NEXT_PUBLIC_VIDEO_CALL_POC_URL || "http://localhost:3001";

export const API_HEALTH = `${API_URL}/health`;
