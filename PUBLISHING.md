# 发布与安装（GitHub）

这份文档说明如何把这个 DSH 插件发布到 GitHub，并让其他用户安装。插件包本身是一个
"DSH 组合包（bundle）"：`package.json` 里的 `dsh.bundle.patch` 指向 `cordis.patch.yml`，
`dsh.client` 声明浏览器半的注入点，Host 半（`index.js` + `host/`）与 Client 半（`client.js`）
都随包发布。

> 前提：目标机器上装有 **DeepSeek Harness ≥ 0.2.2**（本插件 `engines.dsh = ">=0.2.2-0"`），
> 并且能访问 GitHub（或使用代理/镜像）。

## 0. 发布前一次性检查

```bash
cd /Users/lniev/ds-plugins/nest-assistant

# 1) 生成最新的 client.js（仓库里要提交生成产物，用户安装时就不需要构建）
node build.mjs

# 2) 跑完整测试
node scripts/smoke.mjs
node host/playground-runtime.test.mjs
node host/playground-projects.test.mjs
node scripts/verify-modules.mjs --jobs=2   # 真实编译+启动 31 个练习模块

# 3) 确认打包内容里没有 node_modules / playground / 状态文件
npm pack --dry-run
```

需要按实际情况修改的地方：

- `package.json` 的 `repository` / `homepage` / `bugs` 里的 `lniev`；
- 想换名字的话改 `package.json` 的 `name`（**同时**改 `cordis.patch.yml` 里 insert 条目的
  `name`；本地已安装的 profile 也要重新安装一次）；
- `version`（语义化版本，发版时递增）；
- 选择许可证（当前是 MIT，见 `LICENSE`；如需更换请替换文件与 `package.json.license`）。

## 1. 创建并推送 GitHub 仓库

```bash
cd /Users/lniev/ds-plugins/nest-assistant

git init -b main
git add -A
git commit -m "feat: NestJS 助手插件 v1.0.0（知识库 + 企业地图 + 学习路线 + 操练场）"

# 在 GitHub 上新建一个空仓库（不要勾选自动生成 README），然后：
git remote add origin https://github.com/lniev/nestjs-assistant.git
git push -u origin main

# 建议打 tag，用户安装时可以固定版本
git tag v1.0.1
git push origin v1.0.1
```

`.gitignore` 已排除 `node_modules/`、`playground/`、`playground-saves/`、`playground-state.json`
这些本地/运行时文件；`knowledge/`、`playground-modules/`、`client.js` 需要提交（运行时真的会用到）。

发布后建议在 GitHub Releases 里为 `v1.0.0` 写升级说明。

建议同时设置 **Social preview**（仓库链接在社交/IM 里分享时显示的预览图，推荐 1280×640、<1MB）：
仓库 **Settings → General → Social preview → Edit → Upload an image**，上传 [`docs/social-preview.png`](docs/social-preview.png)。

## 2. 用户如何安装

三种方式任选其一，安装 spec（来源地址）是同一个：

```
github:lniev/nestjs-assistant#v1.0.1
```

也可以省略 tag 用默认分支：

```
github:lniev/nestjs-assistant
```

### 方式 A：Web UI（推荐普通用户）

1. 打开 DeepSeek Harness 左侧栏的 **插件** 页面；
2. 点 **安装第三方插件**；
3. 在「包名或地址」里粘贴 `github:lniev/nestjs-assistant#v1.0.1`；
4. 确认包名与介绍后点 **安装**；
5. 安装完成后到侧边栏打开 **NestJS 助手**，首次进入操练场会生成运行时目录。

> 如果网络访问 GitHub 超时，安装界面会提供「改用国内镜像」或「试试其他方式」；
> 也可以让用户配置代理，或改用 npm 包名安装（见第 4 节）。

### 方式 B：让 AI 安装

在支持 `plugin_manager` 工具的会话里直接说：

> 用 plugin_manager 安装 `github:lniev/nestjs-assistant#v1.0.1`

