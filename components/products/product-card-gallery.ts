import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { resolveMediaUrl } from "@/lib/media"

export const DEFAULT_CYCLE_INTERVAL_MS = 1100
export const DEFAULT_FADE_DURATION_MS = 300

// Module-level cache so preloaded images across cards and repeated hovers resolve instantly
export const preloadedUrlCache = new Set<string>()

export function preloadBrowserImage(src: string): Promise<boolean> {
  if (typeof window === "undefined" || !src) return Promise.resolve(false)
  const resolved = resolveMediaUrl(src)
  if (preloadedUrlCache.has(resolved)) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    try {
      const img = new window.Image()
      let settled = false
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true
          img.onload = null
          img.onerror = null
          if (ok) preloadedUrlCache.add(resolved)
          resolve(ok)
        }
      }
      img.onload = () => done(true)
      img.onerror = () => done(false)
      img.src = resolved
      if (img.complete) {
        done(img.naturalWidth > 0)
      }
    } catch {
      resolve(false)
    }
  })
}

export interface UseProductCardGalleryOptions {
  images: string[]
  cycleIntervalMs?: number
  fadeDurationMs?: number
  preloadImage?: (src: string) => Promise<boolean>
}

export function useProductCardGallery({
  images: rawImages,
  cycleIntervalMs = DEFAULT_CYCLE_INTERVAL_MS,
  fadeDurationMs = DEFAULT_FADE_DURATION_MS,
  preloadImage = preloadBrowserImage,
}: UseProductCardGalleryOptions) {
  // Normalize and deduplicate images while preserving order
  const images = useMemo(() => {
    const list = (rawImages || []).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    return Array.from(new Set(list))
  }, [rawImages])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null)
  const [isFading, setIsFading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Keep references to avoid stale closures in timeouts
  const isHoveredRef = useRef(false)
  const currentIndexRef = useRef(0)
  const tokenRef = useRef(0)
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const advanceCycleRef = useRef<(currentToken: number) => Promise<void>>(() => Promise.resolve())

  const clearAllTimers = useCallback(() => {
    if (cycleTimerRef.current !== null) {
      clearTimeout(cycleTimerRef.current)
      cycleTimerRef.current = null
    }
    if (fadeTimerRef.current !== null) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
    if (animFrameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  // Transition to a preloaded next index
  const startTransitionTo = useCallback((targetIndex: number, currentToken: number) => {
    if (!isHoveredRef.current || currentToken !== tokenRef.current) return

    setIncomingIndex(targetIndex)
    setIsFading(false)

    const triggerFade = () => {
      if (!isHoveredRef.current || currentToken !== tokenRef.current) return
      setIsFading(true)

      fadeTimerRef.current = setTimeout(() => {
        if (!isHoveredRef.current || currentToken !== tokenRef.current) return
        setCurrentIndex(targetIndex)
        currentIndexRef.current = targetIndex
        setIncomingIndex(null)
        setIsFading(false)

        // Schedule next image preload & transition
        const remainingDelay = Math.max(50, cycleIntervalMs - fadeDurationMs)
        cycleTimerRef.current = setTimeout(() => {
          if (!isHoveredRef.current || currentToken !== tokenRef.current) return
          void advanceCycleRef.current(currentToken)
        }, remainingDelay)
      }, fadeDurationMs)
    }

    if (typeof requestAnimationFrame === "function") {
      animFrameRef.current = requestAnimationFrame(() => {
        animFrameRef.current = requestAnimationFrame(triggerFade)
      })
    } else {
      fadeTimerRef.current = setTimeout(triggerFade, 20)
    }
  }, [cycleIntervalMs, fadeDurationMs])

  // Advance cycle: progressive preload next eligible image
  const advanceCycle = useCallback(async (currentToken: number) => {
    if (!isHoveredRef.current || currentToken !== tokenRef.current || images.length <= 1) return

    const current = currentIndexRef.current
    let nextIdx = (current + 1) % images.length
    let attempts = 0

    // Try finding next preloaded/loadable image (skip broken ones)
    while (attempts < images.length - 1) {
      const candidateSrc = images[nextIdx]
      const success = await preloadImage(candidateSrc)
      if (!isHoveredRef.current || currentToken !== tokenRef.current) return

      if (success) {
        startTransitionTo(nextIdx, currentToken)
        return
      }

      // If failed, skip candidate and try next
      attempts++
      nextIdx = (nextIdx + 1) % images.length
    }
  }, [images, preloadImage, startTransitionTo])

  useEffect(() => {
    advanceCycleRef.current = advanceCycle
  }, [advanceCycle])

  const onHoverStart = useCallback(() => {
    if (isHoveredRef.current) return
    isHoveredRef.current = true
    setIsHovered(true)

    if (images.length <= 1) return

    const token = ++tokenRef.current
    clearAllTimers()

    // Progressive preload starting at next index (index 1)
    void advanceCycle(token)
  }, [images.length, clearAllTimers, advanceCycle])

  const onHoverEnd = useCallback(() => {
    isHoveredRef.current = false
    setIsHovered(false)
    tokenRef.current++
    clearAllTimers()

    setCurrentIndex(0)
    currentIndexRef.current = 0
    setIncomingIndex(null)
    setIsFading(false)
  }, [clearAllTimers])

  // Cleanup on unmount or when image list changes
  useEffect(() => {
    return () => {
      isHoveredRef.current = false
      tokenRef.current++
      clearAllTimers()
    }
  }, [clearAllTimers])

  return {
    currentIndex,
    incomingIndex,
    isFading,
    isHovered,
    currentSrc: images[currentIndex] || "",
    incomingSrc: incomingIndex !== null ? images[incomingIndex] || "" : null,
    onHoverStart,
    onHoverEnd,
    images,
  }
}
