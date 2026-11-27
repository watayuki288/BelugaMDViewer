import { useEffect, useState } from 'react'

const imageCache = new Map<string, string | null>()

export function clearLocalImageCache(): void {
  imageCache.clear()
}

export async function resolveLocalImageSrc(
  src: string | undefined,
  baseFilePath?: string
): Promise<string | undefined> {
  if (!src) return undefined
  if (/^(https?:|data:|blob:)/i.test(src)) return src
  const key = `${baseFilePath ?? ''}::${src}`
  if (imageCache.has(key)) {
    return imageCache.get(key) ?? undefined
  }
  const resolved = await window.api.readLocalImage(src, baseFilePath)
  imageCache.set(key, resolved)
  return resolved ?? undefined
}

export function useLocalImageSrc(src: string | undefined, baseFilePath?: string): string | undefined {
  const isDirect = Boolean(src && /^(https?:|data:|blob:)/i.test(src))
  const [resolved, setResolved] = useState<string | undefined>(() => (isDirect ? src : undefined))

  useEffect(() => {
    if (!src) {
      setResolved(undefined)
      return
    }
    if (isDirect) {
      setResolved(src)
      return
    }
    let cancelled = false
    void resolveLocalImageSrc(src, baseFilePath).then((url) => {
      if (!cancelled) {
        setResolved(url)
      }
    })
    return () => {
      cancelled = true
    }
  }, [src, baseFilePath, isDirect])

  return resolved
}
