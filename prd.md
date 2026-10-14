# Rent vs Buy PRD
agent plan:{
  "summary": "- 已把两条新口径写入文档：`房租增长率 = CPI 增长率`，`装修 30 万纳入买房现金流并进入 config.yaml`\n- 已更新 [readme.md](c:\\Users\\Administrator\\PycharmProjects\\rentVSbuy\\readme.md) 和 [prd.md](c:\\Users\\Administrator\\PycharmProjects\\rentVSbuy\\prd.md)，明确四组情景、append 输出、计划新增文件与阶段拆分\n- 已写入详细实现计划到 `C:\\Users\\Administrator\\.copilot\\session-state\\a8b8ed7b-674c-4ee5-9bee-ab74cfcda01a\\plan.md`\n- 实施顺序已拆为：`config.yaml` → 宏观路径 → 买房现金流 → 租房现金流 → 情景输出 → 图表 → 文档收口\n- 仍待锁定 3 个实现细节：`n` 的正式口径、是否保留 `FV`、append 输出优先用 `csv` 还是 `parquet`",
  "actions": [
    "exit_only",
    "interactive",
    "autopilot"
  ],
  "recommendedAction": "interactive"
}
## 文档定位

本文件面向内部分析与建模，用于沉淀项目的目标、边界、假设、变量定义、计算流程、输出形式、配置口径与实施计划。对外介绍、仓库结构与当前状态见 [readme.md](c:\Users\Administrator\PycharmProjects\rentVSbuy\readme.md)。

## 目标问题

在同等房源、同等居住期限下，比较“租房”与“买房”两个方案的现金流与折现结果，回答以下问题：

1. 哪个方案的资金压力更小？
2. 哪个方案的现值更优？
3. 不同情景和输入下，结论是否变化？
4. 画线展示实时的PV增长情况，如果有交叉，哪一年发生的交叉
5. 输出应当支持 append，而不是每次覆写，方便后续多轮对比。

## 情景组合

当前要覆盖四组基础情景：

1. 提前还款 + 等额本息
2. 提前还款 + 等额本金
3. 不提前还款 + 等额本息
4. 不提前还款 + 等额本金

## 分析边界

- 只讨论可量化现金流，不讨论情绪价值。
- 默认比较对象为“同等房源”。
- 假设居住年限为 `n` 年，但当前 `n` 仍需明确。
- 物业费、水电燃气等日常住户支出不纳入对比。
- 装修价格纳入买房现金流，并在 `t0` 一次性支付。

## 配置原则

核心业务参数应统一进入 `config.yaml`，保证后续修改假设时不需要改代码。配置至少分为三层：

1. 基础房屋与租赁参数
2. 宏观路径与利率参数
3. 情景组合与输出参数

## 核心假设

| 类别 | 当前口径 | 是否进入 `config.yaml` | 备注 |
|---|---|---|---|
| 房屋总价 | `630 万` | 是 | 买房现金流起点 |
| 首付 | `250 万` | 是 | `t0` 一次性支出 |
| 初始贷款本金 | `房屋总价 - 首付` | 否，派生变量 | 由配置计算得到 |
| 装修价格 | `30 万` | 是 | `t0` 一次性付清，纳入买房现金流 |
| 同房型初始月租 | `10,000` | 是 | 租房现金流起点 |
| 房租增长率 | `CPI 增长率` | 是 | 已明确锁定，不再使用 GDP 方案 |
| 房屋残值 | `R = 2,000,000` | 是 | 期末回收值 |
| 房屋修缮支出 | `250 元 / 月` | 是 | 纳入买房月度现金流 |
| 房贷利率 | 每年调整一次 | 是 | 年频率输入，月频率计算 |
| 折现率 | `3.5% p.a.` | 是 | 折现口径 |
| 提前还款时点 | `x = 10 年` | 是 | 情景变量 |

## 关键关系

当前建模关系正式锁定为：

1. 房贷利率与 CPI 增长率呈线性关系。
2. 房租增长率 = CPI 增长率。
3. 同一年内房租稳定，到下一年再按 CPI 路径更新。

因此，先前笔记中的 `R_rent = kG_gdp + a + epsilon` 不作为当前版本的租金主模型。

## 关键变量

| 变量 | 含义 |
|---|---|
| `pv` | 房屋总价 |
| `down_payment` | 首付 |
| `renovation_cost` | 装修价格 |
| `R` | 房屋残值 |
| `u` | 房屋修缮维修支出 |
| `r` | 折现率 |
| `n` | 对比期（月或年，需要统一） |
| `Interests` | 每月支付利息列表 |
| `Rent` | 每月房租列表 |
| `NPV` | 净现值 |
| `FV` | 终值 / 未来值（是否保留仍需确认） |

## 建模流程

### 1. 宏观输入准备

