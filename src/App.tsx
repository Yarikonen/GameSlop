import { useState } from 'react'
import { Endless } from './pages/Endless'
import { Game } from './pages/Game'
import { Menu } from './pages/Menu'
import { Results } from './pages/Results'
import { useGame } from './state/gameStore'

type Route =
  | { name: 'menu' }
  | { name: 'game'; levelId: string }
  | { name: 'results' }
  | { name: 'endless' }

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'menu' })
  const { dispatch } = useGame()

  if (route.name === 'game') {
    return (
      <Game
        key={route.levelId}
        levelId={route.levelId}
        onExit={() => setRoute({ name: 'menu' })}
        onOpenLevel={(levelId) => setRoute({ name: 'game', levelId })}
        onFinish={() => setRoute({ name: 'results' })}
      />
    )
  }

  if (route.name === 'endless') {
    return <Endless onExit={() => setRoute({ name: 'menu' })} />
  }

  if (route.name === 'results') {
    return (
      <Results
        onMenu={() => setRoute({ name: 'menu' })}
        onRestart={() => {
          dispatch({ type: 'reset' })
          setRoute({ name: 'menu' })
        }}
      />
    )
  }

  return (
    <Menu
      onOpenLevel={(levelId) => setRoute({ name: 'game', levelId })}
      onResults={() => setRoute({ name: 'results' })}
      onEndless={() => setRoute({ name: 'endless' })}
    />
  )
}
