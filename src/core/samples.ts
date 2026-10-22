/** 各图类型的示例数据与提示文案。 */
import type { DiagramType, DiagramData } from './types';

export const SAMPLES: Record<DiagramType, DiagramData> = {
  er: {
    title: '校园二手交易平台E-R图',
    entities: [
      { name: '用户', attributes: ['用户编号', '昵称', '手机号', '登录密码', '注册时间'] },
      { name: '收货地址', attributes: ['地址编号', '收货人', '联系电话', '详细地址', '是否默认', '用户编号'] },
      { name: '商品分类', attributes: ['分类编号', '分类名称', '排序', '创建时间'] },
      { name: '商品', attributes: ['商品编号', '商品名称', '售价', '成色', '上架状态', '发布时间', '分类编号'] },
      { name: '订单', attributes: ['订单编号', '订单金额', '订单状态', '下单时间', '用户编号', '地址编号'] },
      { name: '订单明细', attributes: ['明细编号', '购买数量', '成交单价', '小计', '订单编号', '商品编号'] },
      { name: '评价', attributes: ['评价编号', '评分', '评价内容', '评价时间', '订单编号', '用户编号'] },
      { name: '收藏', attributes: ['收藏编号', '收藏时间', '用户编号', '商品编号'] },
      { name: '举报', attributes: ['举报编号', '举报原因', '处理状态', '举报时间', '用户编号', '商品编号'] }
    ],
    relations: [
      { name: '拥有', from: '用户', to: '收货地址', fromCard: '1', toCard: 'n' },
      { name: '包含', from: '商品分类', to: '商品', fromCard: '1', toCard: 'n' },
      { name: '下达', from: '用户', to: '订单', fromCard: '1', toCard: 'n' },
      { name: '包含', from: '订单', to: '订单明细', fromCard: '1', toCard: 'n' },
      { name: '对应', from: '商品', to: '订单明细', fromCard: '1', toCard: 'n' },
      { name: '产生', from: '订单', to: '评价', fromCard: '1', toCard: '1' },
      { name: '发表', from: '用户', to: '评价', fromCard: '1', toCard: 'n' },
      { name: '添加', from: '用户', to: '收藏', fromCard: '1', toCard: 'n' },
      { name: '被收藏', from: '商品', to: '收藏', fromCard: '1', toCard: 'n' },
      { name: '提交', from: '用户', to: '举报', fromCard: '1', toCard: 'n' },
      { name: '涉及', from: '商品', to: '举报', fromCard: '1', toCard: 'n' }
    ]
  },
  usecase: {
    title: '用户用例图',
    actor: '用户',
    // 示例故意做成两级（一级用例 + 二级功能），让人一眼看到 <<include>> 怎么用。
    // 想回到单列：把 includes 删空即可。
    usecases: [
      { name: '注册账号', includes: ['填写手机号', '获取验证码', '设置密码'] },
      { name: '登录系统', includes: ['账号密码登录', '验证码登录'] },
      { name: '浏览商品' },
      { name: '搜索商品', includes: ['按分类筛选', '按价格排序'] },
      { name: '提交订单', includes: ['选择收货地址', '确认支付方式'] },
      { name: '查看订单', includes: ['查看订单详情', '申请退款'] },
      { name: '评价商品' }
    ]
  },
  functional: {
    title: '基于Spring Boot+Vue的电商系统',
    roles: [
      { name: '管理员', modules: ['登录注册', '用户管理', '商品管理', '分类管理', '订单管理', '评价管理'] },
      { name: '用户', modules: ['登录注册', '商品浏览', '购物车', '订单管理', '个人中心'] }
    ]
  },
  arch: {
    title: '系统总体架构',
    layers: [
      { name: '表现层', items: ['Web 前端', '小程序', '管理后台'] },
      { name: '业务层', items: ['用户服务', '商品服务', '订单服务', '支付服务'] },
      { name: '数据层', items: ['MySQL', 'Redis', '对象存储'] }
    ]
  },
  sequence: {
    title: '用户登录模块时序图',
    actor: '用户',
    lifelines: ['登录页', '接口层', '控制层', '数据访问层'],
    messages: [
      { from: 0, to: 1, text: '1.输入账号密码', kind: 'request' },
      { from: 1, to: 2, text: '2.提交登录请求', kind: 'request' },
      { from: 2, to: 3, text: '3.查询用户表', kind: 'request' },
      { from: 3, to: 2, text: '4.返回用户记录', kind: 'return' },
      { from: 2, to: 2, text: '5.校验账号与密码', kind: 'self' },
      { from: 2, to: 1, text: '6.返回校验结果', kind: 'return' },
      { from: 1, to: 0, text: '7.显示登录成功', kind: 'return' }
    ]
  },
  // 流程图：位置全靠 col / row 网格给出（一格 40px），引擎只算框的大小
  // 间距约定：主干行距 2，判断框前后留 3；分支横向错开 6 列（菱形很宽，4 列会贴住）
  flow: {
    title: '下单流程',
    nodes: [
      { id: 'n1', shape: 'start', text: '开始', col: 5, row: 1 },
      { id: 'n2', shape: 'io', text: '选择商品', col: 5, row: 3 },
      { id: 'n3', shape: 'process', text: '提交订单', col: 5, row: 5 },
      { id: 'n4', shape: 'decision', text: '库存充足？', col: 5, row: 8 },
      { id: 'n5', shape: 'process', text: '生成订单', col: 5, row: 11 },
      { id: 'n6', shape: 'io', text: '支付订单', col: 5, row: 13 },
      { id: 'n7', shape: 'process', text: '打包发货', col: 5, row: 15 },
      { id: 'n8', shape: 'end', text: '结束', col: 5, row: 17 },
      { id: 'n9', shape: 'process', text: '通知补货', col: 11, row: 8 },
      { id: 'n10', shape: 'process', text: '完成补货', col: 11, row: 11 }
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' },
      { from: 'n4', to: 'n5', label: '是' },
      { from: 'n4', to: 'n9', label: '否' },
      { from: 'n9', to: 'n10' },
      { from: 'n10', to: 'n5' },
      { from: 'n5', to: 'n6' },
      { from: 'n6', to: 'n7' },
      { from: 'n7', to: 'n8' }
    ]
  },
  // 泳道图：列 = 角色，行 = 阶段，节点只要说清 lane / stage
  swim: {
    title: '员工报销审批流程',
    lanes: ['员工', '主管', '财务'],
    stages: ['提交申请', '审核审批', '付款归档'],
    nodes: [
      { id: 'n1', kind: 'process', text: '填写报销单', lane: 1, stage: 1 },
      { id: 'n2', kind: 'io', text: '上传发票', lane: 1, stage: 1 },
      { id: 'n3', kind: 'process', text: '主管审批', lane: 2, stage: 2 },
      { id: 'n4', kind: 'decision', text: '超 5000？', lane: 2, stage: 2 },
      { id: 'n5', kind: 'process', text: '财务复核', lane: 3, stage: 2 },
      { id: 'n6', kind: 'process', text: '打款', lane: 3, stage: 3 },
      { id: 'n7', kind: 'end', text: '收到通知', lane: 1, stage: 3 }
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' },
      { from: 'n4', to: 'n5', label: '是' },
      { from: 'n4', to: 'n6', label: '否' },
      { from: 'n5', to: 'n6' },
      { from: 'n6', to: 'n7' }
    ]
  },
  // 类图：每个类填 col / row（网格，从 1 开始），框的大小按内容自动算
  class: {
    title: '订单模块类图',
    classes: [
      {
        id: 'User', name: 'User', col: 1, row: 1,
        attributes: ['+ id: Long', '+ name: String', '+ phone: String'],
        methods: ['+ login(): boolean', '+ placeOrder(): Order']
      },
      {
        id: 'Order', name: 'Order', col: 1, row: 3,
        attributes: ['+ id: Long', '+ amount: BigDecimal', '+ status: String'],
        methods: ['+ pay(): void', '+ cancel(): void']
      },
      {
        id: 'OrderItem', name: 'OrderItem', col: 1, row: 5,
        attributes: ['+ id: Long', '+ quantity: int', '+ price: BigDecimal'],
        methods: ['+ subtotal(): BigDecimal']
      },
      {
        id: 'Payment', name: 'Payment', stereotype: '<<interface>>', col: 3, row: 1,
        methods: ['+ pay(order: Order): boolean', '+ refund(order: Order): boolean']
      },
      {
        id: 'Alipay', name: 'AlipayPayment', col: 3, row: 3,
        attributes: ['+ appId: String'],
        methods: ['+ pay(order: Order): boolean']
      },
      {
        id: 'Product', name: 'Product', col: 3, row: 5,
        attributes: ['+ id: Long', '+ title: String', '+ price: BigDecimal'],
        methods: ['+ isOnSale(): boolean']
      }
    ],
    relations: [
      { from: 'User', to: 'Order', kind: 'association', label: '下达' },
      { from: 'Order', to: 'OrderItem', kind: 'composition', label: '包含' },
      { from: 'OrderItem', to: 'Product', kind: 'association' },
      { from: 'Order', to: 'Payment', kind: 'association', label: '支付方式' },
      { from: 'Alipay', to: 'Payment', kind: 'implements' }
    ]
  }
};