1. 计算中国年化 CPI growth。
2. 将年化 CPI growth 与 `data\china_loan_rate_wdi.csv` 对齐。
3. 以 `OBS_VALUE` 与年化 CPI growth 进行回归分析，得到：

```text
y = kx + b + epsilon
```

### 2. 未来路径构造

1. 参考低增长 / 通缩经济体的 CPI 经验，构造中国未来 CPI 路径。
2. 当前记录中的路径为：从 2023 年起一路下跌五年至 2028 年达到极值 `-1.79%`，随后 7 年回升至 `2%`，远期在 `1.9%` 附近随机波动。
3. 将未来 CPI 路径代入回归方程，得到未来房贷利率路径。
4. 将未来 CPI 路径同时用于租金增长。

### 3. 买房现金流

1. 基于首付、贷款本金和装修价格初始化买房方案。
2. 在 `t0` 记录首付与装修价格的现金流流出。
3. 按当期利率和剩余期数生成月供、本金、利息与剩余本金。
4. 将房屋修缮支出加入月度支出。
5. 若进入提前还款场景，则在 `x` 年时一次性偿还剩余本金，并将该笔支出折现。
6. 在期末加入房屋残值 `R`。

### 4. 租房现金流

1. 以初始月租 `10,000` 为起点。
2. 同一年内房租稳定。
3. 到下一年时，按该年的 CPI 增长率更新月租。
4. 将每一期房租写入现金流列表并统一折现。

### 5. 结果比较

1. 汇总月度现金流。
2. 计算四组情景的 `PV / NPV`。
3. 输出对比表和图表。
4. 支持 append 式写入结果，便于不同假设轮次并存。

## 输出定义

项目至少应输出以下结果：

1. 月度现金流明细表（一行一个月）。
2. 情景级汇总表（每个情景一行）。
3. 每期支出对比折线图。
4. `PV / NPV` 对比图。
5. 关键假设与结果的说明文字。

## 计划中的文件设计

