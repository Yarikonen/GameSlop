import { useEffect, useRef } from 'react'

/** Сообщает «задание закрыто» ровно один раз — без побочных эффектов в апдейтерах state. */
export function useSolvedOnce(done: boolean, onSolved: () => void) {
  const fired = useRef(false)
  useEffect(() => {
    if (!done || fired.current) return
    fired.current = true
    onSolved()
  }, [done, onSolved])
}
