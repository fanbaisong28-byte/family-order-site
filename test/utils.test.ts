import { describe, it, expect, beforeEach } from "vitest";
import { generateRoomCode, validateRoomCode, sanitizeInput, hashPassword, getRoomHistory, saveRoomToHistory, removeRoomFromHistory } from "@/lib/utils";

describe("generateRoomCode", () => {
  it("generates a 6-character string", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it("contains only alphanumeric characters (no confusing chars 0/O/1/I)", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  it("generates unique codes across many calls", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(450); // allow some collisions
  });
});

describe("validateRoomCode", () => {
  it("accepts valid 6-letter codes", () => {
    expect(validateRoomCode("ABC123")).toBe(true);
  });

  it("accepts codes with hyphens", () => {
    expect(validateRoomCode("AB-C123")).toBe(true);
  });

  it("accepts lowercase and converts", () => {
    expect(validateRoomCode("abc123")).toBe(true);
  });

  it("rejects non-string values", () => {
    expect(validateRoomCode(123)).toBe(false);
    expect(validateRoomCode(null)).toBe(false);
    expect(validateRoomCode(undefined)).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(validateRoomCode("")).toBe(false);
  });

  it("rejects codes longer than 20 characters", () => {
    expect(validateRoomCode("A".repeat(21))).toBe(false);
  });
});

describe("sanitizeInput", () => {
  it("trims whitespace", () => {
    expect(sanitizeInput("  宫保鸡丁  ")).toBe("宫保鸡丁");
  });

  it("removes HTML tags", () => {
    expect(sanitizeInput("<script>alert('xss')</script>宫保鸡丁")).toBe("alert('xss')宫保鸡丁");
  });

  it("truncates to max length", () => {
    expect(sanitizeInput("a".repeat(300), 200)).toHaveLength(200);
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeInput(null)).toBe("");
    expect(sanitizeInput(undefined)).toBe("");
    expect(sanitizeInput(123 as any)).toBe("");
  });

  it("handles empty string", () => {
    expect(sanitizeInput("")).toBe("");
  });
});

describe("getRoomHistory / saveRoomToHistory / removeRoomFromHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when no history", () => {
    expect(getRoomHistory()).toEqual([]);
  });

  it("saves and retrieves entries", () => {
    saveRoomToHistory({ id: "ABC123", name: "测试房间", joinedAt: "2026-01-01T00:00:00.000Z" });
    const history = getRoomHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("ABC123");
    expect(history[0].name).toBe("测试房间");
  });

  it("deduplicates by id and moves to front", () => {
    saveRoomToHistory({ id: "A", name: "first", joinedAt: "2026-01-01T00:00:00.000Z" });
    saveRoomToHistory({ id: "B", name: "second", joinedAt: "2026-01-02T00:00:00.000Z" });
    saveRoomToHistory({ id: "A", name: "first-updated", joinedAt: "2026-01-03T00:00:00.000Z" });
    const history = getRoomHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe("A");
    expect(history[0].name).toBe("first-updated");
    expect(history[1].id).toBe("B");
  });

  it("removes entry by id", () => {
    saveRoomToHistory({ id: "A", name: "a", joinedAt: "2026-01-01T00:00:00.000Z" });
    saveRoomToHistory({ id: "B", name: "b", joinedAt: "2026-01-02T00:00:00.000Z" });
    removeRoomFromHistory("A");
    const history = getRoomHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("B");
  });

  it("limits to 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      saveRoomToHistory({
        id: `CODE${i}`,
        name: `房间${i}`,
        joinedAt: new Date().toISOString(),
      });
    }
    expect(getRoomHistory()).toHaveLength(50);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem("room_history", "not valid json");
    expect(getRoomHistory()).toEqual([]);
  });

  it("filters out malformed entries", () => {
    localStorage.setItem("room_history", JSON.stringify([{ id: "ok", name: "test", joinedAt: "2026-01-01" }, { bad: "no id" }]));
    const history = getRoomHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("ok");
  });
});

describe("hashPassword", () => {
  it("produces a 64-char hex string (SHA-256)", async () => {
    const hash = await hashPassword("test123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent results", async () => {
    const h1 = await hashPassword("mypassword");
    const h2 = await hashPassword("mypassword");
    expect(h1).toBe(h2);
  });

  it("produces different results for different inputs", async () => {
    const h1 = await hashPassword("password1");
    const h2 = await hashPassword("password2");
    expect(h1).not.toBe(h2);
  });
});
