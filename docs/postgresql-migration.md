# SQLite 到 PostgreSQL 迁移流程

本项目当前使用 Next.js + Prisma，数据库入口是 `src/lib/prisma.ts`，业务代码没有发现 `$queryRaw` / `$executeRaw` 这类原生 SQL。迁移的主要工作集中在 Prisma datasource、数据导出导入、上线切换和回滚。

## 当前状态

- 当前 Prisma datasource：`prisma/schema.prisma` 中 `provider = "sqlite"`，`url = "file:./dev.db"`。
- 当前数据库文件：`prisma/dev.db`。
- 当前 Prisma 版本：`prisma` 和 `@prisma/client` 实际安装版本均为 `5.22.0`。
- 当前数据量很小，`prisma/dev.db` 约 512KB，适合短暂停机迁移。
- SQLite 中的 `DateTime` 字段实际保存为毫秒时间戳整数，不能直接用 SQLite dump 灌进 PostgreSQL，否则时间字段容易类型不匹配或语义错误。

## 推荐策略

采用“停写一次性迁移”：

1. 停止线上写入。
2. 备份 SQLite 文件。
3. 从 SQLite 通过 Prisma Client 导出 JSON。
4. 切换 Prisma datasource 到 PostgreSQL。
5. 在 PostgreSQL 建空 schema。
6. 通过 Prisma Client 导入 JSON。
7. 校验行数、登录、提交、教师端管理等关键流程。
8. 切换生产环境变量并启动服务。

这个项目数据量不大，没有必要先做双写或增量同步。真正的停机窗口通常就是导出、导入、校验、重启这段时间。

## 第 0 步：准备 PostgreSQL

在服务器上创建数据库和用户，示例：

```bash
sudo -u postgres psql
```

```sql
CREATE USER code_editor WITH PASSWORD '替换成强密码';
CREATE DATABASE code_editor OWNER code_editor;
GRANT ALL PRIVILEGES ON DATABASE code_editor TO code_editor;
```

准备连接串：

```bash
postgresql://code_editor:替换成强密码@127.0.0.1:5432/code_editor?schema=public
```

如果数据库和应用不在同一台机器，把 `127.0.0.1` 换成实际主机，并确认防火墙、PostgreSQL `listen_addresses`、`pg_hba.conf` 已允许连接。

## 第 1 步：停服和备份 SQLite

在正式迁移前先停掉应用，保证没有新写入：

```bash
pm2 stop code-editor-platform
# 或者使用你当前实际的 systemd / docker / shell 进程管理命令
```

备份数据库文件：

```bash
mkdir -p backups
cp prisma/dev.db backups/dev.db.$(date +%Y%m%d%H%M%S).bak
```

备份后记录当前数据量：

```bash
sqlite3 prisma/dev.db "
select 'User', count(*) from User union all
select 'Assignment', count(*) from Assignment union all
select 'Submission', count(*) from Submission union all
select 'QuestionBankItem', count(*) from QuestionBankItem union all
select 'PracticePaper', count(*) from PracticePaper union all
select 'PaperQuestion', count(*) from PaperQuestion union all
select 'PracticeSession', count(*) from PracticeSession union all
select 'PracticeSessionStudent', count(*) from PracticeSessionStudent union all
select 'PracticeResponse', count(*) from PracticeResponse union all
select 'StudentPointRecord', count(*) from StudentPointRecord union all
select 'StudentPet', count(*) from StudentPet union all
select 'StudentPetEquipmentSlot', count(*) from StudentPetEquipmentSlot union all
select 'StudentPetSkillSlot', count(*) from StudentPetSkillSlot union all
select 'StudentPetInventorySlot', count(*) from StudentPetInventorySlot union all
select 'StudentPetExpRecord', count(*) from StudentPetExpRecord union all
select 'ChallengeChapterUnlock', count(*) from ChallengeChapterUnlock union all
select 'ChallengeLevelUnlock', count(*) from ChallengeLevelUnlock union all
select 'ChallengeProgress', count(*) from ChallengeProgress union all
select 'ChallengeSubmission', count(*) from ChallengeSubmission union all
select 'GodotSessionBootstrap', count(*) from GodotSessionBootstrap union all
select 'AppSetting', count(*) from AppSetting;
"
```

## 第 2 步：导出 SQLite 数据

建议新建一次性脚本 `scripts/export-prisma-data.ts`，在还没改 schema 前执行。