export const HINTS: Record<DiagramType, string> = {
  er: '<b>ER 图（分离式）</b>　先「添加实体」并填写属性，再「添加联系」把两个实体连起来（起点/终点基数选 1 或 n）。会渲染成「1 张总 E-R 图 + 每个实体 1 张属性图」。想省事可以点右上角「复制提示词」，让网页版 AI 直接生成 JSON。',
  usecase: '<b>用例图</b>　每次只画一个角色：填角色名称，再逐个添加用例。想画成两级（一级用例 + 二级功能），展开某个用例，在「二级功能」里添加几项，右侧会自动生成带 &lt;&lt;include&gt;&gt; 的虚线。',
  functional: '<b>功能模块图</b>　填系统名称，再添加「分组」并挂上功能模块。分组有两种分法：<b>按用户角色</b>（学生端 / 教师端 / 管理端）或<b>按功能模块</b>（用户管理 / 设备管理），同一张图只用一种。分组多时可以选「上下布局」，把分组连同模块分列系统两侧。',
  arch: '<b>系统架构图</b>　一条横带就是一层（如 表现层 / 业务层 / 数据层），带内填该层的组件或技术，层与层之间自动画向下箭头。数组顺序即从上到下的顺序。',
  sequence: '<b>时序图</b>　角色固定在最左列，生命线依次向右排。逐条添加消息，选择「从 / 到」和类型（请求 / 返回 / 自调用）即可，激活条会自动计算。',
  flow: '<b>流程图</b>　这张图的<b>位置全靠你（或 AI）给</b>：每个节点填「列 / 行」两个数字，同一行自动对齐、同一列自动对齐，框的大小按文字自动算。形状可选 开始 / 结束 / 处理 / 判断 / 输入输出。觉得不理想就导出 drawio 自己拖。',
  swim: '<b>泳道图</b>　横轴是「谁负责」，纵轴是「流程走到哪一步」。先在上面的「泳道 / 阶段」里填名称，再给每个节点填<b>第几列第几行</b>。一个格子可以放多个节点（从上往下叠），跨泳道的连线会自动走成正交折线。',
  class: '<b>类图</b>　三段式类框：类名 / 属性 / 方法，<b>一行一条</b>（例如「+ id: Long」）。位置填「列 / 行」（网格，从 1 开始），框的大小按内容自动算。关系分 6 种：继承、实现、组合、聚合、关联、依赖，箭头样式按 UML 约定自动画 —— 组合的菱形画在「from」那一端，继承的空心三角指向「to」。'
};
