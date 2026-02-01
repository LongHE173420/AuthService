import { randomUUID } from "crypto";

export function buildHeaders(deviceId: string) {
  return {
    "Content-Type": "application/json",
    "x-device-id": deviceId,
    "X-Client-Type": "web",
    "Accept-Language": "vi",
    "Idempotency-Key": randomUUID()
  };
}

export function buildHeadersWithAuth(deviceId: string, accessToken: string) {
  return {
    ...buildHeaders(deviceId),
    "Authorization": `Bearer ${accessToken}`
  };
}
