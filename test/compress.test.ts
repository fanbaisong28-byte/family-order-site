import { describe, it, expect } from "vitest";
import { validateImageFile } from "@/lib/compress";

function fakeFile(type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], "test", { type });
}

describe("validateImageFile", () => {
  it("accepts JPEG", () => {
    expect(validateImageFile(fakeFile("image/jpeg", 1024))).toBeNull();
  });

  it("accepts PNG", () => {
    expect(validateImageFile(fakeFile("image/png", 1024))).toBeNull();
  });

  it("accepts WebP", () => {
    expect(validateImageFile(fakeFile("image/webp", 1024))).toBeNull();
  });

  it("accepts HEIC", () => {
    expect(validateImageFile(fakeFile("image/heic", 1024))).toBeNull();
  });

  it("rejects unsupported formats", () => {
    expect(validateImageFile(fakeFile("image/gif", 1024))).toBe("仅支持 JPG/PNG/WebP/HEIC");
    expect(validateImageFile(fakeFile("image/bmp", 1024))).toBe("仅支持 JPG/PNG/WebP/HEIC");
    expect(validateImageFile(fakeFile("video/mp4", 1024))).toBe("仅支持 JPG/PNG/WebP/HEIC");
  });

  it("rejects files larger than 10MB", () => {
    const size = 11 * 1024 * 1024;
    expect(validateImageFile(fakeFile("image/jpeg", size))).toBe("图片不能超过10MB");
  });

  it("accepts files at exactly 10MB", () => {
    const size = 10 * 1024 * 1024;
    expect(validateImageFile(fakeFile("image/jpeg", size))).toBeNull();
  });

  it("accepts small files", () => {
    expect(validateImageFile(fakeFile("image/png", 1))).toBeNull();
  });
});
