import type { Challenge } from '../engine/types'
import { ChoiceQuestion } from './ChoiceQuestion'
import { ClassifyBoard } from './ClassifyBoard'
import { EventLoopPuzzle } from './EventLoopPuzzle'
import { PredictOutput } from './PredictOutput'
import { FetchRace } from './sandboxes/FetchRace'
import { FreezeLab } from './sandboxes/FreezeLab'
import { IncidentBoss } from './sandboxes/IncidentBoss'
import { StarvationLab } from './sandboxes/StarvationLab'
import type { ChallengeHandlers } from './challengeTypes'

interface Props {
  challenge: Challenge
  handlers: ChallengeHandlers
  solved: boolean
  index: number
  total: number
}

const KIND_LABEL: Record<Challenge['kind'], string> = {
  'predict-output': 'PREDICTION',
  classify: 'CLASSIFY',
  choice: 'QUESTION',
  'event-loop': 'YOU ARE THE EVENT LOOP',
  sandbox: 'LAB',
}

export function ChallengePanel({ challenge, handlers, solved, index, total }: Props) {
  return (
    <section className="challenge">
      <header className="challenge__head">
        <span className="challenge__kind">{KIND_LABEL[challenge.kind]}</span>
        <span className="challenge__progress">
          задание {index + 1} / {total}
        </span>
      </header>
      <p className="challenge__prompt">{challenge.prompt}</p>

      {challenge.kind === 'predict-output' ? (
        <PredictOutput challenge={challenge} handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'classify' ? (
        <ClassifyBoard challenge={challenge} handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'choice' ? (
        <ChoiceQuestion challenge={challenge} handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'event-loop' ? (
        <EventLoopPuzzle challenge={challenge} handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'sandbox' && challenge.sandbox === 'fetch-race' ? (
        <FetchRace handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'sandbox' && challenge.sandbox === 'freeze-lab' ? (
        <FreezeLab handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'sandbox' && challenge.sandbox === 'starvation-lab' ? (
        <StarvationLab handlers={handlers} solved={solved} />
      ) : null}
      {challenge.kind === 'sandbox' && challenge.sandbox === 'incident' ? (
        <IncidentBoss handlers={handlers} solved={solved} />
      ) : null}
    </section>
  )
}