```ts
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'

const prisma = new PrismaClient()

async function main() {
  const data = {
    users: await prisma.user.findMany(),
    appSettings: await prisma.appSetting.findMany(),
    assignments: await prisma.assignment.findMany(),
    submissions: await prisma.submission.findMany(),
    studentPointRecords: await prisma.studentPointRecord.findMany(),
    studentPets: await prisma.studentPet.findMany(),
    studentPetEquipmentSlots: await prisma.studentPetEquipmentSlot.findMany(),
    studentPetSkillSlots: await prisma.studentPetSkillSlot.findMany(),
    studentPetInventorySlots: await prisma.studentPetInventorySlot.findMany(),
    studentPetExpRecords: await prisma.studentPetExpRecord.findMany(),
    questionBankItems: await prisma.questionBankItem.findMany(),
    practicePapers: await prisma.practicePaper.findMany(),
    paperQuestions: await prisma.paperQuestion.findMany(),
    practiceSessions: await prisma.practiceSession.findMany(),
    practiceSessionStudents: await prisma.practiceSessionStudent.findMany(),
    practiceResponses: await prisma.practiceResponse.findMany(),
    challengeChapterUnlocks: await prisma.challengeChapterUnlock.findMany(),
    challengeLevelUnlocks: await prisma.challengeLevelUnlock.findMany(),
    challengeProgresses: await prisma.challengeProgress.findMany(),
    challengeSubmissions: await prisma.challengeSubmission.findMany(),
    godotSessionBootstraps: await prisma.godotSessionBootstrap.findMany(),
  }

  mkdirSync('backups', { recursive: true })
  writeFileSync('backups/sqlite-export.json', JSON.stringify(data, null, 2))
}

main()
  .finally(async () => prisma.$disconnect())
```

执行：

```bash
npm ci
npm run db:generate
npx tsx scripts/export-prisma-data.ts
ls -lh backups/sqlite-export.json
```

`backups/sqlite-export.json` 包含用户密码哈希和业务数据，按生产数据处理，不要提交到 Git。

## 第 3 步：切换 Prisma 到 PostgreSQL

修改 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

修改 `.env` 或生产环境变量：

```bash
DATABASE_URL="postgresql://code_editor:替换成强密码@127.0.0.1:5432/code_editor?schema=public"
NEXTAUTH_SECRET="你的生产密钥"
NEXTAUTH_URL="https://你的域名"
MOBILE_API_TOKEN="你的生产 token"
MOBILE_API_OPERATOR_USERNAME="teacher"
```

不要继续使用 `prisma db push --accept-data-loss` 做生产常规升级。迁移到 PostgreSQL 后建议改为 Prisma Migrate：

```bash
npx prisma migrate dev --name init_postgresql
```

这会生成 `prisma/migrations/.../migration.sql`。确认 SQL 后，在生产库使用：

```bash
npx prisma migrate deploy
npm run db:generate
```

如果你只想先快速迁过去，也可以在空 PostgreSQL 库上执行：

```bash
npx prisma db push
npm run db:generate
```

但后续仍建议补齐正式 migration 文件，避免生产结构变更不可追踪。

## 第 4 步：导入 PostgreSQL

建议新建一次性脚本 `scripts/import-prisma-data.ts`，在 schema 已切到 PostgreSQL 且 `npm run db:generate` 后执行。

```ts
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'

const prisma = new PrismaClient()
const data = JSON.parse(readFileSync('backups/sqlite-export.json', 'utf8'))

async function insert(model: any, rows: any[]) {
  if (!rows?.length) return
  await model.createMany({ data: rows })
}

async function main() {
  await insert(prisma.user, data.users)
  await insert(prisma.appSetting, data.appSettings)
  await insert(prisma.assignment, data.assignments)
  await insert(prisma.submission, data.submissions)
  await insert(prisma.studentPointRecord, data.studentPointRecords)
  await insert(prisma.studentPet, data.studentPets)
  await insert(prisma.studentPetEquipmentSlot, data.studentPetEquipmentSlots)
  await insert(prisma.studentPetSkillSlot, data.studentPetSkillSlots)
  await insert(prisma.studentPetInventorySlot, data.studentPetInventorySlots)
  await insert(prisma.studentPetExpRecord, data.studentPetExpRecords)
  await insert(prisma.questionBankItem, data.questionBankItems)
  await insert(prisma.practicePaper, data.practicePapers)
  await insert(prisma.paperQuestion, data.paperQuestions)
  await insert(prisma.practiceSession, data.practiceSessions)
  await insert(prisma.practiceSessionStudent, data.practiceSessionStudents)
  await insert(prisma.practiceResponse, data.practiceResponses)
  await insert(prisma.challengeChapterUnlock, data.challengeChapterUnlocks)
  await insert(prisma.challengeLevelUnlock, data.challengeLevelUnlocks)
  await insert(prisma.challengeProgress, data.challengeProgresses)
  await insert(prisma.challengeSubmission, data.challengeSubmissions)
  await insert(prisma.godotSessionBootstrap, data.godotSessionBootstraps)
}

main()
  .finally(async () => prisma.$disconnect())
```