为保持当前仓库风格，优先沿用 `scripts\` 目录下的脚本式组织。计划新增或改动的文件如下：

| 文件 | 作用 |
|---|---|
| `config.yaml` | 统一管理核心假设、情景组合与输出参数 |
| `scripts\run_rent_vs_buy.py` | 统一入口，读取配置并执行完整流程 |
| `scripts\_config_utils.py` | 读取 / 校验 `config.yaml` |
| `scripts\_macro_path.py` | 生成 CPI 与房贷利率路径 |
| `scripts\_mortgage.py` | 等额本息 / 等额本金月度摊还逻辑 |
| `scripts\_cashflow.py` | 买房 / 租房现金流生成与折现 |
| `scripts\_scenario_runner.py` | 生成四组情景并汇总结果 |
| `scripts\plot_rent_vs_buy.py` | 绘制支出对比图与 PV 对比图 |
| `data\outputs\` | 计划新增：存放月度明细与汇总结果 |

## Detailed Implement Plan

### Phase 1: 配置层落地

目标：先把核心假设变成稳定配置，避免后续代码里散落硬编码。

工作项：

1. 新增 `config.yaml`。
2. 定义配置区块：
   - `home`: 房价、首付、装修、残值、修缮支出
   - `rent`: 初始租金、租金增长规则
   - `macro`: CPI 路径参数、回归参数来源
   - `loan`: 贷款年限、提前还款时点、利率调整频率
   - `discount`: 折现率
   - `scenarios`: 四组基础情景
   - `output`: 输出目录、是否 append
3. 新增配置读取与基本校验逻辑。

本阶段交付：

- 可读的 `config.yaml`
- 可复用的配置加载函数

### Phase 2: 宏观路径生成

目标：把“中国未来 CPI + 房贷利率路径”从说明文字变成程序化输入。

工作项：

1. 读取现有 CPI / 利率原始数据。
2. 计算中国年化 CPI growth，并对齐贷款利率数据。
3. 回归得到房贷利率与 CPI 的关系。
4. 基于既定假设生成未来年度 CPI 路径。
5. 将年度 CPI 路径映射为年度房贷利率路径。

本阶段交付：

- 年度 CPI 路径表
- 年度房贷利率路径表
- 可供现金流层直接消费的标准化输入

### Phase 3: 买房现金流引擎

目标：形成完整的月度买房现金流。

工作项：

1. 实现等额本息计算函数。
2. 实现等额本金计算函数。
3. 生成月度字段：
   - `month`
   - `scenario_id`
   - `payment_type`
   - `is_prepay`
   - `begin_balance`
   - `monthly_payment`
   - `interest_payment`
   - `principal_payment`
   - `maintenance_cost`
   - `renovation_cost`
   - `prepayment_amount`
   - `end_balance`
   - `net_cashflow`
   - `discount_factor`
   - `pv_cashflow`
4. 在 `t0` 写入首付与装修价格。
5. 在提前还款节点写入一次性还款。
6. 在期末写入残值回收。

本阶段交付：

- 买房月度现金流明细表

### Phase 4: 租房现金流引擎

目标：形成与买房同口径可比较的月度租房现金流。

工作项：

1. 以初始月租为起点生成月度租金。
2. 保持同一年内月租不变。
3. 下一年按 CPI 增长率更新租金。
4. 统一写入折现因子与现值。

建议字段：

- `month`
- `scenario_id`
- `rent_monthly`
- `rent_growth_rate`
- `net_cashflow`
- `discount_factor`
- `pv_cashflow`

本阶段交付：

- 租房月度现金流明细表

### Phase 5: 情景汇总与 append 输出

目标：让四组情景可以一次运行、统一汇总、增量保留。

工作项：

1. 统一生成四组情景。
2. 为每组情景分配稳定 `scenario_id`。
3. 输出两类结果：
   - 月度明细表
   - 情景汇总表
4. 输出方式采用 append，而不是覆写。
5. 为每轮运行增加 `run_id` 或时间戳，方便追溯。

本阶段交付：

- `data\outputs\cashflow_monthly.*`
- `data\outputs\scenario_summary.*`

### Phase 6: 可视化与说明文字

目标：把数值结果转成可以比较的图和结论。

工作项：

1. 绘制每期支出对比折线图。
2. 绘制 `PV / NPV` 对比图。
3. 按情景输出摘要说明文字。

本阶段交付：

- 支出对比图
- PV 对比图
- 简短结论文本

### Phase 7: 文档与运行入口收口

目标：让项目从“若干脚本”变成“可重复运行的一套流程”。

工作项：

1. 更新 `README` 的运行说明。
2. 在 `PRD` 中固化配置与场景口径。
3. 提供单一入口脚本。

本阶段交付：

- 一条可重复执行的主命令
- 与代码一致的 README / PRD

## 优先级建议

建议按以下顺序推进：

1. `config.yaml`
2. 宏观路径标准化
3. 买房现金流引擎
4. 租房现金流引擎
5. 情景汇总与 append 输出
6. 图表与说明文字

## 待确认问题

以下问题仍会直接影响实现细节：

1. `n` 的正式口径是什么：固定 10 年、20 年，还是覆盖完整贷款期？
2. `FV` 在本项目中是否保留，还是只保留 `PV / NPV`？
3. append 输出优先采用什么格式：`csv`、`parquet`，还是两者都保留？

## Appendix

### 等额本息

#### 输入

- `P`：当前剩余本金
- `r`：年利率
- `n`：剩余月数

#### Step 1：计算固定月供

月利率：

```text
i = r / 12
```

固定月供：

```text
M = P * i * (1 + i)^n / ((1 + i)^n - 1)
```

#### Step 2：计算当月利息

```text
Interest = P * i
```

#### Step 3：计算当月归还本金

```text
PrincipalPayment = M - Interest
```

#### Step 4：计算下个月剩余本金

```text
NextBalance = P - PrincipalPayment
```

#### 完整伪代码

```text
function amortization_step(P, annual_rate, n):
    i = annual_rate / 12
    monthly_payment =
        P * i * (1 + i)^n / ((1 + i)^n - 1)
    monthly_interest =
        P * i
    principal_payment =
        monthly_payment - monthly_interest
    next_balance =
        P - principal_payment

    return {
        monthly_payment,
        principal_payment,
        monthly_interest,
        next_balance
    }
```

### 等额本金

#### 特点

- 每个月偿还的本金固定
- 利息逐月减少
- 月供逐月减少

#### 输入

- `P`：总本金
- `annual_rate`：年利率
- `n`：总月数
- `k`：当前第 `k` 个月（从 1 开始）

#### 核心公式

每月固定本金：

```text
principal_payment = P / n
```

月利率：

```text
monthly_rate = annual_rate / 12
```

当月利息，第 `k` 个月时：

```text
remaining_balance = P - principal_payment * (k - 1)
monthly_interest = remaining_balance * monthly_rate
```

当月总月供：

```text
monthly_payment = principal_payment + monthly_interest
```

下个月剩余本金：

```text
next_balance = remaining_balance - principal_payment
```

#### 完整伪代码

```text
function equal_principal_step(P, annual_rate, n, k):
    monthly_rate =
        annual_rate / 12
    principal_payment =
        P / n
    remaining_balance =
        P - principal_payment * (k - 1)
    monthly_interest =
        remaining_balance * monthly_rate
    monthly_payment =
        principal_payment + monthly_interest
    next_balance =
        remaining_balance - principal_payment

    return {
        monthly_payment,
        principal_payment,
        monthly_interest,
        next_balance
    }
```

#### 特点总结

等额本金：

- 前期还款压力大
- 总利息更少
- 月供逐月下降

等额本息：

- 月供固定
- 前期利息占比高
- 总利息更多一点
