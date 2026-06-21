import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const policeDutyDataCenterChapter: ChallengeChapterDefinition = {
  key: 'police-duty-data-center',
  title: '警务值班数据中心',
  theme: 'Python 基础综合闯关',
  description: '你是警务值班室的数据助理，需要用 Python 整理接警单、巡逻队列、警情分类、车辆关注名单和每日警务报告。',
  helpDoc: {
    title: '警务数据闯关提示卡',
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
        exampleCode: 'raw = \'  J001-北区-已接警  \'\\nclean = raw.strip()\\nparts = clean.split(\'-\')',
      },
      {
        title: '2. 分支、循环与容器',
        points: [
          'if、elif、else 适合根据分数、状态、人数等条件分类，边界值要写成 >= 或 <=。',
          '列表适合保存有顺序的数据，append、insert、pop、remove、len 都是常见操作。',
          '集合适合去重，字典适合保存 key 到 value 的映射；遍历字典时可以使用 for key in 字典。',
        ],
        exampleTitle: '示例',
        exampleCode: 'levels = []\\nfor score in scores:\\n    if score >= 90:\\n        levels.append(\'红色预警\')',
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
      key: 'create-case-card',
      title: '第1关：填写接警单',
      summary: '补全基础变量，并整理成接警单字典。',
      description: '任务：请补全代码，创建一张接警单。警情编号 case_id 为 \'NM-2026-001\'；风险分 risk_score 为整数 3。最后保持 case_card 字典内容正确。',
      points: 2,
      initialCode: `case_id = None
risk_score = None

case_card = {
    'case_id': case_id,
    'risk_score': risk_score,
}
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          case_card: {
            case_id: 'NM-2026-001',
            risk_score: 3,
          },
        },
      },
    },
    {
      key: 'prepare-patrol-route',
      title: '第2关：准备巡逻路线',
      summary: '补全列表、索引取值和长度统计。',
      description: '任务：请补全代码。patrol_points 是列表，依次为 \'gate-n\'、\'gate-e\'、\'gate-s\'、\'gate-w\'。',
      points: 2,
      initialCode: `patrol_points = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          patrol_points: [
            'gate-n',
            'gate-e',
            'gate-s',
            'gate-w',
          ],
        },
      },
    },
    {
      key: 'prepare-patrol-route2',
      title: '第3关：锁定巡逻路线',
      summary: '列表索引取值。',
      description: '任务：请补全代码。patrol_points 是列表，依次为 \'gate-n\'、\'gate-e\'、\'gate-s\'、\'gate-w\'；first_point 保存 patrol_points 的第一个点位；last_point 保存最后一个点位。',
      points: 2,
      initialCode: `patrol_points = ['gate-n', 'gate-e', 'gate-s', 'gate-w']
first_point = None
last_point = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_point: 'gate-n',
          last_point: 'gate-w',
        },
      },
    },
    {
      key: 'clean-alarm-text',
      title: '第4关：清洗接警文本',
      summary: '使用 split 处理一条接警文本。',
      description: '任务：raw_alarm 中保存了一条接警文本。请保存 parts 为按 \'-\' 拆分后的列表。',
      points: 3,
      initialCode: `raw_alarm = '110-青城派出所-噪音警情-已接警'
# 提示：字符串切割方法为 字符串.split(分隔符)
parts = None
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          parts: [
            '110',
            '青城派出所',
            '噪音警情',
            '已接警',
          ],
        },
      },
    },

    {
      key: 'fix-dispatch-queue',
      title: '第5关：修复出警队列1',
      summary: '列表增改代码，得到正确出警队列。',
      description: '请完成队列整理：在队尾追加 \'巡逻D组\'。',
      points: 3,
      initialCode: `queue = ['巡逻A组', '巡逻B组', '巡逻C组']

# 提示：列表常用的方法有 append, extend, insert, pop, remove, sort等

`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '巡逻A组',
            '巡逻B组',
            '巡逻C组',
            '巡逻D组',
          ],
        },
      },
    },
    {
      key: 'fix-dispatch-queue2',
      title: '第6关：修复出警队列2',
      summary: '列表增改代码，得到正确出警队列。',
      description: '请完成队列整理：把 \'巡逻C组\' 改成 \'视频巡查组\'。',
      points: 3,
      initialCode: `queue = ['巡逻A组', '巡逻B组', '巡逻C组', '巡逻D组']
# 提示：列表可通过索引获取或修改元素

`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          queue: [
            '巡逻A组',
            '巡逻B组',
            '视频巡查组',
            '巡逻D组',
          ],
        },
      },
    },
    {
      key: 'fix-risk-levels',
      title: '第7关：修复预警等级',
      summary: '修复分支边界条件和列表追加内容。',
      description: '下面代码有错误。请修复。规则：90 分及以上为 \'红色预警\'；70 到 89 为 \'橙色关注\'；40 到 69 为 \'黄色观察\'；40 以下为 \'绿色正常\'。最后保存风险等级列表 risk_levels。',
      points: 4,
      initialCode: `scores = [95, 70, 40, 12, 90]
risk_levels = []

for score in scores:
    if score >= 90:
        level = '红色预警'
    elif score >= 70:
        level = '橙色关注'
    elif score >= 40:
        level = '黄色观察'
    else:
        level = '绿色正常'
    risk_levels.append(score)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          risk_levels: [
            '红色预警',
            '橙色关注',
            '黄色观察',
            '绿色正常',
            '红色预警',
          ],
        },
      },
    },
    {
      key: 'fix-valid-call-types',
      title: '第8关：修复警情类型统计',
      summary: '过滤空值和重复项，统计有效警情类型。',
      description: '下面代码要统计有效警情类型。空字符串和 None 不计入有效警情。请修复代码，保存 valid_types 和 valid_count。',
      points: 4,
      initialCode: `call_types = ['噪音', '走失', '诈骗', '', '交通', None, '求助', '盗窃']

valid_types = []
valid_count = 0

for call_type in call_types:
    # 请在此处补充代码，使结果正确

    valid_types.append(call_type)
    valid_count = valid_count + 1
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          valid_types: [
            '噪音',
            '走失',
            '诈骗',
            '交通',
            '求助',
            '盗窃',
          ],
          valid_count: 6,
        },
      },
    },
    {
      key: 'count-incident-status',
      title: '第9关：统计警情状态',
      summary: '用循环和分支统计已处置数量、待跟进编号和涉及人数。',
      description: '任务：incidents 中每个字典是一条警情。请用循环完成：pending_ids 为 status 等于 \'待跟进\' 的警情编号列表，按出现顺序保存；total_people 为所有警情涉及人数合计。',
      points: 4,
      initialCode: `incidents = [
    {'id': 'J001', 'type': '求助', 'status': '已处置', 'people': 2},
    {'id': 'J002', 'type': '纠纷', 'status': '待跟进', 'people': 4},
    {'id': 'J003', 'type': '交通', 'status': '已处置', 'people': 1},
    {'id': 'J004', 'type': '走失', 'status': '待跟进', 'people': 1},
]

pending_ids = []
total_people = 0

# 请用循环保存 pending_ids、total_people
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          pending_ids: [
            'J002',
            'J004',
          ],
          total_people: 8,
        },
      },
    },
    {
      key: 'sort-alert-board',
      title: '第10关：整理预警看板',
      summary: '使用列表推导式和 lambda 排序整理预警数据。',
      description: '任务：alerts 中每个字典是一条预警。请完成：high_alert_ids 为 score 大于等于 80 的编号列表，按原顺序保存；sorted_alert_ids 为按 score 从高到低排序后的编号列表。建议使用列表推导式和 sorted(..., key=lambda item: item[\'score\'], reverse=True)。',
      points: 5,
      initialCode: `alerts = [
    {'id': 'A01', 'area': '北区', 'score': 82},
    {'id': 'A02', 'area': '南区', 'score': 57},
    {'id': 'A03', 'area': '东区', 'score': 95},
    {'id': 'A04', 'area': '西区', 'score': 70},
]

# 请保存 high_alert_ids、sorted_alerts、sorted_alert_ids
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          high_alert_ids: [
            'A01',
            'A03',
          ],
          sorted_alert_ids: [
            'A03',
            'A01',
            'A04',
            'A02',
          ],
        },
      },
    },
    {
      key: 'build-daily-duty-report',
      title: '第11关：生成民警考核结果',
      summary: '根据民警考核数据，计算综合成绩并划分等级。',
      description: '任务：officers 中每个元素是一名民警的考核数据，包括(姓名, 体能成绩, 理论成绩, 射击成绩)。请生成新列表 result。result 中的元素是元组，包含：(姓名,总分,评价等级)。总分为体能成绩、理论成绩、射击成绩三项之和；评价等级 根据综合成绩划分：270 分及以上为 "优秀"，240 到 269 分为 "良好"，240 分以下为 "不合格"。',
      points: 5,
      initialCode: `officers = [
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
            ['李明', 271, '优秀'],
            ['王芳', 261, '良好'],
            ['张伟', 240, '良好'],
            ['赵敏', 285, '优秀'],
            ['刘强', 218, '不合格'],
            ['陈晨', 255, '良好'],
            ['孙磊', 193, '不合格'],
            ['周静', 271, '优秀'],
          ],
        },
      },
    },
    {
      key: 'build-vehicle-watch',
      title: '第12关：整理车辆关注名单',
      summary: '定义函数，解析字符串记录并生成车辆关注报告。',
      description: '任务：定义函数 build_vehicle_watch(lines)。每条有效记录格式为 \'车牌,辖区,状态\'。要求：空字符串和拆分后不是 3 段的记录算 invalid_count；watched_plates 为状态等于 \'重点\' 的车牌列表。最后调用函数并保存 vehicle_report。\n vehicle_report为字典，包含invalid_count和watched_plates两个键。',
      points: 5,
      initialCode: `vehicle_lines = [
    '蒙A21023,北区,正常',
    '蒙B37788,南区,重点',
    '',
    '蒙A41023,北区,正常',
    '蒙C59001,东区,重点',
    '错误记录',
    '蒙D63366,北区,正常',
]

# 请定义 build_vehicle_watch(lines)

vehicle_report = build_vehicle_watch(vehicle_lines)
`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          vehicle_report: {
            invalid_count: 2,
            watched_plates: [
              '蒙B37788',
              '蒙C59001',
            ],
          },
        },
      },
    },
    
  ],
}
