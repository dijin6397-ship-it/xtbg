import { reactive } from 'vue'

const priorityMap = {
  urgent: { label: '紧急', color: '#ff4d4f', bg: '#fff2f0' },
  high:   { label: '重要', color: '#fa8c16', bg: '#fff7e6' },
  normal: { label: '普通', color: '#1677ff', bg: '#e6f4ff' },
  low:    { label: '低优', color: '#8c8c8c', bg: '#f5f5f5' }
}

const statusMap = {
  pending:     { label: '待开始',   color: '#8c8c8c', bg: '#f5f5f5' },
  decomposing: { label: '分解中',   color: '#722ed1', bg: '#f9f0ff' },
  in_progress: { label: '进行中',   color: '#1677ff', bg: '#e6f4ff' },
  feedback:    { label: '反馈中',   color: '#13c2c2', bg: '#e6fffb' },
  review:      { label: '待验收',   color: '#fa8c16', bg: '#fff7e6' },
  completed:   { label: '已完成',   color: '#52c41a', bg: '#f6ffed' },
  overdue:     { label: '已逾期',   color: '#ff4d4f', bg: '#fff2f0' },
  cancelled:   { label: '已撤回',   color: '#8c8c8c', bg: '#f5f5f5' }
}

const departments = ['技术质量部']

const users = [
  // 管理层
  { id: 1,  name: '翁晓瑜', dept: '技术质量部', role: 'admin',       title: '管理员' },
  { id: 2,  name: '关宇敬', dept: '技术质量部', role: 'leader',      title: '总经理助理' },
  { id: 3,  name: '付巍',   dept: '技术质量部', role: 'leader',      title: '技术总监' },
  { id: 4,  name: '徐文彬', dept: '技术质量部', role: 'leader',      title: '部门副经理' },
  // 部门主管
  { id: 5,  name: '杨晨',   dept: '技术质量部', role: 'supervisor',  title: '机械主管' },
  { id: 6,  name: '曹毅峰', dept: '技术质量部', role: 'supervisor',  title: '电气主管' },
  { id: 7,  name: '杜晔昕', dept: '技术质量部', role: 'supervisor',  title: '设备主管' },
  { id: 8,  name: '李俊南', dept: '技术质量部', role: 'supervisor',  title: '研发主管' },
  { id: 9,  name: '蔡峥',   dept: '技术质量部', role: 'supervisor',  title: '质量主管' },
  // 部门人员
  { id: 10, name: '姚毅超', dept: '技术质量部', role: 'staff' },
  { id: 11, name: '施云杰', dept: '技术质量部', role: 'staff' },
  { id: 12, name: '郑李鼎邦', dept: '技术质量部', role: 'staff' },
  { id: 13, name: '吉自伟', dept: '技术质量部', role: 'staff' },
  { id: 14, name: '周天怡', dept: '技术质量部', role: 'staff' },
  { id: 15, name: '尤文杰', dept: '技术质量部', role: 'staff' },
  { id: 16, name: '施逸飞', dept: '技术质量部', role: 'staff' },
  { id: 17, name: '吴闵雯', dept: '技术质量部', role: 'staff' },
  { id: 18, name: '郑一鸣', dept: '技术质量部', role: 'staff' },
  { id: 19, name: '姜东昕', dept: '技术质量部', role: 'staff' },
  { id: 20, name: '苏丹',   dept: '技术质量部', role: 'staff' },
  { id: 21, name: '赵滨钰', dept: '技术质量部', role: 'staff' },
  { id: 22, name: '高英特', dept: '技术质量部', role: 'staff' },
  { id: 23, name: '龚凯华', dept: '技术质量部', role: 'staff' }
]

let nextId = 9

