// Islands receive serialisable props only, so the site resolves ids to definitions here.
// This is the only file where applets and quizzes are looked up; the two never meet otherwise.

import { getApplet } from '@abacus/applets'
import { AppletView } from '@abacus/applet-ui'
import { QuizView, type NotebookScope } from '@abacus/quiz'
import { getQuiz } from '@abacus/quizzes'

export function AppletIsland(props: { id: string; zustand?: Record<string, unknown>; gesperrt?: boolean; kopf?: boolean; vollbildHref?: string }) {
  return <AppletView def={getApplet(props.id)} {...props} />
}

export function QuizIsland({ id, ...rest }: { id: string; scope: NotebookScope; nr?: string | number; stern?: boolean; schaltetFrei?: string }) {
  return <QuizView def={getQuiz(id)} {...rest} />
}