（该工具通常需要 `danger-full-access` 权限或用户批准。）

### 方式 C：CLI

```bash
dsh plugin --profile desktop add github:lniev/nestjs-assistant#v1.0.1
```

`desktop` 是桌面版 profile 名；Web 版按实际 profile 名替换。CLI 版同样会把插件装进该
profile 并写入 `dsh.profile.bundles`。

## 3. 升级与卸载

第三方插件没有官方的「更新」通道（官方随 DSH 提供的组合包才有）：

- **升级**：插件页面 → 找到该插件 → 卸载；再用新的 tag 地址重新安装；
- **卸载**：插件页面 → 卸载（保留的运行时数据会一起删除前请自行备份 `playground-saves/`）；
- 已安装同名包时再装会得到 `already-installed`，必须先卸载。

发新版本时：

```bash
# 改 package.json 的 version（例如 1.1.0）
node build.mjs
git add -A
git commit -m "release v1.1.0"
git tag v1.1.0
git push origin main --tags
```

用户安装 `...#v1.1.0` 即可。

## 4. 可选：发布到 npm（安装源更稳定）

GitHub 直装依赖 GitHub 网络；发布到 npm 后用户只需填包名，且可以走 npm 镜像。

1. 把包名改成唯一且可发布的名称，例如 `dsh-plugin-nest-assistant`（或 `@your-name/dsh-plugin-nest-assistant`）；
2. 同步修改 `cordis.patch.yml` 中 insert 条目的 `name`；
3. 删除 `package.json` 的 `"private": true`（或改成 `false`）；
4. 登录并发布：

```bash
npm login
npm publish --access public
```

5. 用户安装时在「包名或地址」填 `dsh-plugin-nest-assistant`（或 `@your-name/dsh-plugin-nest-assistant@1.0.0`）。

> 发布到 npm 前确认 `npm pack --dry-run` 里包含 `client.js`、`host/`、`knowledge/`、
> `playground-modules/`，且不含 `node_modules/`、`playground/`。

## 5. 版本兼容与常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 安装被拒绝，提示 `engines.dsh` 不满足 | 用户的 DSH 版本低于 `>=0.2.2-0`。升级 DSH；或由用户显式接受风险后豁免：`dsh plugin --profile <profile> allow-version <包名>@<版本> --dsh-version <运行版本> --accept-risk`（Web 插件页也有对应入口，需明确警告风险） |
| 安装时提示 `无法访问 GitHub` / 超时 | 网络问题：使用代理、安装界面的「改用国内镜像」，或改发 npm 包 |
| 安装时要求「允许这些脚本并重试」 | 本插件**没有** `prepare`/`postinstall` 脚本，正常不会触发；如果仓库里后来加了构建脚本，需要在插件页允许或移除脚本 |
| 安装后侧边栏没有「NestJS 助手」 | 插件页确认已启用；重启一次 DSH；检查 `cordis.patch.yml` 是否随包带入 |
| 操练场启动报缺少 `@nestjs/*` / `typescript` | 插件 `dependencies` 未安装成功（网络/镜像）。重新安装，或检查 profile 的 `node_modules` |
| 想清空操练场运行时数据 | 删除插件目录下的 `playground/`、`playground-saves/`、`playground-state.json` |

## 5.5 上架 awesome-dsh-plugin 与 GitHub Topics

### GitHub Topics（自动收录，无需审核）

`https://github.com/topics/dsh-plugin` 不是人工维护的名单：它自动列出所有公开仓库中**给自己打了
`dsh-plugin` topic** 的仓库。所以只要给你的仓库加 topic 即可：

仓库首页 → 右侧 **About** 齿轮 → **Topics** 填入（保存后立即出现在 topic 页）：

```
dsh-plugin  dsh  deepseek-harness  nestjs  typescript  playground  knowledge-base  ai-coach
```

也可以用 `gh`（需 `gh auth login`）：