const store = reactive({
  tasks: [
    // 任务1: 生产异常处置 - 进行中
    {
      id: 1,
      title: '生产异常处置（3号线电气故障）',
      description: '3号线生产过程中出现电气控制系统异常，PLC通讯中断导致产线停机。需要紧急排查故障原因，提供技术方案并进行现场技术支持，同时下发技术通知。',
      publisher: users[1], assignees: [users[9], users[10]], department: '技术质量部',
      priority: 'urgent', status: 'in_progress', progress: 55,
      deadline: '2026-05-20', createdAt: '2026-05-17', tags: ['生产异常', '紧急', '电气'],
      supervisor: users[2], urgCount: 1,
      subtasks: [
        { id: 101, title: '钉钉生产异常回复与初步诊断', assignee: users[5], status: 'completed', progress: 100 },
        { id: 102, title: '现场技术支持与故障排查', assignee: users[9], status: 'in_progress', progress: 60 },
        { id: 103, title: '技术方案编写与下发', assignee: users[10], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 1, user: users[5], type: 'progress', content: '已回复生产异常工单，初步判断为PLC通讯模块故障', time: '2026-05-17 09:30' },
        { id: 2, user: users[9], type: 'progress', content: '现场排查中，已定位到具体故障点位，正在更换通讯模块', time: '2026-05-17 14:00' },
        { id: 3, user: users[1], type: 'comment', content: '请尽快恢复产线运行，生产任务紧迫', time: '2026-05-18 08:30' }
      ],
      milestones: [
        { title: '异常回复与诊断', done: true, date: '2026-05-17' },
        { title: '现场技术支持', done: false, date: '2026-05-18' },
        { title: '技术方案下发', done: false, date: '2026-05-19' },
        { title: '问题闭环确认', done: false, date: '2026-05-20' }
      ]
    },
    // 任务2: BOM编制 - 分解中
    {
      id: 2,
      title: '新产品BOM编制（必换件/偶换件/辅料/紧固件）',
      description: '完成新产品V3.2版本的完整BOM编制工作，包括必换件、偶换件、必换件-定制件、辅料、紧固件、工装、工具、消耗工具等类别。',
      publisher: users[2], assignees: [users[13], users[14]], department: '技术质量部',
      priority: 'high', status: 'decomposing', progress: 15,
      deadline: '2026-05-28', createdAt: '2026-05-15', tags: ['BOM', '编制', '新产品'],
      supervisor: users[3], urgCount: 0,
      subtasks: [
        { id: 201, title: '必换件BOM编制', assignee: users[13], status: 'pending', progress: 0 },
        { id: 202, title: '偶换件及辅料BOM编制', assignee: users[14], status: 'pending', progress: 0 },
        { id: 203, title: '紧固件/工装/工具BOM编制', assignee: users[7], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 4, user: users[7], type: 'progress', content: '已收到BOM编制任务，正在收集设计图纸和物料清单', time: '2026-05-16 10:00' }
      ],
      milestones: [
        { title: '设计图纸收集', done: true, date: '2026-05-17' },
        { title: 'BOM分类编制', done: false, date: '2026-05-22' },
        { title: 'BOM审核校验', done: false, date: '2026-05-25' },
        { title: 'BOM定稿发布', done: false, date: '2026-05-28' }
      ]
    },
    // 任务3: 工艺编制 - 待开始
    {
      id: 3,
      title: '箱体焊接工艺规程编制',
      description: '根据设计图纸要求，编制箱体结构件的焊接工艺规程，包括焊接方法选择、焊接参数设定、焊后检验要求等。',
      publisher: users[3], assignees: [users[11]], department: '技术质量部',
      priority: 'normal', status: 'pending', progress: 0,
      deadline: '2026-05-30', createdAt: '2026-05-19', tags: ['工艺', '焊接'],
      supervisor: users[3], urgCount: 0,
      subtasks: [],
      feedbacks: [],
      milestones: [
        { title: '图纸工艺性审查', done: false, date: '2026-05-22' },
        { title: '工艺规程编制', done: false, date: '2026-05-27' },
        { title: '规程审核批准', done: false, date: '2026-05-30' }
      ]
    },
    // 任务4: 售后故障问题分析 - 已逾期
    {
      id: 4,
      title: '售后故障问题分析（客户反馈液压系统泄漏）',
      description: '分析某客户反馈的液压系统泄漏问题，找出根本原因并制定改进措施。需提交故障分析报告和纠正预防措施。',
      publisher: users[1], assignees: [users[12], users[13]], department: '技术质量部',
      priority: 'urgent', status: 'overdue', progress: 45,
      deadline: '2026-05-15', createdAt: '2026-05-08', tags: ['售后', '故障分析', '液压'],
      supervisor: users[4], urgCount: 3,
      subtasks: [
        { id: 401, title: '故障现象收集与复现', assignee: users[12], status: 'completed', progress: 100 },
        { id: 402, title: '根本原因分析', assignee: users[13], status: 'in_progress', progress: 50 },
        { id: 403, title: '纠正预防措施制定', assignee: users[12], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 5, user: users[12], type: 'progress', content: '已收集到3起同类故障案例，正在整理故障共性', time: '2026-05-11 16:00' },
        { id: 6, user: users[13], type: 'progress', content: '初步分析为密封圈材质问题，需要进一步验证', time: '2026-05-14 11:30' },
        { id: 7, user: users[1], type: 'comment', content: '客户催得紧，请加快分析进度', time: '2026-05-16 09:00' },
        { id: 8, user: users[1], type: 'comment', content: '任务已逾期，请务必在本周内完成', time: '2026-05-19 08:30' }
      ],
      milestones: [
        { title: '故障信息收集', done: true, date: '2026-05-10' },
        { title: '原因分析', done: false, date: '2026-05-15' },
        { title: '改进措施制定', done: false, date: '2026-05-18' },
        { title: '报告提交', done: false, date: '2026-05-20' }
      ]
    },
    // 任务5: 工艺验证评定 - 进行中
    {
      id: 5,
      title: '焊接工艺评定（WPS/PQR）',
      description: '对新编制的焊接工艺规程进行工艺评定试验，验证焊接工艺的可行性，出具评定报告。',
      publisher: users[2], assignees: [users[14], users[15]], department: '技术质量部',
      priority: 'high', status: 'in_progress', progress: 65,
      deadline: '2026-05-25', createdAt: '2026-05-10', tags: ['工艺验证', '焊接', 'WPS'],
      supervisor: users[2], urgCount: 0,
      subtasks: [
        { id: 501, title: '试件准备与焊接', assignee: users[14], status: 'completed', progress: 100 },
        { id: 502, title: '无损检测与力学试验', assignee: users[15], status: 'in_progress', progress: 70 },
        { id: 503, title: '评定报告编写', assignee: users[14], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 9, user: users[14], type: 'progress', content: '试件已焊接完成，外观检查合格', time: '2026-05-14 15:00' },
        { id: 10, user: users[15], type: 'progress', content: 'RT检测已完成，力学试验进行中', time: '2026-05-17 16:30' }
      ],
      milestones: [
        { title: '试件焊接', done: true, date: '2026-05-14' },
        { title: '无损检测', done: true, date: '2026-05-17' },
        { title: '力学试验', done: false, date: '2026-05-20' },
        { title: '评定报告', done: false, date: '2026-05-25' }
      ]
    },
    // 任务6: 定制件管理 - 待验收
    {
      id: 6,
      title: '定制件清单更新与跟踪管理',
      description: '更新本季度定制件清单，跟踪各定制件的加工进度、质量状态和到货计划。',
      publisher: users[3], assignees: [users[16]], department: '技术质量部',
      priority: 'normal', status: 'review', progress: 90,
      deadline: '2026-05-18', createdAt: '2026-05-06', tags: ['定制件', '管理'],
      supervisor: users[6], urgCount: 0,
      subtasks: [
        { id: 601, title: '定制件清单梳理', assignee: users[16], status: 'completed', progress: 100 },
        { id: 602, title: '加工进度跟踪', assignee: users[16], status: 'completed', progress: 100 },
        { id: 603, title: '到货计划确认', assignee: users[16], status: 'in_progress', progress: 80 }
      ],
      feedbacks: [
        { id: 11, user: users[16], type: 'progress', content: '定制件清单已更新完毕，共梳理67项定制件', time: '2026-05-10 14:00' },
        { id: 12, user: users[16], type: 'progress', content: '加工进度跟踪完成，5项定制件存在延期风险', time: '2026-05-15 11:00' }
      ],
      milestones: [
        { title: '清单梳理', done: true, date: '2026-05-10' },
        { title: '进度跟踪', done: true, date: '2026-05-15' },
        { title: '计划确认', done: false, date: '2026-05-18' }
      ]
    },
    // 任务7: 重大质量问题分析 - 反馈中
    {
      id: 7,
      title: '重大质量问题分析（整机性能不达标）',
      description: '某批次产品出厂测试中发现整机性能指标未达到设计要求，需要组织技术力量进行系统性分析，找出关键影响因素。',
      publisher: users[1], assignees: [users[17], users[18]], department: '技术质量部',
      priority: 'urgent', status: 'feedback', progress: 70,
      deadline: '2026-05-22', createdAt: '2026-05-12', tags: ['质量', '重大问题', '性能'],
      supervisor: users[1], urgCount: 2,
      subtasks: [
        { id: 701, title: '测试数据汇总分析', assignee: users[17], status: 'completed', progress: 100 },
        { id: 702, title: '关键零部件检测', assignee: users[18], status: 'completed', progress: 100 },
        { id: 703, title: '影响因素定位', assignee: users[17], status: 'in_progress', progress: 80 },
        { id: 704, title: '改进方案制定', assignee: users[18], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 13, user: users[17], type: 'progress', content: '测试数据分析完成，发现液压泵效率偏低是主因', time: '2026-05-16 10:00' },
        { id: 14, user: users[18], type: 'progress', content: '关键零部件检测完毕，液压泵实际流量低于标称值8%', time: '2026-05-18 14:30' },
        { id: 15, user: users[1], type: 'comment', content: '问题严重，需尽快给出改进方案', time: '2026-05-19 09:00' }
      ],
      milestones: [
        { title: '数据汇总', done: true, date: '2026-05-15' },
        { title: '零部件检测', done: true, date: '2026-05-18' },
        { title: '因素定位', done: false, date: '2026-05-20' },
        { title: '改进方案', done: false, date: '2026-05-22' }
      ]
    },
    // 任务8: 委外技规编制 - 已完成
    {
      id: 8,
      title: '委外加工技术规范编制（热处理工艺）',
      description: '编制热处理委外加工的技术规范文件，明确工艺要求、质量标准和验收准则。',
      publisher: users[2], assignees: [users[19], users[20]], department: '技术质量部',
      priority: 'normal', status: 'completed', progress: 100,
      deadline: '2026-05-15', createdAt: '2026-05-03', tags: ['委外', '技规', '热处理'],
      supervisor: users[3], urgCount: 0,
      subtasks: [
        { id: 801, title: '工艺要求梳理', assignee: users[19], status: 'completed', progress: 100 },
        { id: 802, title: '技术规范编写', assignee: users[20], status: 'completed', progress: 100 },
        { id: 803, title: '内部评审与批准', assignee: users[19], status: 'completed', progress: 100 }
      ],
      feedbacks: [
        { id: 16, user: users[19], type: 'progress', content: '工艺要求已梳理完成，共涉及12项热处理工艺参数', time: '2026-05-07 15:00' },
        { id: 17, user: users[20], type: 'progress', content: '技术规范初稿完成，已提交内部评审', time: '2026-05-12 11:00' },
        { id: 18, user: users[2], type: 'progress', content: '技术规范已通过评审，正式发布', time: '2026-05-15 16:00' }
      ],
      milestones: [
        { title: '工艺要求梳理', done: true, date: '2026-05-07' },
        { title: '规范编写', done: true, date: '2026-05-12' },
        { title: '评审与批准', done: true, date: '2026-05-15' }
      ]
    },
    // 任务9: 暂缓执行项状态跟踪 - 进行中
    {
      id: 9,
      title: '暂缓执行项状态跟踪（Q2季度）',
      description: '跟踪所有暂缓执行的技术变更项和工艺改进项，定期更新状态，确保在条件具备时及时恢复执行。',
      publisher: users[3], assignees: [users[21]], department: '技术质量部',
      priority: 'low', status: 'in_progress', progress: 40,
      deadline: '2026-06-30', createdAt: '2026-05-05', tags: ['暂缓执行', '跟踪'],
      supervisor: users[4], urgCount: 0,
      subtasks: [
        { id: 901, title: '暂缓项清单更新', assignee: users[21], status: 'completed', progress: 100 },
        { id: 902, title: '状态逐项核实', assignee: users[21], status: 'in_progress', progress: 40 },
        { id: 903, title: '季度跟踪报告', assignee: users[21], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 19, user: users[21], type: 'progress', content: '暂缓项清单已更新，当前共18项暂缓执行项', time: '2026-05-08 10:00' },
        { id: 20, user: users[21], type: 'progress', content: '已核实7项，其中2项条件已具备可恢复执行', time: '2026-05-15 14:00' }
      ],
      milestones: [
        { title: '清单更新', done: true, date: '2026-05-08' },
        { title: '状态核实', done: false, date: '2026-05-30' },
        { title: '季度报告', done: false, date: '2026-06-30' }
      ]
    },
    // 任务10: 拆倒件管理 - 待开始
    {
      id: 10,
      title: '拆倒件技术资料整理与归档',
      description: '整理本年度所有拆倒件的技术资料，包括拆卸方案、零部件检测记录、修复方案等，完成归档。',
      publisher: users[3], assignees: [users[22]], department: '技术质量部',
      priority: 'normal', status: 'pending', progress: 0,
      deadline: '2026-06-15', createdAt: '2026-05-18', tags: ['拆倒件', '归档'],
      supervisor: users[6], urgCount: 0,
      subtasks: [],
      feedbacks: [],
      milestones: [
        { title: '资料收集', done: false, date: '2026-05-30' },
        { title: '资料整理', done: false, date: '2026-06-10' },
        { title: '归档确认', done: false, date: '2026-06-15' }
      ]
    },
    // 任务11: 部件替代申报表 - 分解中
    {
      id: 11,
      title: '部件替代申报表编制（进口件国产化替代）',
      description: '针对3类进口关键零部件进行国产化替代可行性分析，编制部件替代申报表，提交审批。',
      publisher: users[2], assignees: [users[22]], department: '技术质量部',
      priority: 'high', status: 'decomposing', progress: 10,
      deadline: '2026-06-05', createdAt: '2026-05-16', tags: ['部件替代', '国产化'],
      supervisor: users[2], urgCount: 0,
      subtasks: [
        { id: 1101, title: '液压阀组替代分析', assignee: users[22], status: 'pending', progress: 0 },
        { id: 1102, title: '伺服电机替代分析', assignee: users[11], status: 'pending', progress: 0 },
        { id: 1103, title: '传感器替代分析', assignee: users[15], status: 'pending', progress: 0 }
      ],
      feedbacks: [
        { id: 21, user: users[7], type: 'progress', content: '已开始收集替代件的性能参数和供应商信息', time: '2026-05-17 09:00' }
      ],
      milestones: [
        { title: '替代可行性分析', done: false, date: '2026-05-25' },
        { title: '申报表编制', done: false, date: '2026-06-01' },
        { title: '审批提交', done: false, date: '2026-06-05' }
      ]
    },
    // 任务12: 工艺培训 - 反馈中
    {
      id: 12,
      title: '新员工焊接工艺培训',
      description: '对本年度新入职技术人员进行焊接工艺基础知识培训，包括焊接方法、工艺参数、质量控制等。',
      publisher: users[3], assignees: [users[5], users[14]], department: '技术质量部',
      priority: 'normal', status: 'feedback', progress: 80,
      deadline: '2026-05-20', createdAt: '2026-05-06', tags: ['培训', '焊接', '新员工'],
      supervisor: users[3], urgCount: 0,
      subtasks: [
        { id: 1201, title: '培训课件编制', assignee: users[5], status: 'completed', progress: 100 },
        { id: 1202, title: '理论培训授课', assignee: users[14], status: 'completed', progress: 100 },
        { id: 1203, title: '实操培训与考核', assignee: users[5], status: 'in_progress', progress: 60 }
      ],
      feedbacks: [
        { id: 22, user: users[5], type: 'progress', content: '培训课件已完成，共6个章节，42页', time: '2026-05-10 16:00' },
        { id: 23, user: users[14], type: 'progress', content: '理论培训已完成，8人参训，考核平均分87', time: '2026-05-15 17:00' },
        { id: 24, user: users[5], type: 'progress', content: '实操培训进行中，已完成5人考核', time: '2026-05-19 15:30' }
      ],
      milestones: [
        { title: '课件编制', done: true, date: '2026-05-10' },
        { title: '理论培训', done: true, date: '2026-05-15' },
        { title: '实操考核', done: false, date: '2026-05-20' }
      ]
    }
  ],

  supervisionLogs: [
    { id: 1, taskId: 4, type: 'urge', operator: users[1], target: users[12], content: '客户催得紧，售后故障分析请加快进度', time: '2026-05-16 09:00' },
    { id: 2, taskId: 4, type: 'warn', operator: users[1], target: users[13], content: '任务已逾期，请务必本周内完成分析报告', time: '2026-05-19 08:30' },
    { id: 3, taskId: 1, type: 'urge', operator: users[1], target: users[9], content: '3号线电气故障，请尽快恢复产线运行', time: '2026-05-18 08:30' },
    { id: 4, taskId: 7, type: 'escalate', operator: users[1], target: users[17], content: '重大质量问题已升级至总经理关注，请加快分析', time: '2026-05-19 09:00' },
    { id: 5, taskId: 7, type: 'urge', operator: users[1], target: users[18], content: '整机性能问题严重，改进方案需尽快制定', time: '2026-05-19 14:00' }
  ]
})

