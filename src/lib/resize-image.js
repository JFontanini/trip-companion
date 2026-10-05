// Downscale a photo before upload: max 2048 px on the long edge, JPEG at 0.85.
// Re-encoding through a canvas also drops EXIF, including GPS coordinates, which is the
// privacy default we want for a shared family journal. The capture time is kept separately.
export async function resizeImage(file, { maxEdge = 2048, quality = 0.85 } = {}) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { blob, width: w, height: h, originalName: file.name, capturedAt: file.lastModified || Date.now() };
}
