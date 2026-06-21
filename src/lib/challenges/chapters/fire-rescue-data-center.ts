import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const fireRescueDataCenterChapter: ChallengeChapterDefinition = {
  key: 'fire-rescue-data-center',
  title: '消防应急数据中心',
  theme: 'Python 基础综合闯关',
  description: '你是消防指挥中心的数据助理，需要用 Python 整理警情单、巡检路线、风险分级、救援队列和消防安全报告。',
  helpDoc: {
    title: '消防数据闯关提示卡',
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
        levels.append('一级预警')`,
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
      key: 'create-rescue-card',
      title: '第1关：填写消防警情单',
      summary: '补全基础变量，并计算警情优先级。',
      description: '任务：请补全代码。警情编号 rescue_id 为 \'XF-2026-001\'；风险分 risk_score 为整数 3；is_urgent 表示是否紧急，当 risk_score 大于等于 3 时为 True。最后保持 rescue_card 字典内容正确。',
      points: 2,
      initialCode: `rescue_id = None
risk_score = None
is_urgent = None

rescue_card = {
    'rescue_id': rescue_id,
    'risk_score': risk_score,
    'is_urgent': is_urgent,
}
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          rescue_card: {
            rescue_id: 'XF-2026-001',
            risk_score: 3,
            is_urgent: true,
          },
        },
      },
    },
    {
      key: 'prepare-inspection-route',
      title: '第2关：准备消防巡检路线',
      summary: '创建列表，并完成追加和长度统计。',
      description: '任务：先创建 inspection_points 列表，依次保存 \'火车南站\'、\'火车北站\'、\'体育场\'；再使用列表方法追加 \'万达商场\'；最后用 route_count 保存点位数量。',
      points: 2,
      initialCode: `inspection_points = None

# 请在此处追加“万达商场”，并统计点位数量

route_count = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          inspection_points: [
            '火车南站',
            '火车北站',
            '体育场',
            '万达商场',
          ],
          route_count: 4,
        },
      },
    },
    {
      key: 'lock-inspection-route',
      title: '第3关：锁定消防巡检路线',
      summary: '使用索引和切片提取巡检点位。',
      description: '任务：inspection_points 已给出。first_point 保存第一个点位；last_point 保存最后一个点位；middle_points 使用切片保存中间两个点位。',
      points: 2,
      initialCode: `inspection_points = ['火车南站', '火车北站', '体育场', '万达商场']
first_point = None
last_point = None
middle_points = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_point: '火车南站',
          last_point: '万达商场',
          middle_points: [
            '火车北站',
            '体育场',
          ],
        },
      },
    },
    {
      key: 'clean-rescue-text',
      title: '第4关：清洗报警文本',
      summary: '结合 strip 和 split 清洗报警文本。',
      description: '任务：raw_alarm 两端有多余空格。请先使用 strip() 去掉两端空白，再使用 split() 按 \'-\' 拆分，将结果保存到 parts。',
      points: 3,
      initialCode: `raw_alarm = '  119-青城消防站-电动车火情-已接警  '

clean_alarm = None
parts = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          clean_alarm: '119-青城消防站-电动车火情-已接警',
          parts: [
            '119',
            '青城消防站',
            '电动车火情',
            '已接警',
          ],
        },
      },
    },
    {
      key: 'fix-rescue-queue',
      title: '第5关：调整救援队列1',
      summary: '使用 insert 在指定位置插入救援组。',
      description: '请完成队列整理：将 \'无人机侦察组\' 插入到 \'救援A组\' 和 \'救援B组\' 之间。',
      points: 3,
      initialCode: `queue = ['救援A组', '救援B组', '救援C组']

# 提示：列表的 insert() 方法可以在指定位置插入元素
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '救援A组',
            '无人机侦察组',
            '救援B组',
            '救援C组',
          ],
        },
      },
    },
    {
      key: 'fix-rescue-queue2',
      title: '第6关：调整救援队列2',
      summary: '使用 remove 和 append 调整救援队列。',
      description: '请完成队列整理：移除 \'救援B组\'，再把 \'医疗保障组\' 追加到队尾。',
      points: 3,
      initialCode: `queue = ['救援A组', '救援B组', '无人机侦察组', '救援C组']

# 请依次完成移除和追加操作,  提示：可以使用remove() 和 append()方法
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '救援A组',
            '无人机侦察组',
            '救援C组',
            '医疗保障组',
          ],
        },
      },
    },
    {
      key: 'fix-fire-risk-levels',
      title: '第7关：判断火险等级',
      summary: '补充分支代码，统计不同火险等级。',
      description: '请补全分支代码。规则：90 分及以上为 \'一级预警\'；70 到 89 为 \'二级关注\'；40 到 69 为 \'三级观察\'；40 以下为 \'四级正常\'。最后保存风险等级列表 risk_levels。',
      points: 4,
      initialCode: `scores = [95, 70, 40, 12, 90]
risk_levels = []

for score in scores:
    if score >= 90:
        level = 
    elif score >= 70:
        level = 
    elif score >= 40:
        level = 
    else:
        level = 
    risk_levels.append(level)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          risk_levels: [
            '一级预警',
            '二级关注',
            '三级观察',
            '四级正常',
            '一级预警',
          ],
        },
      },
    },
    {
      key: 'fix-valid-fire-types',
      title: '第8关：整理火情类型',
      summary: '过滤无效值，并使用集合完成去重。',
      description: 'fire_types 中包含重复项、空字符串和 None。请先用循环将有效火情类型加入 valid_types，用 unique_count 保存火情类型的数量（重复的不算）。',
      points: 4,
      initialCode: `fire_types = ['电气', '烟雾', '燃气', '', '车辆', None, '烟雾', '山火', '电气']

valid_types = []

for fire_type in fire_types:
    # 请过滤空字符串和 None
    pass

unique_types = None
unique_count = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          valid_types: [
            '电气',
            '烟雾',
            '燃气',
            '车辆',
            '烟雾',
            '山火',
            '电气',
          ],
          unique_count: 5,
        },
      },
    },
    {
      key: 'count-rescue-status',
      title: '第9关：汇总救援状态',
      summary: '遍历字典列表，分类统计救援记录。',
      description: '任务：incidents 中每个字典是一条救援记录。请用循环完成：completed_count 为 status 等于 \'已处置\' 的记录数量；pending_ids 为 status 等于 \'待复查\' 的记录编号列表；max_people 保存单条记录中的最大涉及人数。',
      points: 4,
      initialCode: `incidents = [
    {'id': 'F001', 'type': '救援', 'status': '已处置', 'people': 2},
    {'id': 'F002', 'type': '燃气', 'status': '待复查', 'people': 4},
    {'id': 'F003', 'type': '车辆', 'status': '已处置', 'people': 1},
    {'id': 'F004', 'type': '烟雾', 'status': '待复查', 'people': 3},
]

completed_count = 0
pending_ids = []
people_counts = []

# 请使用循环完成统计

max_people = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          completed_count: 2,
          pending_ids: [
            'F002',
            'F004',
          ],
          max_people: 4,
        },
      },
    },
    {
      key: 'sort-hazard-board',
      title: '第10关：整理火险看板',
      summary: '使用列表推导式和 lambda 排序整理火险数据。',
      description: '任务：hazards 中每个字典是一条火险预警。请完成：high_hazard_ids 为 score 大于等于 80 的编号列表，按原顺序保存；sorted_hazard_ids 为按 score 从高到低排序后的编号列表。建议使用列表推导式和 sorted(..., key=lambda item: item[\'score\'], reverse=True)。',
      points: 5,
      initialCode: `hazards = [
    {'id': 'H01', 'area': '北区', 'score': 82},
    {'id': 'H02', 'area': '南区', 'score': 57},
    {'id': 'H03', 'area': '东区', 'score': 95},
    {'id': 'H04', 'area': '西区', 'score': 70},
]

# 请保存 high_hazard_ids、sorted_hazards、sorted_hazard_ids
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          high_hazard_ids: [
            'H01',
            'H03',
          ],
          sorted_hazard_ids: [
            'H03',
            'H01',
            'H04',
            'H02',
          ],
        },
      },
    },
    {
      key: 'build-firefighter-assessment',
      title: '第11关：生成消防员考核结果',
      summary: '根据消防员考核数据，计算综合成绩并划分等级。',
      description: '任务：firefighters 中每个元素是一名消防员的考核数据，包括(姓名, 体能成绩, 理论成绩, 器材操作成绩)。请生成新列表 result。result 中的元素是元组，包含：(姓名,总分,评价等级)。总分为体能成绩、理论成绩、器材操作成绩三项之和；评价等级 根据综合成绩划分：270 分及以上为 "优秀"，240 到 269 分为 "良好"，240 分以下为 "需强化"。',
      points: 5,
      initialCode: `firefighters = [
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
              '需强化',
            ],
            [
              '陈晨',
              255,
              '良好',
            ],
            [
              '孙磊',
              193,
              '需强化',
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
      key: 'build-equipment-watch',
      title: '第12关：整理消防设备关注名单',
      summary: '定义函数，解析字符串记录并生成设备关注报告。',
      description: `任务：定义函数 build_equipment_watch(lines)。每条有效记录格式为 '设备编号,辖区,状态'。要求：空字符串和拆分后不是 3 段的记录算 invalid_count；watched_codes 为状态等于 '重点' 的设备编号列表。最后调用函数并保存 equipment_report。
 equipment_report为字典，包含invalid_count和watched_codes两个键。`,
      points: 5,
      initialCode: `equipment_lines = [
    'EQ21023,北区,正常',
    'EQ37788,南区,重点',
    '',
    'EQ41023,北区,正常',
    'EQ59001,东区,重点',
    '错误记录',
    'EQ63366,北区,正常',
]

# 请定义 build_equipment_watch(lines)

equipment_report = build_equipment_watch(equipment_lines)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          equipment_report: {
            invalid_count: 2,
            watched_codes: [
              'EQ37788',
              'EQ59001',
            ],
          },
        },
      },
    },
  ],
}
