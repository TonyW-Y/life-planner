/** Shrink an image in the browser to WebP (~200KB or less) so storage stays well inside free limits. */
export async function compressImage(file: Blob, maxSide = 1400, quality = 0.75): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  let q = quality
  let url = canvas.toDataURL('image/webp', q)
  while (url.length > 280_000 && q > 0.35) {
    q -= 0.1
    url = canvas.toDataURL('image/webp', q)
  }
  return url
}
