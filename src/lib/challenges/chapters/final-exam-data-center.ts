import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const finalExamDataCenterChapter: ChallengeChapterDefinition = {
  key: 'final-exam-data-center',
  title: '期末学习数据调度中心',
  description: '你是期末学习数据调度员，需要用 Python 把考试信息、签到记录、课程计划、分数表和学习标签整理成可靠的数据报告。',
  theme: 'Python 基础与数据处理期末综合考核',
  helpDoc: {
    title: '期末综合闯关提示卡',
    intro: '本章覆盖变量、数据类型、运算符、分支、循环、列表、元组、字符串、切片、集合、字典、函数、lambda 和列表推导式。答题时先看清要求保存的变量名，再把任务拆成“准备数据、遍历处理、条件判断、保存结果”。',
    sections: [
      {
        title: '1. 基础类型、字符串和分支',
        points: [
          '变量名要表达含义，字符串、整数、浮点数和布尔值要按题目要求保存。',
          '字符串常用 strip() 去掉两端空白，split() 拆分字段，replace() 替换内容。',
          'if、elif、else 要从最严格或最特殊的条件开始判断，注意 60、80、90 这类边界值。',
        ],
        exampleTitle: '示例',
        exampleCode: `raw = '  PY-2026  '
code = raw.strip()
if code.startswith('PY'):
    result = 'Python'`,
      },
      {
        title: '2. 容器和循环',
        points: [
          '列表适合保存有顺序、可修改的数据，append()、insert()、remove() 可以完成增删改。',
          '元组适合保存固定数据，列表、元组和字符串都支持索引、切片、len()、in。',
          '集合适合去重、成员判断、并集、交集和差集；字典适合保存键值对应关系。',
        ],
        exampleTitle: '示例',
        exampleCode: `scores = [88, 76, 92]
passed = []
for score in scores:
    if score >= 60:
        passed.append(score)`,
      },
      {
        title: '3. 函数与简洁数据处理',
        points: [
          '函数要用 return 返回结果，调用函数后再把返回值保存到指定变量。',
          '列表推导式适合生成新列表，例如 [x * 2 for x in nums]。',
          'sorted、max、map、filter 可以配合 lambda 处理字典列表，但规则要保持一行清晰。',
        ],
        exampleTitle: '示例',
        exampleCode: `students = [{'name': '林小星', 'score': 92}, {'name': '周远航', 'score': 80}]
ranking = sorted(students, key=lambda item: item['score'], reverse=True)`,
      },
    ],
    closingTip: '综合题不要急着一行写完。先写出中间变量并确认结果，再把重复判断封装成函数或列表推导式。',
  },
  levels: [
    {
      key: 'build-exam-profile',
      title: '第1关：建立考试档案',
      summary: '补全基础变量，并整理成考试档案字典。',
      description: '任务：请补全代码，建立期末闯关考试档案。考试名称为 \'Python期末闯关\'，总分为 42，关卡数为 12，及格线为总分的 60%，考试已开放。最后把信息保存到 exam_profile 字典中。',
      points: 2,
      initialCode: `exam_name = None
total_points = None
level_count = None
pass_line = None
is_open = None

exam_profile = {
    'exam_name': exam_name,
    'total_points': total_points,
    'level_count': level_count,
    'pass_line': pass_line,
    'is_open': is_open,
}
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          exam_profile: {
            exam_name: 'Python期末闯关',
            total_points: 42,
            level_count: 12,
            pass_line: 25.2,
            is_open: true,
          },
        },
      },
    },
    {
      key: 'parse-exam-code',
      title: '第2关：解析考试编码',
      summary: '使用字符串清理、拆分和类型转换提取编码信息。',
      description: '任务：raw_code 按 \'-\' 拆分保存为 parts；提取 year_text、exam_tag；把最后的分数字符串转为整数 point_number；最后生成 code_summary，格式为 \'2026年FINAL考试共42分\'。',
      points: 2,
      initialCode: `raw_code = 'PY-2026-FINAL-42'

# 请保存 parts、year_text、exam_tag、point_number、code_summary
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          parts: [
            'PY',
            '2026',
            'FINAL',
            '42',
          ],
          year_text: '2026',
          exam_tag: 'FINAL',
          point_number: 42,
          code_summary: '2026年FINAL考试共42分',
        },
      },
    },
    {
      key: 'judge-unlock-level',
      title: '第3关：判断通关状态',
      summary: '阅读已有分支代码，找出并修正错误。',
      description: '任务：下面代码已经基本写好，但有 2 处错误。请阅读规则并修改代码，使结果正确。规则：如果 absent_count 大于 0，level 为 \'缺考\'；否则 90 分及以上为 \'优秀\'，80 到 89 为 \'良好\'，60 到 79 为 \'合格\'，60 以下为 \'需补考\'。如果没有缺考、分数大于等于 80，并且 late_minutes 等于 0，则 can_get_badge 为 True，否则为 False。',
      points: 2,
      initialCode: `daily_score = 84
late_minutes = 0
absent_count = 0

if absent_count > 0:
    level = '缺考'
elif daily_score >= 90:
    level = '优秀'
elif daily_score >= 80:
    level = '合格'
elif daily_score >= 60:
    level = '良好'
else:
    level = '需补考'

if absent_count == 0 and daily_score >= 80 and late_minutes > 0:
    can_get_badge = True
else:
    can_get_badge = False
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          level: '良好',
          can_get_badge: true,
        },
      },
    },
    {
      key: 'loop-score-counter',
      title: '第4关：循环统计成绩',
      summary: '使用循环、分支和内置函数统计成绩列表。',
      description: '任务：遍历 scores，保存 pass_count、fail_scores、score_total。要求：pass_count 为大于等于 60 的成绩数量；fail_scores 为低于 60 的成绩列表，保持原顺序；score_total 为总分。',
      points: 3,
      initialCode: `scores = [88, 76, 59, 92, 67, 45, 100]

pass_count = 0
fail_scores = []

# 请保存 score_total
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          pass_count: 5,
          fail_scores: [
            59,
            45,
          ],
          score_total: 527,
        },
      },
    },
    {
      key: 'repair-review-plan',
      title: '第5关：修复复习计划表',
      summary: '使用列表的增删改查整理复习任务。',
      description: '任务：task_plan 中缺少 \'循环\'，并且有一个重复的 \'列表\'。请把 \'循环\' 插入到下标 2 的位置；在末尾追加 \'字典\'；删除一个重复的 \'列表\'，让最终顺序为 [\'变量\', \'分支\', \'循环\', \'列表\', \'字典\']。最后保存 first_task 和 plan_count。',
      points: 3,
      initialCode: `task_plan = ['变量', '分支', '列表', '列表']

# 请使用 insert、append、remove 整理 task_plan
first_task = None
plan_count = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          task_plan: [
            '变量',
            '分支',
            '循环',
            '列表',
            '字典',
          ],
          first_task: '变量',
          plan_count: 5,
        },
      },
    },
    {
      key: 'slice-seat-tuple',
      title: '第6关：切分考场座位',
      summary: '使用元组索引、切片、步长和成员判断。',
      description: '任务：seats 是固定座位元组。请保存 first_row 为前三个座位；reverse_tail 为从最后一个座位开始倒着取 3 个；selected_seats 为从下标 1 开始每隔 2 个取一次；seat_report 字典包含 first、last、count、has_b02 四个字段。',
      points: 3,
      initialCode: `seats = ('A01', 'A02', 'A03', 'B01', 'B02', 'B03')

# 请保存 first_row、reverse_tail、selected_seats、seat_report
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_row: [
            'A01',
            'A02',
            'A03',
          ],
          reverse_tail: [
            'B03',
            'B02',
            'B01',
          ],
          selected_seats: [
            'A02',
            'B01',
            'B03',
          ],
          seat_report: {
            first: 'A01',
            last: 'B03',
            count: 6,
            has_b02: true,
          },
        },
      },
    },
    {
      key: 'clean-action-records',
      title: '第7关：清洗学习动作记录',
      summary: '结合字符串方法、循环、列表和字典整理日志。',
      description: '任务：raw_records 中每条记录格式为 \'姓名|动作\'。请生成 records，每项为 {\'name\': 姓名, \'action\': 动作}；统计 action_count 字典(每个动作有几次，如：\'登录\':2...)；保存 submit_students 为动作等于 \'提交作业\' 的姓名列表，按出现顺序；保存 login_count 为登录次数。',
      points: 4,
      initialCode: `raw_records = [
    '林小星|登录',
    '周远航|提交作业',
    '许晨光|登录',
    '沈知秋|退出',
    '林小星|提交作业',
]

# 请保存 clean_records、action_count、submit_students、login_count
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          records: [
            {
              name: '林小星',
              action: '登录',
            },
            {
              name: '周远航',
              action: '提交作业',
            },
            {
              name: '许晨光',
              action: '登录',
            },
            {
              name: '沈知秋',
              action: '退出',
            },
            {
              name: '林小星',
              action: '提交作业',
            },
          ],
          action_count: {
            '登录': 2,
            '提交作业': 2,
            '退出': 1,
          },
          submit_students: [
            '周远航',
            '林小星',
          ],
          login_count: 2,
        },
      },
    },
    {
      key: 'merge-study-groups',
      title: '第8关：合并学习小组',
      summary: '使用集合完成去重、成员判断和数学运算。',
      description: '任务：三个集合分别记录 Python、AI、网页小组成员。请保存 all_students 为三个小组的并集；python_ai_students 为同时参加 Python 和 AI 的成员；python_only_students 为只在 Python 小组、不在 AI 小组的成员；has_xia_yining 表示夏以宁是否出现在任意小组中。',
      points: 4,
      initialCode: `python_group = {'林小星', '周远航', '许晨光', '沈知秋'}
ai_group = {'林小星', '沈知秋', '顾南风'}
web_group = {'周远航', '顾南风', '夏以宁'}

# 请保存 all_students、python_ai_students、python_only_students、has_xia_yining
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          all_students: [
            '周远航',
            '夏以宁',
            '林小星',
            '沈知秋',
            '许晨光',
            '顾南风',
          ],
          python_ai_students: [
            '林小星',
            '沈知秋',
          ],
          python_only_students: [
            '周远航',
            '许晨光',
          ],
          has_xia_yining: true,
        },
      },
    },
    {
      key: 'summarize-submission-dict',
      title: '第9关：汇总作业分数字典',
      summary: '遍历字典，计算每名同学的平均分和达标名单。',
      description: '任务：submissions 的 key 是姓名，value 是该同学的作业分数列表。请保存 average_by_name，平均分保留 1 位小数，空列表平均分记为 0；保存 passed_names，为平均分大于等于 80 的姓名列表，按字典遍历顺序；保存 score_counts，记录每名同学提交了几次作业。',
      points: 4,
      initialCode: `submissions = {
    '林小星': [92, 88, 95],
    '周远航': [76, 84],
    '许晨光': [59, 61, 70],
    '沈知秋': [],
}

# 请保存 average_by_name、passed_names、score_counts
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          average_by_name: {
            '林小星': 91.7,
            '周远航': 80,
            '许晨光': 63.3,
            '沈知秋': 0,
          },
          passed_names: [
            '林小星',
            '周远航',
          ],
          score_counts: {
            '林小星': 3,
            '周远航': 2,
            '许晨光': 3,
            '沈知秋': 0,
          },
        },
      },
    },
    {
      key: 'build-level-functions',
      title: '第10关：封装成绩等级函数',
      summary: '定义函数并用循环生成等级统计报告。',
      description: '任务：请定义 get_level(score) 和 build_score_report(records)。get_level 规则：score 为 None 返回 \'缺考\'；90 分及以上 \'优秀\'；80 到 89 \'良好\'；60 到 79 \'合格\'；60 以下 \'待提升\'。build_score_report 返回字典，包含 total、pass_count。total是总人数，pass_count是合格及以上人数',
      points: 5,
      initialCode: `records = [
    {'name': '林小星', 'score': 96},
    {'name': '周远航', 'score': 82},
    {'name': '许晨光', 'score': 58},
    {'name': '沈知秋', 'score': None},
    {'name': '顾南风', 'score': 70},
]

# 请在此定义 get_level(score)

# 请在此定义 build_score_report(records)

level_list = [get_level(item['score']) for item in records]
score_report = build_score_report(records)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          level_list: [
            '优秀',
            '良好',
            '待提升',
            '缺考',
            '合格',
          ],
          score_report: {
            total: 5,
            pass_count: 3,
          },
        },
      },
    },
    {
      key: 'rank-course-tasks',
      title: '第11关：课程任务速排',
      summary: '使用 lambda、列表推导式、sorted 和 max 整理课程任务。',
      description: '任务：courses 记录课程名、学时、难度和是否完成。请用列表推导式生成 unfinished_names；生成 effort_scores，每项为 hours * difficulty；用 sorted 和 lambda 按 difficulty 从高到低排序，保存 sorted_courses；用 max 和 lambda 找出 hours * difficulty 最大的课程，保存 top_effort_course。',
      points: 5,
      initialCode: `courses = [
    {'name': '变量', 'hours': 2, 'difficulty': 1, 'finished': True},
    {'name': '分支', 'hours': 3, 'difficulty': 2, 'finished': True},
    {'name': '循环', 'hours': 4, 'difficulty': 3, 'finished': False},
    {'name': '列表', 'hours': 3, 'difficulty': 2, 'finished': True},
    {'name': '字典', 'hours': 2, 'difficulty': 3, 'finished': False},
]

# 请保存 unfinished_names、effort_scores、sorted_courses、top_effort_course
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          unfinished_names: [
            '循环',
            '字典',
          ],
          effort_scores: [
            2,
            6,
            12,
            6,
            6,
          ],
          sorted_courses: [
            {
              name: '循环',
              hours: 4,
              difficulty: 3,
              finished: false,
            },
            {
              name: '字典',
              hours: 2,
              difficulty: 3,
              finished: false,
            },
            {
              name: '分支',
              hours: 3,
              difficulty: 2,
              finished: true,
            },
            {
              name: '列表',
              hours: 3,
              difficulty: 2,
              finished: true,
            },
            {
              name: '变量',
              hours: 2,
              difficulty: 1,
              finished: true,
            },
          ],
          top_effort_course: {
            name: '循环',
            hours: 4,
            difficulty: 3,
            finished: false,
          },
        },
      },
    },
    {
      key: 'final-integrated-report',
      title: '第12关：生成期末综合报告',
      summary: '综合使用循环、字典、函数、集合和列表推导式处理真实感数据。',
      description: '任务：exam_records 中可能有重复姓名，重复记录只保留第一次；scores 为空时平均分记为 0。请保存 unique_names、average_by_student、excellent_project_names、class_counts、status_report。状态规则：平均分大于等于 90 为 \'优秀\'；60 到 89.9 为 \'达标\'；低于 60 为 \'待改进\'；没有成绩为 \'无成绩\'。excellent_project_names 要求平均分大于等于 90 且 tags 中包含 \'项目\'，按去重后的出现顺序。',
      points: 5,
      initialCode: `exam_records = [
    {'name': '林小星', 'class': '一班', 'scores': [90, 86, 94], 'tags': ['已签到', '项目']},
    {'name': '周远航', 'class': '一班', 'scores': [76, 82, 80], 'tags': ['已签到']},
    {'name': '许晨光', 'class': '二班', 'scores': [58, 0, 62], 'tags': ['补交']},
    {'name': '沈知秋', 'class': '二班', 'scores': [], 'tags': ['已签到']},
    {'name': '林小星', 'class': '一班', 'scores': [88, 90], 'tags': ['重复记录']},
    {'name': '顾南风', 'class': '三班', 'scores': [95, 91, 93], 'tags': ['已签到', '项目']},
]

# 请保存 unique_names、average_by_student、excellent_project_names、class_counts、status_report
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          unique_names: [
            '林小星',
            '周远航',
            '许晨光',
            '沈知秋',
            '顾南风',
          ],
          average_by_student: {
            '林小星': 90,
            '周远航': 79.3,
            '许晨光': 40,
            '沈知秋': 0,
            '顾南风': 93,
          },
          excellent_project_names: [
            '林小星',
            '顾南风',
          ],
          class_counts: {
            '一班': 2,
            '二班': 2,
            '三班': 1,
          },
          status_report: [
            {
              name: '林小星',
              status: '优秀',
            },
            {
              name: '周远航',
              status: '达标',
            },
            {
              name: '许晨光',
              status: '待改进',
            },
            {
              name: '沈知秋',
              status: '无成绩',
            },
            {
              name: '顾南风',
              status: '优秀',
            },
          ],
        },
      },
    },
  ],
}
