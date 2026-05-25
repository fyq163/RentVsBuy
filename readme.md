# Rent vs Buy

`rentVSbuy` 是一个用于比较“租房 vs 买房”现金流的分析项目。项目目标不是讨论情绪价值，而是在给定同等房源、同等持有期限和一组可解释假设的前提下，比较两种方案的支出路径与折现价值。

## 项目回答的问题

在中国利率与通胀环境可能持续走弱的背景下：

- 买房在未来 `n` 年内的总现金流压力有多大？
- 若考虑提前还款，买房方案的现值会如何变化？
- 同等房源的租房现金流在同一时期内会如何变化？
- 在统一折现口径下，哪种方案的 `PV / NPV` 更优？

## 文档分工

- `README`：面向外部读者，说明项目做什么、仓库里有什么、当前做到了哪里、接下来要实现什么。
- `PRD`：面向内部分析，沉淀假设、变量口径、建模流程、输出定义和实施计划。

## 当前范围

当前仓库聚焦以下分析链路：

1. 整理中国房贷利率与 CPI 相关数据。
2. 使用中国历史数据估计房贷利率与 CPI 的关系。
3. 参考低增长 / 通缩经济体的 CPI 经验，为中国构造未来 CPI 路径。
4. 生成买房与租房的月度现金流。
5. 比较不同情景下的折现结果，并输出图表。

## 当前关键假设

- 房屋总价：`630 万`
- 首付：`250 万`
- 初始贷款本金：`房屋总价 - 首付`
- 装修价格：`30 万`，期初一次性付清，并纳入买房现金流
- 同房型初始月租：`10,000`
- 房租增长率：`CPI 增长率`
- 房贷利率按年调整
- 房屋残值：`R = 2,000,000`
- 房屋修缮维修支出：`250 元 / 月`
- 折现率：`3.5% p.a.`
- 提前还款时间：`x = 10 年`

更细的模型定义、场景组合、`config.yaml` 配置口径和实施计划见 [prd.md](c:\Users\Administrator\PycharmProjects\rentVSbuy\prd.md)。

## 仓库结构

| 路径 | 说明 |
|---|---|
| `data\Inflation-data.xlsx` | IMF CPI 原始源数据 |
| `data\china_loan_rate_wdi.csv` | 中国房贷利率相关数据 |
| `data\imf_hcpi_jpn_chn_usa.parquet` | 当前整理后的 HCPI 竖表数据，文件名沿用历史命名，但现已包含 `JPN / CHN / USA / GBR / DEU` |
| `figures\imf_hcpi_inflation_yoy.png` | 五国 CPI 同比图 |
| `figures\imf_hcpi_index_rebased.png` | 五国 CPI 指数重定基图 |
| `scripts\extract_imf_hcpi.py` | 提取并转换 IMF HCPI 数据 |
| `scripts\plot_imf_hcpi.py` | 生成 CPI 相关图表 |
| `scripts\_describe_hcpi.py` | 输出 HCPI 描述统计 |
| `scripts\_analyze_deflation.py` | 分析通缩 / 低通胀阶段 |
| `scripts\_chn_cpi_episode_stats.py` | 统计中国 CPI 特定阶段特征 |
| `config.yaml` | 计划新增：统一管理模型假设与场景参数 |

## 当前产出

当前仓库已经完成一部分宏观输入层工作：

- IMF HCPI 多国数据提取与竖表转换
- 五国 CPI 指数与同比图表生成
- 中国 CPI 特定阶段的描述统计脚本沉淀

下一步需要继续把这些宏观输入接到“租 vs 买”的月度现金流模型上。

## 计划中的情景组合

后续实现将至少覆盖四组情景：

1. 提前还款 + 等额本息
2. 提前还款 + 等额本金
3. 不提前还款 + 等额本息
4. 不提前还款 + 等额本金

## 分析流程

1. 准备宏观数据，并对齐中国房贷利率与 CPI。
2. 估计房贷利率对 CPI 的响应关系。
3. 构造未来 CPI 路径，并得到未来房贷利率路径。
4. 生成买房方案的月度现金流。
5. 生成租房方案的月度现金流，且租金按 CPI 增长。
6. 统一折现并比较不同情景。

## 如何运行

当前环境口径：

- Python：`conda base`

已有脚本：

```powershell
C:\Users\Administrator\miniconda3\python.exe scripts\extract_imf_hcpi.py
C:\Users\Administrator\miniconda3\python.exe scripts\plot_imf_hcpi.py
C:\Users\Administrator\miniconda3\python.exe scripts\_describe_hcpi.py
```

后续计划新增统一入口脚本，用于读取 `config.yaml` 并生成现金流结果。

## 预期输出

项目目标输出包括：

- 月度现金流明细表（一行一个月）
- 每期支出对比折线图
- 不同情景下的 `PV / NPV` 对比图
- 关键假设与结果的说明文字

## 当前状态

目前仓库更接近“宏观输入准备完成，租买现金流主模型待实现”。下一阶段会优先完成：

1. 新增 `config.yaml`，把核心假设配置化。
2. 明确买房 / 租房月度现金流表结构。
3. 接入四组情景并支持 append 式输出，便于后续多轮对比。