执行：

```bash
DATABASE_URL="postgresql://code_editor:替换成强密码@127.0.0.1:5432/code_editor?schema=public" \
npx tsx scripts/import-prisma-data.ts
```

如果导入失败，不要在半导入库上反复重试。最稳妥做法是清空并重建数据库，再重新执行 schema 创建和导入：

```bash
dropdb code_editor
createdb -O code_editor code_editor
npx prisma migrate deploy
# 或 npx prisma db push
DATABASE_URL="postgresql://..." npx tsx scripts/import-prisma-data.ts
```

## 第 5 步：校验

先校验 Prisma 能连接：

```bash
npx prisma validate
npx prisma studio
```

校验 PostgreSQL 行数：

```bash
psql "$DATABASE_URL" -c '
select '\''User'\'' as table_name, count(*) from "User" union all
select '\''Assignment'\'', count(*) from "Assignment" union all
select '\''Submission'\'', count(*) from "Submission" union all
select '\''QuestionBankItem'\'', count(*) from "QuestionBankItem" union all
select '\''PracticePaper'\'', count(*) from "PracticePaper" union all
select '\''PaperQuestion'\'', count(*) from "PaperQuestion" union all
select '\''PracticeSession'\'', count(*) from "PracticeSession" union all
select '\''PracticeSessionStudent'\'', count(*) from "PracticeSessionStudent" union all
select '\''PracticeResponse'\'', count(*) from "PracticeResponse" union all
select '\''StudentPointRecord'\'', count(*) from "StudentPointRecord" union all
select '\''StudentPet'\'', count(*) from "StudentPet" union all
select '\''StudentPetEquipmentSlot'\'', count(*) from "StudentPetEquipmentSlot" union all
select '\''StudentPetSkillSlot'\'', count(*) from "StudentPetSkillSlot" union all
select '\''StudentPetInventorySlot'\'', count(*) from "StudentPetInventorySlot" union all
select '\''StudentPetExpRecord'\'', count(*) from "StudentPetExpRecord" union all
select '\''ChallengeChapterUnlock'\'', count(*) from "ChallengeChapterUnlock" union all
select '\''ChallengeLevelUnlock'\'', count(*) from "ChallengeLevelUnlock" union all
select '\''ChallengeProgress'\'', count(*) from "ChallengeProgress" union all
select '\''ChallengeSubmission'\'', count(*) from "ChallengeSubmission" union all
select '\''GodotSessionBootstrap'\'', count(*) from "GodotSessionBootstrap" union all
select '\''AppSetting'\'', count(*) from "AppSetting";
'
```

再跑构建：

```bash
npm run build
```

手动检查这些流程：

- 教师账号登录。
- 学生账号登录。
- 教师端学生列表、作业列表、题库、练习试卷能打开。
- 学生提交一次作业或挑战，确认新记录写入 PostgreSQL。
- 积分和宠物页面能正常读取。
- 移动端或 Godot 登录接口如果在用，也要各测一次。

## 第 6 步：上线

确认 `.env` 或进程管理器里的环境变量已包含 PostgreSQL `DATABASE_URL` 后：

```bash
npm ci
npm run db:generate
npm run build
pm2 start code-editor-platform
# 或者使用你当前实际的启动方式
```

上线后观察日志：

```bash
pm2 logs code-editor-platform
```

重点看是否有 Prisma 连接错误、唯一约束错误、外键错误、DateTime 解析错误。

## 回滚方案

迁移前保留 SQLite 备份和旧代码。如果上线后出现无法快速修复的问题：

1. 停止 PostgreSQL 版本应用。
2. 恢复 `prisma/schema.prisma` 中 SQLite datasource。
3. 恢复 `prisma/dev.db` 备份。
4. `npm run db:generate && npm run build`。
5. 启动旧版本应用。

只要切到 PostgreSQL 后没有让用户继续写入很久，回滚损失可控。正式迁移时建议选择无人使用时段，并提前通知用户停用窗口。

## 迁移后建议

- 把 `prisma/dev.db` 从生产部署链路中移除，避免误以为还在用 SQLite。
- 把 `.env` 中数据库连接改为生产环境变量管理，不要提交真实密码。
- 后续结构变更使用 `prisma migrate dev` 和 `prisma migrate deploy`，不要依赖生产环境的 `db push --accept-data-loss`。
- 给 PostgreSQL 做定时备份，例如每天 `pg_dump`，并定期演练恢复。