// Actions
function publishTask(taskData) {
  const task = {
    ...taskData,
    id: nextId++,
    publisher: users[0],
    status: 'pending',
    progress: 0,
    urgCount: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    subtasks: [],
    feedbacks: [],
    comments: []
  }
  store.tasks.unshift(task)
  return task
}

function addSubtasks(taskId, subtasks) {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  let maxSubId = task.subtasks.length > 0 ? Math.max(...task.subtasks.map(s => s.id)) : taskId * 100
  subtasks.forEach(st => {
    task.subtasks.push({
      id: ++maxSubId,
      title: st.title,
      assignee: st.assignee,
      status: 'pending',
      progress: 0
    })
  })
  if (task.status === 'pending') task.status = 'decomposing'
}

function updateSubtask(taskId, subtaskId, updates) {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  const sub = task.subtasks.find(s => s.id === subtaskId)
  if (!sub) return
  Object.assign(sub, updates)
  if (task.subtasks.length > 0) {
    const total = task.subtasks.reduce((sum, s) => sum + s.progress, 0)
    task.progress = Math.round(total / task.subtasks.length)
  }
}

function addFeedback(taskId, feedback) {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  task.feedbacks.push({
    id: Date.now(),
    user: users[0],
    type: feedback.type || 'progress',
    content: feedback.content,
    time: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  })
}

function updateTaskStatus(taskId, status) {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  task.status = status
}

function submitCompleteRequest(taskId) {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  task.status = 'review'
}

function approveTask(taskId) {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  task.status = 'completed'
  task.progress = 100
}

function sendUrge(taskId, content, type = 'urge') {
  const task = store.tasks.find(t => t.id === taskId)
  if (!task) return
  task.urgCount++
  store.supervisionLogs.unshift({
    id: Date.now(),
    taskId,
    type,
    operator: users[0],
    target: task.assignees[0] || task.publisher,
    content,
    time: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  })
}

export {
  store,
  priorityMap,
  statusMap,
  departments,
  users,
  publishTask,
  addSubtasks,
  updateSubtask,
  addFeedback,
  updateTaskStatus,
  submitCompleteRequest,
  approveTask,
  sendUrge
}
