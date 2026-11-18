"use client";

export interface CompressedWebpResult {
  dataUrl: string;
  width: number;
  height: number;
  kb: number;
}

/**
 * Downscale a camera photo or image file to a crisp 360-480p longest edge
 * and encode as lightweight WebP (`image/webp`), retaining clear product labels
 * while keeping payload size fast (~15-60 KB).
 */
export async function compressImageToWebp(
  file: File,
  opts: { maxEdge?: number; initialQuality?: number; maxBytes?: number } = {}
): Promise<CompressedWebpResult> {
  const maxEdge = opts.maxEdge ?? 480;
  const maxBytes = opts.maxBytes ?? 140 * 1024;
  let quality = opts.initialQuality ?? 0.82;

  const { source, srcWidth, srcHeight, cleanup } = await decodeImageSource(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(srcWidth, srcHeight));
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is unavailable.");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    // Step down quality only if encoded payload is heavier than target ceiling
    while (estimateDataUrlBytes(dataUrl) > maxBytes && quality > 0.5) {
      quality = Number((quality - 0.1).toFixed(2));
      const attempt = canvas.toDataURL("image/webp", quality);
      if (attempt.startsWith("data:image/webp")) {
        dataUrl = attempt;
      } else {
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
    }

    const kb = Math.max(1, Math.round(estimateDataUrlBytes(dataUrl) / 1024));
    return { dataUrl, width, height, kb };
  } finally {
    cleanup();
  }
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return dataUrl.length;
  const b64 = dataUrl.slice(commaIdx + 1);
  return Math.floor((b64.length * 3) / 4);
}

async function decodeImageSource(file: File): Promise<{
  source: CanvasImageSource;
  srcWidth: number;
  srcHeight: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return {
        source: bmp,
        srcWidth: bmp.width,
        srcHeight: bmp.height,
        cleanup: () => {
          try {
            bmp.close();
          } catch {
            /* ignore */
          }
        },
      };
    } catch {
      /* fall through to HTMLImageElement */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image file."));
    el.src = objectUrl;
  });
  return {
    source: img,
    srcWidth: img.naturalWidth || 480,
    srcHeight: img.naturalHeight || 480,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}
