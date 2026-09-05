# Gut Lernen — 把 AI Passport 变成随身德语单词卡

Gut Lernen（德语「好好学」）是一个运行在 [FoloToy AI Passport](https://ai-passport.folotoy.cn) 上的离线德语词汇学习应用：拿起设备就能背单词，根据遗忘曲线安排复习，不需要网络，也没有广告和通知打扰。

## 它能做什么

- **随身背单词**：把 AI Passport 变成一台德语单词卡设备，按按键翻看德语单词、音标和中文释义。
- **科学的复习节奏**：采用 SM-2 遗忘曲线算法（ease / interval / lapses），熟悉的词隔更久再出现，生疏的词尽快重复。
- **每日目标**：可配置每天的新词数量，应用自动搭配「新词 + 到期复习」，学习量记录到每一天。
- **分级词库**：内置歌德学院 A1 / A2 / B1 分级词表，开箱即用。
- **配套 Web 管理端**：在浏览器里维护词库、查看学习进度和每日记录，数据通过接口与设备侧进度模型对齐。

## 仓库结构

```
firmware/    AI Passport 固件源码（ESP-IDF 工程，应用位于 firmware/main/gut_lernen）
client/      Web 管理端前端（React）
server/      Web 管理端后端（NestJS）
shared/      前后端共享类型定义
```

## 构建固件

固件使用 ESP-IDF 5.5.3（target: esp32c3）构建。推送到本仓库的 tag 或手动触发 `Build firmware` workflow（Actions → Build firmware → Run workflow），即可在 GitHub Actions 上编译并产出可直刷的完整镜像 `FoloToy-AI-Passport-full.bin`（Artifact 下载）。

本地构建：

```bash
cd firmware
idf.py set-target esp32c3
SDKCONFIG_DEFAULTS=sdkconfig.defaults idf.py build
idf.py merge-bin -o build/FoloToy-AI-Passport-full.bin
```

## 许可

沿用上游 AI Passport 固件项目的许可证，见 `firmware/LICENSE`。
