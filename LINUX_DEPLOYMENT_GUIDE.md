# HDS Interlude Linux 部署指南

适用场景：Ubuntu 24.04 / Debian 系 Linux，`x86_64` 或 `aarch64`，NapCat **直接在 Shell 运行**，Koishi 与 NapCat 安装在同一台机器上。本文以全新服务器为例；已经运行的实例从“验证”和“更新与备份”章节开始。

本项目在 Ubuntu 24.04 ARM64、Koishi + NapCat Shell 上完成过私聊、图片理解、本地表情包和 QQ 原生表情的实际投递验证。具体 QQ、API Key、Token 均由部署者在自己的实例中填写。

## 1. 准备 Linux 和 Node.js

用普通用户登录服务器，不要把 Koishi 和 NapCat 装到 root 的家目录。先确认架构并准备基础工具：

```bash
uname -m                         # x86_64 或 aarch64
sudo apt update
sudo apt install -y git curl unzip ca-certificates
node --version
npm --version
```

Koishi 要求 Node.js **至少 v18**，推荐安装当前受支持的 LTS；若上面两条版本命令不存在或版本过低，请先按 [Koishi 模板项目文档](https://koishi.chat/zh-CN/manual/starter/boilerplate) 安装 Node.js。安装完再继续。服务器需要能访问所选模型接口和 npm/GitHub。

## 2. 创建 Koishi 项目

按 [Koishi 官方模板项目流程](https://koishi.chat/zh-CN/manual/starter/boilerplate)初始化。以下示例把项目命名为 `hds-interlude-bot`，下文都使用这个目录：

```bash
mkdir -p ~/apps
cd ~/apps
npm init koishi@latest
cd ~/apps/hds-interlude-bot
npm install @koishijs/plugin-adapter-onebot @koishijs/plugin-database-sqlite
npm start
```

初始化向导若让你选包管理器，本文后续命令按 **npm** 编写；选用其他包管理器时，安装与更新命令也要保持一致。首次 `npm start` 用于进入 Koishi Console 完成配置，确认能打开后可按 `Ctrl+C` 停止，再配置自启。

Koishi 的 `server` 插件设置为 `host=127.0.0.1`、`port=5140`。NapCat 在同机连接这个端口，无需把 5140 暴露到公网。SQLite 插件应保持启用；故事数据会写入 Koishi 实例的 `data/koishi.db`。

## 3. 从私有 GitHub 仓库安装 HDSI

服务器需要对你的私有仓库有读取权限。可以先按 [GitHub CLI 安装说明](https://github.com/cli/cli#installation)安装 `gh`，然后执行一次交互式登录；也可以用已配置好的 GitHub SSH 密钥克隆。不要把 GitHub Token 写进命令、仓库或截图。

```bash
gh auth login
mkdir -p ~/src
gh repo clone xingranya/hds-interlude ~/src/hds-interlude
cd ~/src/hds-interlude
PACKAGE_TGZ="$(npm pack --silent)"
cd ~/apps/hds-interlude-bot
npm install --save-exact "$HOME/src/hds-interlude/$PACKAGE_TGZ"
```

当前仓库已跟踪编译后的 `lib/index.js`，打包安装时不必在服务器上编译 TypeScript。安装后在 Koishi Console 启用 `hds-interlude`。若从 npm 市场安装的是另一个版本，应先确认它包含本指南对应的 QQ 白名单、MiniMax Anthropic 和表情包功能。

## 4. 安装 NapCat Shell 并登录机器人 QQ

NapCat 官方安装器支持 Ubuntu/Debian 的 Shell 模式和 ARM64。请在**准备运行机器人的普通用户**下执行，安装到该用户的 `~/Napcat`；安装器需要系统依赖时会请求 `sudo`。全新机器可按 [NapCat-Installer](https://github.com/NapNeko/NapCat-Installer)的 Shell 路径安装：

```bash
mkdir -p ~/setup/napcat
cd ~/setup/napcat
curl -fL https://raw.githubusercontent.com/NapNeko/NapCat-Installer/main/script/install.sh -o napcat.sh
bash napcat.sh --docker n --cli y --proxy 0
```

安装完成后按安装器打印的启动方式运行，例如 rootless 默认目录可使用：

```bash
xvfb-run -a "$HOME/Napcat/opt/QQ/qq" --no-sandbox
```

使用手机 QQ 扫码登录**机器人账号**，不要登录用于和机器人聊天的个人账号。安装了 TUI-CLI 时，也可以运行 `napcat` 打开管理界面。NapCat WebUI 默认端口常见为 `6099`，以启动日志为准；首次登录后设置新密码。

## 5. 接通 NapCat 与 Koishi

这套同机部署使用**反向 WebSocket**：Koishi 监听，NapCat 主动连接。按 [NapCat 对接 Koishi 文档](https://napneko.github.io/use/integration)配置：

1. Koishi Console 安装并启用 `adapter-onebot`：`protocol` 选 `ws-reverse`，`selfId` 填机器人 QQ，`token` 设为你自己生成的随机值。
2. NapCat WebUI →“网络配置”→“新建”→**WebSocket 客户端**，URL 填 `ws://127.0.0.1:5140/onebot`，Token 与 Koishi 完全相同，启用该连接。
3. 观察 Koishi 的 OneBot 连接状态与 NapCat 日志，确认已连接，再从个人 QQ 给机器人发一条私聊。

这里 NapCat 是 **WebSocket 客户端**。不要把它误设成 WebSocket 服务端，也不要把 NapCat WebUI 的 `6099` 当作 OneBot 的连接端口。两者都在服务器本机，QQ 消息不需要公网端口转发。

## 6. 配置故事、模型与账号隔离

在 Koishi Console 的 `hds-interlude` 中依次完成：

| 配置区 | 最小配置 |
| --- | --- |
| `storyDefaults` | 主角名称、人物资料、世界、地点、风格和时区；中国生活剧常用 `Asia/Shanghai`。 |
| `model.providers` | 至少一条启用的主叙事模型连接，并勾选 `useForMain`。API Key 只填进服务器 Console。 |
| `onebot` | `enabled=true`；`botAccounts` 只填机器人 QQ；`userAccounts` 只填允许私聊的 QQ；`ignoreSelfMessages=true`。 |
| `sharedStory` | 只允许一个私聊对象时可设 `allowCrossConversationMessages=false`，`shareParticipantDetails=false`；`managerAccounts` 填管理员 QQ。 |
| `runtime` | 需要角色主动联系时设 `allowProactiveMessages=true`，并保持自动推进开启。 |

当前 MiniMax-M3 接法：模型行选 `mode=minimax-anthropic`，填 MiniMax API Key、`model=MiniMax-M3`，勾选 `useForMain`；主叙事输出格式用 `prompt-only`。该模式使用 Anthropic Messages 协议。要让主模型直接看图，再开启 `model.vision.enabled=true`、`model.vision.mode=native`；`useForVision` 是侧端识图用途，原生模式直接使用主模型。其他模型按自身接口能力配置，不要把纯文本模型当视觉模型。

表情相关可选项：

- QQ 自带小表情：`chatActions.enabled=true`、`platforms` 包含 `qq`、`nativeFaces=true`；`allowedNativeFaces` 和 `expressionThreshold` 决定可用语义与意愿门槛。
- 本地表情包：`stickers.enabled=true`，例如目录 `data/hds-interlude/stickers`；可在目录中按一级子文件夹分组放入 PNG/JPG/GIF/WebP。给视觉模型勾选 `useForStickers`，待扫描和描述完成后才会进入可选素材库。
- 主动生活推进：`urge.enabled=true`、`frequency=medium` 可以启用弹性调度；它决定何时检查和续写生活，**不是每隔固定分钟必发私信**。主动联系还要通过白名单、Agency 行动窗口、现实理由和联系间隔；普通联系的默认最短间隔是 60 分钟。

保存配置并重载插件。在白名单 QQ 私聊中先执行 `interlude.doctor`；档案检查通过后，按提示执行 `interlude.story.start`。最初只测一位私聊用户，确认正常后再增加其它账号或群聊。

## 7. 打开两个 WebUI

Koishi Console 和 NapCat WebUI 都建议只在本机监听。服务器有公网 IP 也不必直接开放管理页。在你自己的电脑终端运行 SSH 隧道：

```bash
ssh -N -L 5140:127.0.0.1:5140 -L 6099:127.0.0.1:6099 服务器用户名@服务器公网IP
```

保持此终端窗口打开，在电脑浏览器分别访问 `http://127.0.0.1:5140`（Koishi）和 `http://127.0.0.1:6099/webui/`（NapCat；具体路径以当前版本为准）。如果本机端口已占用，把 `-L` 左边的本机端口换成其它值。需要长期公网访问时，应另配带登录保护的 HTTPS 反向代理，而不是直接放通管理端口。

| 端口 | 用途 | 同机部署的建议 |
| --- | --- | --- |
| `5140` | Koishi Console 与 `/onebot` 反向 WS | 监听 `127.0.0.1`，NapCat 用本机地址连接。 |
| `6099` | NapCat WebUI（以实际日志为准） | 通过 SSH 隧道访问，不向公网放通。 |

## 8. 设置开机自启

先确认前台 `npm start` 与 NapCat 都能独立运行。然后为 Koishi 建立用户级 systemd 服务；`command -v npm` 会写入本机实际路径：

```bash
mkdir -p ~/.config/systemd/user
NPM_BIN="$(command -v npm)"
NODE_BIN_DIR="$(dirname "$(command -v node)")"
cat > ~/.config/systemd/user/hds-interlude.service <<EOF
[Unit]
Description=HDS Interlude Koishi
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/apps/hds-interlude-bot
Environment=NODE_ENV=production
Environment=PATH=$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin
ExecStart=$NPM_BIN start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now hds-interlude.service
```

如果 NapCat 采用上文的 rootless 默认目录，也可为它建立用户服务。把 `机器人QQ号` 换成真实号码，并确认安装目录中的 `qq` 文件存在：

```bash
test -x "$HOME/Napcat/opt/QQ/qq"
cat > ~/.config/systemd/user/napcat-shell.service <<'EOF'
[Unit]
Description=NapCat Shell
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/xvfb-run -a %h/Napcat/opt/QQ/qq --no-sandbox -q 机器人QQ号
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now napcat-shell.service
```

如果 `xvfb-run` 不在 `/usr/bin`，用 `command -v xvfb-run` 查实际路径并修改服务文件。同一个 QQ 只运行一个 NapCat 进程；已经由别的服务托管 NapCat 时，不要再启用第二份。需要用户退出 SSH 后继续运行，可执行 `sudo loginctl enable-linger "$USER"`。

## 9. 验证与排错

```bash
systemctl --user status hds-interlude.service
systemctl --user status napcat-shell.service  # 仅在使用上文服务时执行
journalctl --user -u hds-interlude.service -n 80 --no-pager
curl -sS -o /dev/null -w 'console_http=%{http_code}\n' http://127.0.0.1:5140/
ss -tn | grep ':5140'
```

最小验收顺序：**Koishi 服务就绪 → NapCat 已登录 → 反向 WS 已连接 → 白名单 QQ 私聊被收到 → 主模型完成 → QQ 实际收到回复**。然后分别发一张图片、一枚 QQ 原生小表情，以及请求一张本地表情包，核对模型是否理解和实际投递。HTTP 200 只证明 Console 可访问，不能单独证明 QQ 收发成功。

常见现象：

- `ECONNREFUSED`：先检查 Koishi 是否监听 5140、NapCat 的 WS 客户端 URL 是否为 `/onebot`。NapCat 先启动时的短暂拒连可等待重连。
- NapCat 有私聊记录，但 Koishi 没有：检查 OneBot 连接、Token、`selfId` 和 `onebot` 白名单。共用机器人 QQ 的其它程序应各自过滤消息；不要把测试 QQ 加入 QQ 账号本身的黑名单。
- Koishi 收到了，QQ 没见回复：看本轮是否为 `reply.mode=none`、模型失败并安排重试，还是“消息投递失败”。角色允许偶尔不回，不能把一次沉默等同于断线。
- 看不到图片或表情包：区分 `chatActions.nativeFaces`（QQ 自带小表情）与 `stickers`（本地图片）；素材未完成描述或模型未选择发送时，不会自动投递。
- 主动私信迟迟未出现：`allowProactiveMessages` 是许可开关，Urge 时间是剧情推进时间；只有经过实际推进、行动窗口和意愿判断，才可能发信。

## 10. 更新与备份

更新前先保存 Koishi 配置、SQLite 数据和当前安装包。不要把 `koishi.yml`、数据库、NapCat 配置或密钥提交到 Git：

```bash
install -d -m 700 ~/backups/hds-interlude
systemctl --user stop hds-interlude.service
tar -czf "$HOME/backups/hds-interlude/koishi-$(date +%Y%m%d-%H%M%S).tgz" \
  -C "$HOME/apps/hds-interlude-bot" koishi.yml data
systemctl --user start hds-interlude.service

cd ~/src/hds-interlude
git pull --ff-only
PACKAGE_TGZ="$(npm pack --silent)"
cd ~/apps/hds-interlude-bot
npm install --force --save-exact "$HOME/src/hds-interlude/$PACKAGE_TGZ"
systemctl --user restart hds-interlude.service
```

更新后重复第 9 节的检查，并用真实白名单 QQ 测试。若需要回退，使用更新前保存的安装包重新安装并重启；只有数据结构确实需要恢复时才使用数据库备份，避免覆盖更新后产生的新剧本。

参考：[Koishi 模板项目](https://koishi.chat/zh-CN/manual/starter/boilerplate) · [Koishi OneBot 适配器](https://koishi.chat/zh-CN/plugins/adapter/onebot) · [NapCat Linux 安装器](https://github.com/NapNeko/NapCat-Installer) · [NapCat 对接 Koishi](https://napneko.github.io/use/integration)
