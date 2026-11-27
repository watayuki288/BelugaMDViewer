import { useEffect, useState } from 'react'

const MAX_CACHE_ENTRIES = 100
const MAX_CACHE_BYTES = 64 * 1024 * 1024 // ~64 MiB of data URLs

// Insertion-ordered Map used as an LRU cache (most recently used at the end).
const imageCache = new Map<string, string>()
let totalCachedBytes = 0

function makeCacheKey(src: string, baseFilePath?: string): string {
  return `${baseFilePath ?? ''}::${src}`
}

function getFromCache(key: string): string | undefined {
  const existing = imageCache.get(key)
  if (existing === undefined) return undefined
  // Refresh LRU recency.
  imageCache.delete(key)
  imageCache.set(key, existing)
  return existing
}

function setInCache(key: string, value: string): void {
  if (value.length > MAX_CACHE_BYTES) return
  const prev = imageCache.get(key)
  if (prev !== undefined) {
    totalCachedBytes -= prev.length
    imageCache.delete(key)
  }
  imageCache.set(key, value)
  totalCachedBytes += value.length

  while (imageCache.size > MAX_CACHE_ENTRIES || totalCachedBytes > MAX_CACHE_BYTES) {
    const oldestKey = imageCache.keys().next().value
    if (oldestKey === undefined) break
    const oldestVal = imageCache.get(oldestKey)
    imageCache.delete(oldestKey)
    if (oldestVal !== undefined) {
      totalCachedBytes -= oldestVal.length
    }
  }
}

export function clearLocalImageCache(): void {
  imageCache.clear()
  totalCachedBytes = 0
}

export function evictLocalImageCacheForBasePath(baseFilePath: string): void {
  const prefix = `${baseFilePath}::`
  for (const [key, val] of [...imageCache.entries()]) {
    if (key.startsWith(prefix)) {
      imageCache.delete(key)
      totalCachedBytes -= val.length
    }
  }
}

export async function resolveLocalImageSrc(
  src: string | undefined,
  baseFilePath?: string
): Promise<string | undefined> {
  if (!src) return undefined
  if (/^(https?:|data:|blob:)/i.test(src)) return src
  const key = makeCacheKey(src, baseFilePath)
  const cached = getFromCache(key)
  if (cached !== undefined) {
    return cached
  }
  const resolved = await window.api.readLocalImage(src, baseFilePath)
  // Do not cache failed/missing lookups so newly created image files load immediately on retry.
  if (resolved) {
    setInCache(key, resolved)
    return resolved
  }
  return undefined
}

export function useLocalImageSrc(
  src: string | undefined,
  baseFilePath?: string
): string | undefined {
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
