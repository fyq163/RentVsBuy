# Rent vs Buy

在同等房源、同等居住期限下，用**终值（FV）**比较租房与买房。  
**溢价 = 买房 FV − 租房 FV**（正值表示买房终值更优）。

整站是纯前端：模型在用户浏览器里算，GitHub Pages 只托管静态文件，不消耗你的服务端算力。

## 在线使用

部署开启后（仓库 Settings → Pages → Source = GitHub Actions）：

`https://<user>.github.io/rentVSbuy/`

本地：

```powershell
cd web
npm install
npm run dev
```

构建：

```powershell
cd web
npm test
npm run build
# 产物在 web/dist，可预览：
npm run preview
```

## 调参重点

- **期末残值**：显示 `FV …（PV 相当于 …）`；折现率 = 中性锚定 CPI
- **CPI 路径**（租金与房贷共用）：`piecewise` 或 `flat`
- **敏感度**（在「更多假设」）：利率对 CPI 的 `k`、房租对 CPI 的 `k`  
  `rate_t = max(floor, initial + k_rate * (cpi_t - anchor))`  
  `房租年增 = k_rent * cpi_t`
- 房价 / 首付 / 月租 / 提前还款等见左侧主栏

## 终值口径

月度净现金流 `CF_t`（支出为负，残值回收为正）：

```text
FV = Σ CF_t * (1 + r_m)^(T - t)
```

默认对比期 30 年；复利 / 折现用中性锚定 CPI（默认 2%）。

## 仓库结构

| 路径 | 说明 |
|---|---|
| [`web/`](web/) | **唯一上线应用**（Vite + TypeScript） |
| [`web/src/model/`](web/src/model/) | 摊还、宏观路径、现金流、FV、溢价 |
| [`web/src/defaults.ts`](web/src/defaults.ts) | 默认假设（自原 `config.yaml`） |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | 构建并部署 GitHub Pages |
| `config.yaml` / `prd.md` / `scripts/` | 历史假设与宏观探索脚本，不参与 Pages 运行 |

## 文档

- 本 README：对外说明与运行方式
- [`prd.md`](prd.md)：内部建模细节（Python 时代沉淀，口径仍可参考）
