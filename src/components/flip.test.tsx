import { render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFlip } from './flip'

/**
 * jsdom не умеет ни измерять элементы, ни анимировать, поэтому подменяем
 * и позицию карточки, и Web Animations API.
 */
function mockGeometry() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = Number((this as HTMLElement).dataset.top ?? '0')
    return { top, left: 0, right: 0, bottom: 0, width: 10, height: 10, x: 0, y: top } as DOMRect
  })
}

function mockAnimate() {
  const animate = vi.fn()
  Object.defineProperty(Element.prototype, 'animate', {
    value: animate,
    configurable: true,
    writable: true,
  })
  return animate
}

function Board({ top }: { top: number }) {
  const [key, setKey] = useState(0)
  const ref = useFlip<HTMLDivElement>(top)
  return (
    <div ref={ref}>
      <div data-flip-id="card" data-top={top} />
      <button type="button" onClick={() => setKey(key + 1)}>
        перерисовать
      </button>
    </div>
  )
}

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate')
})

describe('перелёт карточек между панелями (FLIP)', () => {
  it('новая карточка появляется с анимацией', () => {
    mockGeometry()
    const animate = mockAnimate()

    render(<Board top={0} />)

    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.calls[0][0]).toEqual([
      { opacity: 0, transform: 'scale(0.86)' },
      { opacity: 1, transform: 'scale(1)' },
    ])
  })

  it('переехавшая карточка летит из прежней позиции', () => {
    mockGeometry()
    const animate = mockAnimate()
    const { rerender } = render(<Board top={0} />)
    animate.mockClear()

    rerender(<Board top={120} />)

    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.calls[0][0]).toEqual([
      { transform: 'translate(0px, -120px)' },
      { transform: 'translate(0, 0)' },
    ])
  })

  it('карточка, оставшаяся на месте, не дёргается', () => {
    mockGeometry()
    const animate = mockAnimate()
    const { rerender } = render(<Board top={40} />)
    animate.mockClear()

    rerender(<Board top={40} />)

    expect(animate).not.toHaveBeenCalled()
  })

  it('при prefers-reduced-motion анимации выключены', () => {
    mockGeometry()
    const animate = mockAnimate()
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)

    const { rerender } = render(<Board top={0} />)
    rerender(<Board top={200} />)

    expect(animate).not.toHaveBeenCalled()
  })

  it('браузер без Web Animations API не ломает игру', () => {
    mockGeometry()

    expect(() => render(<Board top={0} />)).not.toThrow()
  })
})
