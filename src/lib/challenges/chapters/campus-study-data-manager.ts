import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const campusStudyDataManagerChapter: ChallengeChapterDefinition = {
  key: 'campus-study-data-manager',
  title: '校园学习数据管家',
  theme: 'Python 学期综合闯关',
  description:
    '你是班级学习数据管家，需要用 Python 整理学生档案、课程清单、签到记录、作业数据、学习日志、对象画像和期末报告。',
  helpDoc: {
    title: '学期综合闯关提示卡',
    intro:
      '这一章把整个学期学过的 Python 知识放在同一个任务线里使用。做题时先看清题目要求保存哪些变量，再按“准备数据、循环处理、条件判断、封装函数或类”的顺序拆解。',
    sections: [
      {
        title: '1. 基础数据和容器',
        points: [
          '变量用于保存程序中的数据，字符串、整数、浮点数和布尔值是常见基础类型。',
          '列表适合保存有顺序、可修改的数据；元组适合保存固定数据。',
          '集合适合去重和成员判断；字典适合保存“名称到信息”的映射。',
        ],
        exampleTitle: '示例',
        exampleCode: `profile = {'name': '林小星', 'score': 86}\nlessons = ['变量', '分支', '循环']\nunique_tags = set(['AI', 'AI', '网页'])`,
      },
      {
        title: '2. 分支、循环和函数',
        points: [
          'if、elif、else 适合根据分数、状态等条件分类。',
          'for 循环适合遍历列表、字典、集合和文件行。',
          '函数要用 return 返回结果；只 print 不会自动把结果保存到变量中。',
        ],
        exampleTitle: '示例',
        exampleCode: `def get_level(score):\n    if score >= 90:\n        return '优秀'\n    return '达标'\n\nlevel = get_level(92)`,
      },
      {
        title: '3. 文件、JSON 和对象',
        points: [
          '文件操作推荐使用 with open(..., encoding="utf-8")，可以自动关闭文件。',
          '读取文本后常用 strip() 去掉换行，用 split() 拆分字段。',
          'json.loads() 把 JSON 字符串转成 Python 对象，json.dumps() 把 Python 对象转成 JSON 字符串。',
          '类可以把同一类对象的数据和行为封装在一起，实例方法通常通过 self 访问实例属性。',
        ],
      },
    ],
    closingTip:
      '综合题不用追求一步写完。先让每个中间变量正确，再把重复逻辑封装成函数或类。',
  },
  levels: [
    {
      key: 'create-student-profile',
      title: '第1关：创建学生档案',
      summary: '补全基础变量，并把它们整理成学生档案字典。',
      description:
        "任务：请补全代码，创建学生基础档案。学生信息如下：\n姓名：林小星\n年龄：18\n分数：86.5\n学籍是否正常：是\n数据类型要求：'姓名'为字符串，'年龄'和'分数'为数值，'学籍是否正常'为bool值。最后把这些信息保存到 profile 字典中。",
      points: 2,
      initialCode: `name = None\nage = None\npython_score = None\nis_active = None\n\nprofile = {\n    'name': name,\n    'age': age,\n    'python_score': python_score,\n    'is_active': is_active,\n}\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          profile: {
            name: '林小星',
            age: 18,
            python_score: 86.5,
            is_active: true,
          },
        },
      },
    },
    {
      key: 'organize-course-list',
      title: '第2关：整理课程清单',
      summary: '补全列表、元组、字符串切片和长度统计。',
      description:
        "任务：请补全代码，从课程编码 course_code 中提取信息，并整理本周课程。week_courses 为列表，分别是'宪法','高等数学','大学英语';\n fixed_plan 为元组，分别是'保密教育', '国家安全教育'；\ncourse_year 为 '2026'。",
      points: 2,
      initialCode: `course_code = 'PY-2026-BASE'\n\nweek_courses = None\nfixed_plan = None\ncourse_prefix = None\ncourse_year = None`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          week_courses: ['宪法','高等数学','大学英语'],
          fixed_plan: ['保密教育', '国家安全教育'],
          course_prefix: 'PY',
          course_year: '2026',
        },
      },
    },
    {
      key: 'count-interest-tags',
      title: '第3关：统计兴趣标签',
      summary: '补全集合去重、成员判断和列表追加。',
      description:
        "任务：请补全代码，统计学生兴趣标签。unique_tags 是 raw_tags 去重后的集合，tag_count 是去重数量，tag_info 中保存 unique_count 和 has_ai，ordered_tags 按 ['AI', '网页', '数据分析', '游戏开发'] 的顺序保存。",
      points: 2,
      initialCode: `raw_tags = ['游戏开发', 'AI', '网页', 'AI', '数据分析', '游戏开发']\n\nunique_tags = []\ntag_count = 0\n\ntag_info = {\n    'unique_count': 0,\n    'has_ai': False,\n}\n\nordered_tags = []\n# 请使用 append 依次添加标签\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          unique_tags: ['AI', '数据分析', '游戏开发', '网页'],
          tag_count: 4,
          tag_info: {
            unique_count: 4,
            has_ai: true,
          },
          ordered_tags: ['AI', '网页', '数据分析', '游戏开发'],
        },
      },
    },
    {
      key: 'fix-score-levels',
      title: '第4关：修复成绩等级判断',
      summary: '修复分数等级判断中的边界条件和追加变量。',
      description:
        "下面代码有错误。请修复后，让每个分数得到正确等级。规则：90 分及以上为 A，80 到 89 为 B，70 到 79 为 C，60 到 69 为 D，60 以下为 E。最后把等级保存到 levels。",
      points: 3,
      initialCode: `scores = [96, 82, 77, 61, 45, 90, 80, 59]\nlevels = []\n\nfor score in scores:\n    if score > 90:\n        level = 'A'\n    elif score > 80:\n        level = 'B'\n    elif score > 70:\n        level = 'C'\n    elif score > 60:\n        level = 'D'\n    else:\n        level = 'E'\n    levels.append(score)\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          levels: ['A', 'B', 'C', 'D', 'E', 'A', 'B', 'E'],
        },
      },
    },
    {
      key: 'fix-attendance-counter',
      title: '第5关：修复签到统计器',
      summary: '修复空值过滤、重复姓名过滤和有效签到计数。',
      description:
        '下面代码要统计有效签到。空字符串和 None 不计入有效签到，重复姓名只保留第一次出现。请修复代码，保存 valid_students 和 valid_count。',
      points: 3,
      initialCode: `records = ['林小星', '', '周远航', '林小星', None, '许晨光', '周远航', '沈知秋']\n\nvalid_students = []\nvalid_count = 0\n\nfor name in records:\n    if name == '' and name == None:\n        continue\n    if name in valid_students:\n        valid_students.append(name)\n    valid_count = valid_count + 1\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          valid_students: ['林小星', '周远航', '许晨光', '沈知秋'],
          valid_count: 4,
        },
      },
    },
    {
      key: 'fix-final-score-function',
      title: '第6关：修复综合评分函数',
      summary: '修复函数默认参数和返回值。',
      description:
        '下面函数用于计算综合分。规则：综合分 = 平时分 * 0.4 + 期末分 * 0.6 + bonus。若 bonus 没传，默认为 0。请修复函数并保存 score_a、score_b、score_c。',
      points: 3,
      initialCode: `def calc_final(daily, final, bonus):\n    result = daily * 0.4 + final * 0.6 + bonus\n    print(result)\n\nscore_a = calc_final(80, 90, 3)\nscore_b = calc_final(70, 75)\nscore_c = calc_final(100, 85, 0)\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          score_a: 87.0,
          score_b: 73.0,
          score_c: 91.0,
        },
      },
    },
    {
      key: 'homework-summary',
      title: '第7关：作业完成情况汇总',
      summary: '使用循环、分支、集合和字典统计作业数据。',
      description:
        '任务：根据 homeworks 完成统计。submitted_count 为已交作业数量；missing_students 为缺交学生集合；excellent_students 为分数大于等于 90 的学生列表，按记录出现顺序保存且不重复；lesson_scores 为课程名到该课程所有已交分数列表的字典。',
      points: 4,
      initialCode: `homeworks = [\n    {'name': '林小星', 'lesson': '变量', 'status': '已交', 'score': 92},\n    {'name': '周远航', 'lesson': '变量', 'status': '已交', 'score': 81},\n    {'name': '许晨光', 'lesson': '变量', 'status': '缺交', 'score': 0},\n    {'name': '林小星', 'lesson': '循环', 'status': '已交', 'score': 88},\n    {'name': '周远航', 'lesson': '循环', 'status': '已交', 'score': 76},\n    {'name': '许晨光', 'lesson': '循环', 'status': '已交', 'score': 69},\n    {'name': '沈知秋', 'lesson': '循环', 'status': '已交', 'score': 95},\n]\n\n# 请保存 submitted_count、missing_students、excellent_students、lesson_scores\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          submitted_count: 6,
          missing_students: ['许晨光'],
          excellent_students: ['林小星', '沈知秋'],
          lesson_scores: {
            '变量': [92, 81],
            '循环': [88, 76, 69, 95],
          },
        },
      },
    },
    {
      key: 'study-log-file',
      title: '第8关：学习日志文件处理',
      summary: '写入并读取学习日志，结合字符串方法完成统计。',
      description:
        '任务：先将 log_text 写入 study_log.txt，再读取文件并统计。line_count 为日志总行数；action_count 为每种动作出现次数；submit_students 为提交过作业的学生列表，按出现顺序保存。',
      points: 4,
      initialCode: `log_text = '''林小星,登录,08:10\n周远航,登录,08:12\n林小星,提交作业,09:00\n许晨光,登录,09:10\n林小星,退出,10:30\n周远航,提交作业,10:40'''\n\nfile_name = 'study_log.txt'\n\n# 请完成写入、读取和统计\n# 保存 line_count、action_count、submit_students\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          line_count: 6,
          action_count: {
            '登录': 3,
            '提交作业': 2,
            '退出': 1,
          },
          submit_students: ['林小星', '周远航'],
        },
      },
    },
    {
      key: 'course-progress-class',
      title: '第9关：课程进度类',
      summary: '定义类、初始化实例属性，并通过实例方法管理课程进度。',
      description:
        "任务：定义 CourseProgress 类。1. __init__(self, name) 保存 name，并创建空列表 finished_lessons。2. add_lesson(self, lesson) 添加已完成课程，重复课程不重复添加。3. get_count(self) 返回已完成课程数量。4. get_report(self) 返回 {'name': 姓名, 'count': 数量, 'lessons': 已完成课程列表}。",
      points: 4,
      initialCode: `# 请定义 CourseProgress 类\n\nstudent = CourseProgress('林小星')\nstudent.add_lesson('变量')\nstudent.add_lesson('分支')\nstudent.add_lesson('循环')\nstudent.add_lesson('循环')\n\nprogress_count = student.get_count()\nprogress_report = student.get_report()\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          progress_count: 3,
          progress_report: {
            name: '林小星',
            count: 3,
            lessons: ['变量', '分支', '循环'],
          },
        },
      },
    },
    {
      key: 'build-api-payload',
      title: '第10关：生成学习接口数据',
      summary: '使用 json 模块、函数和字典生成接口请求数据。',
      description:
        "任务：模拟把学习报告发送给服务器。不要真的访问网络，只需要生成接口请求所需的数据。请导入 json，并定义 build_payload(students)，返回包含 class_name、student_count、average_score、need_help 的字典。最后保存 payload、body、headers。body 使用 json.dumps(payload, ensure_ascii=False) 生成，headers 为 {'Content-Type': 'application/json'}。",
      points: 5,
      initialCode: `students = [\n    {'name': '林小星', 'score': 92, 'finished': 8},\n    {'name': '周远航', 'score': 81, 'finished': 7},\n    {'name': '许晨光', 'score': 69, 'finished': 5},\n]\n\n# 请导入 json，并定义 build_payload(students)\n# 最后保存 payload、body、headers\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          payload: {
            class_name: 'Python一班',
            student_count: 3,
            average_score: 82.0,
            need_help: ['许晨光'],
          },
          body: '{"class_name": "Python一班", "student_count": 3, "average_score": 82.0, "need_help": ["许晨光"]}',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
    },
    {
      key: 'student-profile-objects',
      title: '第11关：学生画像对象系统',
      summary: '使用类、继承和方法重写生成学生画像。',
      description:
        "任务：定义 Student 类和 KeyStudent 子类。Student 需要保存 name、score、tags；get_level(self) 中 90 及以上返回 '优秀'，75 到 89 返回 '达标'，75 以下返回 '帮扶'；to_dict(self) 返回包含 name、score、level、tags 的字典。KeyStudent 继承 Student，并重写 get_level(self)，固定返回 '重点关注'。分数低于 75 的学生使用 KeyStudent 创建，其余使用 Student 创建。最后保存 profiles 和 level_count。",
      points: 5,
      initialCode: `records = [\n    {'name': '林小星', 'score': 92, 'tags': ['认真', '高分']},\n    {'name': '周远航', 'score': 81, 'tags': ['稳定']},\n    {'name': '许晨光', 'score': 69, 'tags': ['需辅导']},\n]\n\n# 请定义 Student 类和 KeyStudent 子类\n# 保存 profiles 和 level_count\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          profiles: [
            { name: '林小星', score: 92, level: '优秀', tags: ['认真', '高分'] },
            { name: '周远航', score: 81, level: '达标', tags: ['稳定'] },
            { name: '许晨光', score: 69, level: '重点关注', tags: ['需辅导'] },
          ],
          level_count: {
            '优秀': 1,
            '达标': 1,
            '重点关注': 1,
          },
        },
      },
    },
    {
      key: 'final-study-report',
      title: '第12关：期末学习报告生成器',
      summary: '综合使用 JSON、函数、类、文件、容器、循环和分支生成报告。',
      description:
        "任务：根据模拟接口返回的 JSON 字符串，生成期末学习报告，并写入文件。定义 StudentReport 类，保存 name、finished、score。StudentReport.get_status(self, total_lessons) 的规则：finished 等于 total_lessons 且 score >= 85 返回 '优秀完成'；finished >= total_lessons - 1 且 score >= 75 返回 '正常完成'；其他返回 '需要补强'。定义 build_final_report(api_text)，解析 JSON 并返回报告字典。将报告摘要写入 final_report.txt。最后保存 final_report、report_text、saved_line_count。",
      points: 5,
      initialCode: `import json\n\napi_text = '''\n{\n  "class_name": "Python一班",\n  "lessons": ["变量", "分支", "循环", "列表", "字典", "函数", "面向对象", "文件", "网络"],\n  "students": [\n    {"name": "林小星", "finished": 9, "score": 94},\n    {"name": "周远航", "finished": 8, "score": 83},\n    {"name": "许晨光", "finished": 6, "score": 72},\n    {"name": "沈知秋", "finished": 9, "score": 88}\n  ]\n}\n'''\n\n# 请定义 StudentReport 类和 build_final_report(api_text)\n# 将报告摘要写入 final_report.txt\n# 保存 final_report、report_text、saved_line_count\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          final_report: {
            class_name: 'Python一班',
            lesson_count: 9,
            average_score: 84.8,
            status_count: {
              '优秀完成': 2,
              '正常完成': 1,
              '需要补强': 1,
            },
            top_students: ['林小星'],
          },
          report_text: '班级：Python一班\n课程数：9\n平均分：84.8\n优秀学生：林小星',
          saved_line_count: 4,
        },
      },
    },
  ],
}
