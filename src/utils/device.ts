import { randomUUID } from "crypto";

export function generateDeviceId() {
  return "dev-" + randomUUID();
}

export function generateRequestId() {
  return randomUUID();
}
