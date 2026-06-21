import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const hospitalErDataCenterChapter: ChallengeChapterDefinition = {
  key: 'hospital-er-data-center',
  title: '医院急诊数据中心',
  theme: 'Python 基础综合闯关',
  description: '你是医院急诊分诊台的数据助理，需要用 Python 整理分诊单、巡查路线、病情分级、候诊队列和急诊工作报告。',
  helpDoc: {
    title: '急诊数据闯关提示卡',
    intro: '这一章根据讲义中的变量、数据类型、分支、循环、字符串、列表、元组、集合、字典、函数、lambda 与列表推导式设计。做题时先看清要求保存哪些变量，再一步一步补全或修复代码。',
    sections: [
      {
        title: '1. 变量、类型与字符串',
        points: [
          '变量使用 变量名 = 值 创建，字符串要放在引号中，数字和布尔值不要随意写成字符串。',
          '字符串可以用 strip() 去掉两端空白，用 split() 拆分字段，用 replace() 替换片段。',
          '如果题目要求保存变量，必须把计算结果赋值给指定变量，只 print 不会通过变量判题。',
        ],
        exampleTitle: '示例',
        exampleCode: `raw = '  D001-北区-已接单  '
clean = raw.strip()
parts = clean.split('-')`,
      },
      {
        title: '2. 分支、循环与容器',
        points: [
          'if、elif、else 适合根据分数、状态、人数等条件分类，边界值要写成 >= 或 <=。',
          '列表适合保存有顺序的数据，append、insert、pop、remove、len 都是常见操作。',
          '集合适合去重，字典适合保存 key 到 value 的映射；遍历字典时可以使用 for key in 字典。',
        ],
        exampleTitle: '示例',
        exampleCode: `levels = []
for score in scores:
    if score >= 90:
        levels.append('红色急危')`,
      },
      {
        title: '3. 函数与列表推导式',
        points: [
          '函数用 def 定义，通常用 return 返回结果，调用函数后要把返回值保存到变量。',
          '列表推导式可以把循环筛选写得更简洁，例如 [x for x in nums if x >= 80]。',
          'sorted、max 等函数可以配合 key=lambda item: item[\'score\'] 按字典字段排序或取最大值。',
        ],
      },
    ],
    closingTip: '前几关适合直接补变量或修复一两行代码；后几关先写出中间变量，再逐步组装报告字典。',
  },
  levels: [
    {
      key: 'create-triage-card',
      title: '第1关：填写急诊分诊单',
      summary: '补全基础变量，并整理成急诊分诊单字典。',
      description: '任务：请补全代码，创建一张急诊分诊单。分诊编号 triage_id 为 \'ER-2026-001\'；风险分 risk_score 为整数 3。最后保持 triage_card 字典内容正确。',
      points: 2,
      initialCode: `triage_id = None
risk_score = None

triage_card = {
    'triage_id': triage_id,
    'risk_score': risk_score,
}
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          triage_card: {
            triage_id: 'ER-2026-001',
            risk_score: 3,
          },
        },
      },
    },
    {
      key: 'prepare-round-route',
      title: '第2关：准备病区巡查路线',
      summary: '补全列表、索引取值和长度统计。',
      description: '任务：请补全代码。round_points 是列表，依次为 \'room-01\'、\'room-02\'、\'room-03\'、\'room-04\'。',
      points: 2,
      initialCode: `round_points = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          round_points: [
            'room-01',
            'room-02',
            'room-03',
            'room-04',
          ],
        },
      },
    },
    {
      key: 'lock-round-route',
      title: '第3关：锁定病区巡查路线',
      summary: '列表索引取值。',
      description: '任务：请补全代码。round_points 是列表，依次为 \'room-01\'、\'room-02\'、\'room-03\'、\'room-04\'；first_point 保存 round_points 的第一个点位；last_point 保存最后一个点位。',
      points: 2,
      initialCode: `round_points = ['room-01', 'room-02', 'room-03', 'room-04']
first_point = None
last_point = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_point: 'room-01',
          last_point: 'room-04',
        },
      },
    },
    {
      key: 'clean-triage-text',
      title: '第4关：清洗分诊文本',
      summary: '使用 split 处理一条分诊文本。',
      description: '任务：raw_triage 中保存了一条分诊文本。请保存 parts 为按 \'-\' 拆分后的列表。',
      points: 3,
      initialCode: `raw_triage = '120-青城急诊科-发热患者-已分诊'
# 提示：字符串切割方法为 字符串.split(分隔符)
parts = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          parts: [
            '120',
            '青城急诊科',
            '发热患者',
            '已分诊',
          ],
        },
      },
    },
    {
      key: 'fix-waiting-queue',
      title: '第5关：修复候诊队列1',
      summary: '列表增改代码，得到正确候诊队列。',
      description: '请完成队列整理：在队尾追加 \'候诊D组\'。',
      points: 3,
      initialCode: `queue = ['候诊A组', '候诊B组', '候诊C组']

# 提示：列表常用的方法有 append, extend, insert, pop, remove, sort等

`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '候诊A组',
            '候诊B组',
            '候诊C组',
            '候诊D组',
          ],
        },
      },
    },
    {
      key: 'fix-waiting-queue2',
      title: '第6关：修复候诊队列2',
      summary: '列表增改代码，得到正确候诊队列。',
      description: '请完成队列整理：把 \'候诊C组\' 改成 \'复诊观察组\'。',
      points: 3,
      initialCode: `queue = ['候诊A组', '候诊B组', '候诊C组', '候诊D组']
# 提示：列表可通过索引获取或修改元素

`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '候诊A组',
            '候诊B组',
            '复诊观察组',
            '候诊D组',
          ],
        },
      },
    },
    {
      key: 'fix-triage-levels',
      title: '第7关：修复病情等级',
      summary: '修复分支边界条件和列表追加内容。',
      description: '下面代码有错误。请修复。规则：90 分及以上为 \'红色急危\'；70 到 89 为 \'橙色优先\'；40 到 69 为 \'黄色观察\'；40 以下为 \'绿色普通\'。最后保存风险等级列表 risk_levels。',
      points: 4,
      initialCode: `scores = [95, 70, 40, 12, 90]
risk_levels = []

for score in scores:
    if score >= 90:
        level = '红色急危'
    elif score >= 70:
        level = '橙色优先'
    elif score >= 40:
        level = '黄色观察'
    else:
        level = '绿色普通'
    risk_levels.append(score)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          risk_levels: [
            '红色急危',
            '橙色优先',
            '黄色观察',
            '绿色普通',
            '红色急危',
          ],
        },
      },
    },
    {
      key: 'fix-valid-symptom-types',
      title: '第8关：修复症状类型统计',
      summary: '过滤空值和重复项，统计有效症状类型。',
      description: '下面代码要统计有效症状类型。空字符串和 None 不计入有效症状。请修复代码，保存 valid_types 和 valid_count。',
      points: 4,
      initialCode: `symptom_types = ['发热', '外伤', '腹痛', '', '胸痛', None, '头晕', '咳嗽']

valid_types = []
valid_count = 0

for symptom_type in symptom_types:
    # 请在此处补充代码，使结果正确

    valid_types.append(symptom_type)
    valid_count = valid_count + 1
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          valid_types: [
            '发热',
            '外伤',
            '腹痛',
            '胸痛',
            '头晕',
            '咳嗽',
          ],
          valid_count: 6,
        },
      },
    },
    {
      key: 'count-patient-status',
      title: '第9关：统计患者状态',
      summary: '用循环和分支统计已处理数量、待复诊编号和涉及人数。',
      description: '任务：patients 中每个字典是一条患者记录。请用循环完成：pending_ids 为 status 等于 \'待复诊\' 的患者编号列表，按出现顺序保存；total_people 为所有记录涉及人数合计。',
      points: 4,
      initialCode: `patients = [
    {'id': 'P001', 'type': '发热', 'status': '已处理', 'people': 2},
    {'id': 'P002', 'type': '外伤', 'status': '待复诊', 'people': 4},
    {'id': 'P003', 'type': '胸痛', 'status': '已处理', 'people': 1},
    {'id': 'P004', 'type': '腹痛', 'status': '待复诊', 'people': 1},
]

pending_ids = []
total_people = 0

# 请用循环保存 pending_ids、total_people
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          pending_ids: [
            'P002',
            'P004',
          ],
          total_people: 8,
        },
      },
    },
    {
      key: 'sort-triage-board',
      title: '第10关：整理分诊看板',
      summary: '使用列表推导式和 lambda 排序整理分诊数据。',
      description: '任务：triages 中每个字典是一条分诊记录。请完成：high_triage_ids 为 score 大于等于 80 的编号列表，按原顺序保存；sorted_triage_ids 为按 score 从高到低排序后的编号列表。建议使用列表推导式和 sorted(..., key=lambda item: item[\'score\'], reverse=True)。',
      points: 5,
      initialCode: `triages = [
    {'id': 'T01', 'area': '北区', 'score': 82},
    {'id': 'T02', 'area': '南区', 'score': 57},
    {'id': 'T03', 'area': '东区', 'score': 95},
    {'id': 'T04', 'area': '西区', 'score': 70},
]

# 请保存 high_triage_ids、sorted_triages、sorted_triage_ids
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          high_triage_ids: [
            'T01',
            'T03',
          ],
          sorted_triage_ids: [
            'T03',
            'T01',
            'T04',
            'T02',
          ],
        },
      },
    },
    {
      key: 'build-nurse-assessment',
      title: '第11关：生成护士考核结果',
      summary: '根据护士考核数据，计算综合成绩并划分等级。',
      description: '任务：nurses 中每个元素是一名护士的考核数据，包括(姓名, 分诊成绩, 理论成绩, 操作成绩)。请生成新列表 result。result 中的元素是元组，包含：(姓名,总分,评价等级)。总分为分诊成绩、理论成绩、操作成绩三项之和；评价等级 根据综合成绩划分：270 分及以上为 "优秀"，240 到 269 分为 "良好"，240 分以下为 "需培训"。',
      points: 5,
      initialCode: `nurses = [
    ('李明', 92, 88, 91),
    ('王芳', 85, 90, 86),
    ('张伟', 78, 82, 80),
    ('赵敏', 95, 94, 96),
    ('刘强', 70, 76, 72),
    ('陈晨', 88, 84, 83),
    ('孙磊', 60, 68, 65),
    ('周静', 90, 92, 89),
]

result = []

# 请用循环生成 result，每项包含 (姓名,总分,评价等级)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          result: [
            [
              '李明',
              271,
              '优秀',
            ],
            [
              '王芳',
              261,
              '良好',
            ],
            [
              '张伟',
              240,
              '良好',
            ],
            [
              '赵敏',
              285,
              '优秀',
            ],
            [
              '刘强',
              218,
              '需培训',
            ],
            [
              '陈晨',
              255,
              '良好',
            ],
            [
              '孙磊',
              193,
              '需培训',
            ],
            [
              '周静',
              271,
              '优秀',
            ],
          ],
        },
      },
    },
    {
      key: 'build-medicine-watch',
      title: '第12关：整理药品关注名单',
      summary: '定义函数，解析字符串记录并生成药品关注报告。',
      description: `任务：定义函数 build_medicine_watch(lines)。每条有效记录格式为 '药品编号,科室,状态'。要求：空字符串和拆分后不是 3 段的记录算 invalid_count；watched_codes 为状态等于 '重点' 的药品编号列表。最后调用函数并保存 medicine_report。
 medicine_report为字典，包含invalid_count和watched_codes两个键。`,
      points: 5,
      initialCode: `medicine_lines = [
    'MED21023,北区,正常',
    'MED37788,南区,重点',
    '',
    'MED41023,北区,正常',
    'MED59001,东区,重点',
    '错误记录',
    'MED63366,北区,正常',
]

# 请定义 build_medicine_watch(lines)

medicine_report = build_medicine_watch(medicine_lines)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          medicine_report: {
            invalid_count: 2,
            watched_codes: [
              'MED37788',
              'MED59001',
            ],
          },
        },
      },
    },
  ],
}
