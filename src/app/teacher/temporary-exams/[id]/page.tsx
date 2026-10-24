import { requireTeacher } from '@/lib/auth'
import { teacherTemporaryExamDetail } from '@/lib/temporary-exams'
import TemporaryExamBoard from './TemporaryExamBoard'

export default async function Page({ params }: { params: { id: string } }) {
  const teacher = await requireTeacher()
  const detail = await teacherTemporaryExamDetail(teacher.id, params.id)
  return <TemporaryExamBoard initialData={JSON.parse(JSON.stringify(detail))} />
}
