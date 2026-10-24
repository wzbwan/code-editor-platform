-- CreateTable
CREATE TABLE "TemporaryExam" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "paper" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemporaryExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryExamAttempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "grades" JSONB NOT NULL,
    "tokenHash" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "focusLostCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporaryExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemporaryExamEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemporaryExamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemporaryExam_teacherId_createdAt_idx" ON "TemporaryExam"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "TemporaryExamAttempt_examId_submittedAt_idx" ON "TemporaryExamAttempt"("examId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemporaryExamAttempt_examId_studentNumber_key" ON "TemporaryExamAttempt"("examId", "studentNumber");

-- CreateIndex
CREATE INDEX "TemporaryExamEvent_attemptId_occurredAt_idx" ON "TemporaryExamEvent"("attemptId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TemporaryExam" ADD CONSTRAINT "TemporaryExam_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryExamAttempt" ADD CONSTRAINT "TemporaryExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "TemporaryExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemporaryExamEvent" ADD CONSTRAINT "TemporaryExamEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TemporaryExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
