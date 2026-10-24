import AnonymousExamClient from './AnonymousExamClient'

export default function Page({ params }: { params: { id: string } }) {
  return <AnonymousExamClient examId={params.id} />
}
