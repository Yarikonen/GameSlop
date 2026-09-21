import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSolvedOnce } from './useSolvedOnce'

describe('закрытие задания лабораторией', () => {
  it('молчит, пока эксперимент не доведён до конца', () => {
    const onSolved = vi.fn()
    renderHook(() => useSolvedOnce(false, onSolved))

    expect(onSolved).not.toHaveBeenCalled()
  })

  it('сообщает о закрытии ровно один раз', () => {
    const onSolved = vi.fn()
    const { rerender } = renderHook(({ done }) => useSolvedOnce(done, onSolved), {
      initialProps: { done: false },
    })

    rerender({ done: true })
    rerender({ done: true })
    rerender({ done: false })
    rerender({ done: true })

    expect(onSolved).toHaveBeenCalledOnce()
  })
})
