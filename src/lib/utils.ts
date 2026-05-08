import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function validateRoomCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9-]{1,20}$/.test(code);
}

export function sanitizeInput(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").trim().slice(0, maxLength);
}

export async function hashPassword(password: string): Promise<string> {
  const msg = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", msg);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const HISTORY_KEY = "room_history";
const MAX_HISTORY = 50;

export interface RoomHistoryEntry {
  id: string;
  name: string;
  joinedAt: string;
}

export function getRoomHistory(): RoomHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RoomHistoryEntry =>
        typeof e?.id === "string" &&
        typeof e?.name === "string" &&
        typeof e?.joinedAt === "string"
    );
  } catch {
    return [];
  }
}

export function saveRoomToHistory(entry: RoomHistoryEntry): void {
  const history = getRoomHistory().filter((e) => e.id !== entry.id);
  history.unshift(entry);
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY))
  );
}

export function removeRoomFromHistory(roomId: string): void {
  const history = getRoomHistory().filter((e) => e.id !== roomId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
