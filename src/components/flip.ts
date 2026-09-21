import { useLayoutEffect, useRef } from 'react'

const DURATION = 420

/**
 * Простой FLIP: карточки с data-flip-id физически перелетают между панелями
 * (Call Stack → очереди → Output), а не просто исчезают и появляются.
 */
export function useFlip<T extends HTMLElement>(key: unknown) {
  const containerRef = useRef<T | null>(null)
  const previous = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const nodes = root.querySelectorAll<HTMLElement>('[data-flip-id]')
    const next = new Map<string, DOMRect>()

    nodes.forEach((node) => {
      const id = node.dataset.flipId
      if (!id) return
      const rect = node.getBoundingClientRect()
      next.set(id, rect)
      if (reduced || typeof node.animate !== 'function') return

      const old = previous.current.get(id)
      if (!old) {
        node.animate(
          [
            { opacity: 0, transform: 'scale(0.86)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 220, easing: 'ease-out' },
        )
        return
      }
      const dx = old.left - rect.left
      const dy = old.top - rect.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: DURATION, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      )
    })

    previous.current = next
  }, [key])

  return containerRef
}