```bash
gh repo edit lniev/nestjs-assistant \
  --add-topic dsh-plugin --add-topic dsh --add-topic deepseek-harness \
  --add-topic nestjs --add-topic typescript --add-topic playground
```

### awesome-dsh-plugin（人工审核，PR 收录）

仓库：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin ｜ 规则：[contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)

收录后插件会出现在该列表、其官网，并成为 dsh-market「发现」页的索引源，曝光最好。收录方式是
**提一个只新增 1 个 YAML 文件的 PR**（不要手改 README，两个 README 由脚本生成）：

1. Fork 上面的仓库；
2. 在 fork 里新建 `data/plugins/lniev__nestjs-assistant.yml`，内容用本仓库的
   [`docs/awesome-entry.yml`](docs/awesome-entry.yml)（已按官方格式写好：url / name / category /
   en+zh 描述 / icon）；
3. 提交并在 GitHub 上点 **Contribute → Open pull request**；
4. PR 标题例如 `Add lniev/nestjs-assistant`，描述里简述插件做什么、如何安装
   （`dsh plugin add github:lniev/nestjs-assistant#v1.0.1`）。

收录硬性要求（CI 会自动检查，逐条已满足情况）：

| 要求 | 状态 |
| --- | --- |
| `package.json` 声明 `dsh.bundle.patch` 且仓库根有 `cordis.patch.yml` | ✅ |
| 真实可用代码（非占位/纯 README） | ✅ |
| 仓库创建满 **1 天** | ⏳ 本仓库创建于 2026-11-07，**2026-11-08 16:36（北京时间）之后**提交才满足；提前开 PR 的话 CI 会先拦、满 1 天后自动重跑 |
| 添加 `dsh-plugin` topic | ⏳ 需要在仓库 About 里加 |
| 描述准确、无营销词、一句英文（中文可选） | ✅（见 `docs/awesome-entry.yml`） |
| 一个 PR 最多 3 条、一个插件一个文件 | ✅（单条） |

维护者还会核对描述里的数字与 API（本插件确实有 165 页文档总结、31 个练习模块、`nest_docs` 工具）。
分类选的是 `docs`（Docs & Rendering，最贴近「知识库/文档」；若维护者认为 `tools` 更合适会直接改，不会打回）。

### 市场截图与图标（已配置，无需再提 PR）

- 仓库根新增 `screenshots.json`，声明 1–8 张截图，dsh-market 详情页会按顺序展示：
  见 [`screenshots.json`](screenshots.json)（指向 `docs/screenshots/*.png`）。
- 收录条目的 `icon:` 指向 [`docs/icon-180.png`](docs/icon-180.png)（GitHub 托管的 180×180 PNG，
  列表不收 SVG）。想换图标时替换该文件即可，市场下次构建自动更新。
- 想换截图：\(1\) 改 `screenshots.json` 里的路径；\(2\) 在 README「界面截图」区块里同步替换。

## 6. 安全与合规

- DSH 插件以**用户本机权限**运行，Host 代码可以读写文件、启动子进程。README 与插件页面都会提示
  「只安装可信来源」；
- 本插件会：读写自己包目录下的 `playground/` 等文件、用内置 Node 启动 Nest 子进程、启动本地 HTTP
  服务（仅绑定 127.0.0.1 的随机端口）；不会访问外部网络（构建知识库时的下载产物已内置）；
- 内置的 NestJS 文档知识库是对官方文档的中文总结，发布时请保留出处说明（README 已有）。

## 7. 持续集成

仓库自带 `.github/workflows/ci.yml`：每次 push/PR 会执行

- `client.js` 是否与 `src/` 同源（重新生成并 diff）；
- 客户端 bundle 冒烟、虚拟运行时测试、代码模块存储测试；
- 31 个练习模块的真实编译 + 启动验证。

第一次跑 CI 前确认 `npm install` 能拉到依赖（`@nestjs/*`、`typescript` 等已在 `dependencies` 中声明）。
