import { localDb } from "./localDb";

const encoder = new TextEncoder();

function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${pin}`));
  return Array.from(new Uint8Array(data), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hasLocalPin(): Promise<boolean> {
  return Boolean(await localDb.settings.get("pin"));
}

export async function setLocalPin(pin: string): Promise<void> {
  if (!/^\d{4,}$/.test(pin)) throw new Error("PIN must contain at least 4 digits");
  const salt = randomSalt();
  await localDb.settings.put({
    key: "pin",
    value: { salt, verifier: await hashPin(pin, salt) },
  });
}

export async function verifyLocalPin(pin: string): Promise<boolean> {
  const setting = await localDb.settings.get("pin");
  if (!setting || typeof setting.value !== "object" || setting.value === null) return false;
  const stored = setting.value as { salt?: unknown; verifier?: unknown };
  if (typeof stored.salt !== "string" || typeof stored.verifier !== "string") return false;
  return (await hashPin(pin, stored.salt)) === stored.verifier;
}
