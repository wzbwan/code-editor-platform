import { ChallengeChapterDefinition } from '@/lib/challenges/types'

export const sequenceSetCampChapter: ChallengeChapterDefinition = {
  key: 'sequence-set-camp',
  title: '数据特工训练营',
  theme: '序列与集合',
  description:
    '你是一名新晋数据特工，需要通过 8 个训练关卡，掌握切片、倒序、集合与集合运算的核心技能。',
  helpDoc: {
    title: '序列与集合帮助文档',
    intro:
      '这一章会用到两类核心知识：序列切片和集合运算。序列更关注“顺序”和“位置”，集合更关注“唯一性”和“成员关系”。',
    sections: [
      {
        title: '1. 切片的基本规则',
        points: [
          '切片格式是 序列[起始:结束:步长]。',
          '切片遵循左闭右开：包含起始位置，不包含结束位置。',
          '起始、结束、步长都可以省略，省略时会按默认方向补齐。',
        ],
        exampleTitle: '示例',
        exampleCode: `letters = ['a', 'b', 'c', 'd', 'e', 'f']\nprint(letters[:3])\nprint(letters[2:5])\nprint(letters[3:])`,
      },
      {
        title: '2. 步长与倒序',
        points: [
          '步长为 2 时表示隔一个取一个，例如 seq[::2]。',
          '步长为负数时表示反方向取值。',
          'seq[::-1] 是最常见的整体倒序写法。',
        ],
        exampleTitle: '示例',
        exampleCode: `nums = [1, 2, 3, 4, 5, 6, 7, 8]\nprint(nums[::2])\nprint(nums[5:1:-1])\nprint(nums[::-1])`,
      },
      {
        title: '3. 序列相加与相乘',
        points: [
          '同类型序列可以相加，结果是拼接后的新序列。',
          '序列乘整数表示重复指定次数。',
          '字符串也属于序列，因此同样支持 + 和 *。',
        ],
        exampleTitle: '示例',
        exampleCode: `part1 = ['甲', '乙']\npart2 = ['丙', '丁']\nprint(part1 + part2)\nprint(part1 * 2)\nprint('Hi' * 3)`,
      },
      {
        title: '4. 集合的特点',
        points: [
          '集合中的元素无序且唯一，重复元素会自动去重。',
          '空集合必须写成 set()，不能写成 {}。',
          '集合常用于去重、查成员关系和做集合运算。',
        ],
        exampleTitle: '示例',
        exampleCode: `tags = ['红', '蓝', '红', '绿']\nunique_tags = set(tags)\nempty_box = set()`,
      },
      {
        title: '5. 集合的常见操作',
        points: [
          'add(x) 添加单个元素，update(iterable) 批量添加。',
          'remove(x) 删除不存在的元素会报错；discard(x) 删除不存在的元素不会报错。',
          'x in s 可以判断元素是否在集合中。',
        ],
        exampleTitle: '示例',
        exampleCode: `tools = {'锤子', '扳手'}\ntools.add('钳子')\ntools.update(['螺丝刀', '卷尺'])\nprint('锤子' in tools)`,
      },
      {
        title: '6. 集合关系与运算符',
        points: [
          '并集可以用 union() 或 |，交集可以用 &。',
          '差集可以用 difference() 或 -。',
          '对称差集可以用 symmetric_difference() 或 ^。',
          'issubset() 判断是否为子集，isdisjoint() 判断是否完全没有交集。',
        ],
        exampleTitle: '示例',
        exampleCode: `group_a = {'甲', '乙', '丙'}\ngroup_b = {'丙', '丁'}\nprint(group_a | group_b)\nprint(group_a & group_b)\nprint(group_a - group_b)\nprint(group_a ^ group_b)`,
      },
    ],
    closingTip: '切片题先画索引，集合题先想“去重、关系、运算”三件事，会更快找到正确做法。',
  },
  levels: [
    {
      key: 'slice-basics',
      title: '第1关：切片初体验',
      summary: '练习基础切片和左闭右开规则。',
      description:
        '任务：请基于 codes 分别得到:(1)前 3 个元素、(2)中间3个元素的切片、(3)从索引 2 到末尾、(4)从开头到索引 5 之前的结果。',
      points: 2,
      initialCode: `codes = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']\n\n# 请把结果保存到 first_three、middle_slice、from_index_two、before_index_five\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_three: ['T1', 'T2', 'T3'],
          middle_slice: ['T3', 'T4', 'T5'],
          from_index_two: ['T3', 'T4', 'T5', 'T6', 'T7'],
          before_index_five: ['T1', 'T2', 'T3', 'T4', 'T5'],
          // slice_rule: '左闭右开',
        },
      },
    },
    {
      key: 'step-slicing',
      title: '第2关：步长密码破译',
      summary: '掌握切片省略写法和步长控制。',
      description:
        '任务：请把 5 个切片结果分别保存到 first_five、from_fourth、every_two、twenty_to_eighty_step_2、twenty_fifty_eighty。',
      points: 3,
      initialCode: `nums = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]\n\n# 请把结果保存到 first_five、from_fourth、every_two、twenty_to_eighty_step_2、twenty_fifty_eighty\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          first_five: [10, 20, 30, 40, 50],
          from_fourth: [40, 50, 60, 70, 80, 90, 100],
          every_two: [10, 30, 50, 70, 90],
          twenty_to_eighty: [20, 40, 60, 80],
          twenty_fifty_eighty: [20, 50, 80],
        },
      },
    },
    {
      key: 'reverse-trace',
      title: '第3关：逆向追踪行动',
      summary: '练习负步长切片和倒序提取情报。',
      description:
        "任务：1. 将 route 整体倒序保存到 reversed_route。2. 从 '机房' 往前取到 '走廊' 保存到 reverse_path。3. 从 msg 中提取情报(提示：4)，保存到 secret_msg。",
      points: 3,
      initialCode: `route = ['入口', '走廊', '实验室', '资料室', '机房', '天台']\nmsg = '今松竹兰晚云山风八海月星点江河湖食春秋夜堂东西南集金木水合'\n\n# 请把结果保存到 reversed_route、reverse_path、secret_msg\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          reversed_route: ['天台', '机房', '资料室', '实验室', '走廊', '入口'],
          reverse_path: ['机房', '资料室', '实验室', '走廊'],
          secret_msg: '今晚八点食堂集合',
        },
      },
    },
    {
      key: 'sequence-combine',
      title: '第4关：序列合体术',
      summary: '掌握序列相加和序列相乘。',
      description:
        '任务：请把 team1 和 team2 的拼接结果保存到 merged_team，把 team1 重复 3 次后的结果保存到 repeated_team1，把 word 重复 4 次后的结果保存到 repeated_word。',
      points: 2,
      initialCode: `team1 = ['侦察员', '分析员']\nteam2 = ['通信员', '行动员']\nword = 'Go'\n\n# 请把结果保存到 merged_team、repeated_team1、repeated_word\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          merged_team: ['侦察员', '分析员', '通信员', '行动员'],
          repeated_team1: ['侦察员', '分析员', '侦察员', '分析员', '侦察员', '分析员'],
          repeated_word: 'GoGoGoGo',
        },
      },
    },
    {
      key: 'set-deduplicate',
      title: '第5关：去重神殿',
      summary: '认识集合的唯一性和空集合定义方式。',
      description:
        '任务：请把 names 转成集合并保存到 unique_names，再定义一个空集合保存到 empty_group。',
      points: 2,
      initialCode: `names = ['长刀', '短弓', '长刀', '铁盾', '短弓', '木枪']\n\n# 请把结果保存到 unique_names 和 empty_group\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          unique_names: ['木枪', '短弓', '铁盾', '长刀'],
          empty_group: [],
        },
      },
    },
    {
      key: 'set-actions',
      title: '第6关：集合操作训练',
      summary: '练习集合的添加、批量添加、删除与成员判断。',
      description:
        "任务：1. 按要求修改 weapons。(1)添加‘木枪’(2)添加['银刀','石斧'](3)删除'短弓'2. 将操作后的集合保存到 final_weapons。",
      points: 3,
      initialCode: `weapons = {'长刀', '短弓', '铁盾'}\nnew_weapons=["银刀","石斧"]\n\n# 请把结果保存到 final_weapons\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          final_weapons: ['木枪', '石斧', '铁盾', '银刀', '长刀']
        },
      },
    },
    {
      key: 'alliance-check',
      title: '第7关：失落联盟的身份核验',
      summary: '掌握并集、差集、子集和无交集判断。',
      description:
        '任务：请把 a 和 b 的并集保存到 all_members，把 a 相对 b 的差集保存到 a_only_members，把 c 是否是 a 的子集保存到 c_is_subset，把 a 和 d 的交集保存到 a_d_common。',
      points: 4,
      initialCode: `a = {'林澈', '苏禾', '顾言', '沈舟'}\nb = {'顾言', '沈舟', '许诺', '江临'}\nc = {'顾言', '沈舟'}\nd = {'唐陌', '秦野', '苏禾'}\n\n# 请把结果保存到 all_members、a_only_members、c_is_subset、a_d_common\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          all_members: ['林澈', '江临', '沈舟', '苏禾', '许诺', '顾言'],
          a_only_members: ['林澈', '苏禾'],
          c_is_subset: true,
          a_d_common: ['苏禾'],
        },
      },
    },
    {
      key: 'rune-battle',
      title: '第8关：终极集合对决',
      summary: '使用集合运算符完成并集、交集、差集和对称差集。',
      description:
        '任务：请把 s1 和 s2 的并集、交集、差集、对称差集，分别保存到 all_runes、shared_runes、s1_only_runes、symmetric_runes。',
      points: 4,
      initialCode: `s1 = {'火焰符文', '寒冰符文', '疾风符文', '岩土符文', '雷电符文', '光明符文'}\ns2 = {'岩土符文', '雷电符文', '光明符文', '暗影符文', '虚空符文', '星辉符文'}\n\n# 请把结果保存到 all_runes、shared_runes、s1_only_runes、symmetric_runes\n`,
      judge: {
        mode: 'VARIABLES',
        expectedVariables: {
          all_runes: ['光明符文', '寒冰符文', '岩土符文', '星辉符文', '暗影符文', '火焰符文', '疾风符文', '虚空符文', '雷电符文'],
          shared_runes: ['光明符文', '岩土符文', '雷电符文'],
          s1_only_runes: ['寒冰符文', '火焰符文', '疾风符文'],
          symmetric_runes: ['寒冰符文', '星辉符文', '暗影符文', '火焰符文', '疾风符文', '虚空符文'],
        },
      },
    },
  ],
}
