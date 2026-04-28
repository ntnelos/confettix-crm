/**
 * Compress an image file to under maxSizeKB using Canvas API.
 * Returns a Blob of type image/jpeg.
 */
export async function compressImage(file: File, maxSizeKB = 100): Promise<Blob> {
  const maxBytes = maxSizeKB * 1024;

  // Load image
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');

  // Scale down to max 400px on longest side
  const MAX_DIM = 400;
  let { width, height } = bitmap;
  if (width > MAX_DIM || height > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Use high quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Binary search for the right quality
  let lo = 0.1, hi = 0.9, best: Blob | null = null;

  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', mid);
    });
    if (blob.size <= maxBytes) {
      best = blob;
      lo = mid; // try higher quality
    } else {
      hi = mid; // too big, lower quality
    }
  }

  // If even lowest quality is too large, just return at lowest quality
  if (!best) {
    best = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.1);
    });
  }

  return best!;
}
