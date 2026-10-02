// Islands receive serialisable props only, so the site resolves ids to definitions here.
// This is the only file where applets and quizzes are looked up; the two never meet otherwise.
// Quiz pictures of applet plots are drawn here too, and handed to the quizzes as a renderer.

import { applets, getApplet } from '@abacus/applets'
import { AppletView } from '@abacus/applet-ui'
import { QuizImages, QuizView, WeeklyQuizStatus, WeeklyQuizView, type ImageRenderer, type NotebookScope } from '@abacus/quiz'
import { getQuiz, getWeeklyQuiz } from '@abacus/quizzes'
import type { ReactNode } from 'react'
import { url } from './config'
import { plotSvg } from './preview'

export function AppletIsland(props: { id: string; initialState?: Record<string, unknown>; startLocked?: boolean; showHeader?: boolean; pageHref?: string }) {
  return <AppletView def={getApplet(props.id)} {...props} />
}

const images: ImageRenderer = {
  plot: (img) => {
    const def = applets[img.applet]
    return def ? plotSvg(def, { state: img.state, plot: img.plot, width: 400, height: 260, labels: true, alt: img.alt }) : null
  },
  src: (path) => url(path),
}
const WithImages = ({ children }: { children: ReactNode }) => <QuizImages.Provider value={images}>{children}</QuizImages.Provider>

export function QuizIsland({ id, ...rest }: { id: string; scope: NotebookScope; number?: string | number; star?: boolean; unlocks?: string }) {
  return (
    <WithImages>
      <QuizView def={getQuiz(id)} {...rest} />
    </WithImages>
  )
}

export function WeeklyQuizIsland({ id, scope }: { id: string; scope: NotebookScope }) {
  return (
    <WithImages>
      <WeeklyQuizView def={getWeeklyQuiz(id)} scope={scope} />
    </WithImages>
  )
}

export function WeeklyQuizStatusIsland({ id, scope }: { id: string; scope: NotebookScope }) {
  return <WeeklyQuizStatus def={getWeeklyQuiz(id)} scope={scope} />
}
