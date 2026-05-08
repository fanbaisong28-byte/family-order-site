export interface CompressOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: "image/webp";
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 0.8,
  format: "image/webp",
};

export function compressImage(
  file: File,
  options: Partial<CompressOptions> = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > height) {
        if (width > opts.maxWidth) {
          height = Math.round(height * (opts.maxWidth / width));
          width = opts.maxWidth;
        }
      } else {
        if (height > opts.maxHeight) {
          width = Math.round(width * (opts.maxHeight / height));
          height = opts.maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("压缩失败"));
        },
        opts.format,
        opts.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };

    img.src = url;
  });
}

export function validateImageFile(file: File): string | null {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(file.type)) return "仅支持 JPG/PNG/WebP/HEIC";

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) return "图片不能超过10MB";

  return null;
}
