# transmas

[English](../README.md)

`transmas` (翻译大师) 是一款现代化的跨平台小说翻译辅助与工作空间管理工具。基于 **Wails v3** 框架构建，前端采用 React、TypeScript 和 Vite，后端基于 Go。它通过 AI 驱动翻译、术语表/词条管理以及与网络小说平台和浏览器插件的深度集成，旨在简化并加速翻译工作流。

## 核心功能

- **AI 辅助翻译**：使用 `aisdk` 接入各类主流大语言模型（LLM）提供高质量翻译。支持针对较短文本的同步翻译，以及针对长篇内容的异步流式（Stream）翻译。（注：虽然支持 OpenAI 风格和 Anthropic 风格的第三方 API，但更推荐使用 OpenAI 风格。不保证 Anthropic 风格的兼容供应商都一定能运行。）
- **分段（Chunk）工作流**：将章节切分为易于管理的文本段落，并使用 Quill 格式的 Delta 进行表示。翻译者可以逐段跟踪翻译进度和校对（Review）状态。
- **术语表（Glossary）管理**：支持项目专属的术语表，确保不同章节中人名、地名及专有名词的翻译一致性。
- **Kakuyomu 小说下载器**：利用 `kakuyomu-loader` 直接从 Kakuyomu 平台获取网络小说内容，并自动整理生成本地章节文件（.txt）。
- **浏览器插件服务端**：内置本地 HTTP 服务，当开启 `userData.WebExtensionEnabled` 时，可以与 `transmas-web-helper` 浏览器插件进行通信，协同处理小说翻译和数据获取。

## 开发设置

### 前提条件
在开发之前，请确保您的开发环境中已安装以下工具：
- **Go** (v1.21 或更高版本)
- **Node.js** (v18 或更高版本) & **npm**
- **Wails v3** 命令行工具 (`wails3`)
- **Task** 任务运行器 (可通过 Go、Homebrew 或 NPM 安装)

### 以开发模式运行
启动应用程序，并为 Go 后端和 React 前端开启热重载（Hot-Reload）：

```bash
task dev
```

该命令将使用 `./build/config.yml` 的配置在端口 `9245` 上启动开发模式。

## 打包与生产构建

### 1. 收集依赖授权（Licenses）
在打包生产版本之前，您必须收集所有的 Go 和 NPM 依赖授权许可：

```bash
task licenses:collect
```

### 2. 打包本地平台版本
打包当前操作系统下的生产环境应用安装包/可执行文件：

```bash
task package
```

### 3. 基于 Docker 的 Windows 打包（交叉编译）
由于项目使用了 CGO，在 macOS/Linux 等非 Windows 平台交叉编译 Windows 版本需要使用 Docker 环境。

1. **构建/配置编译镜像**：
   ```bash
   task setup:docker
   ```
2. **构建并打包 Windows 版本 (amd64)**：
   ```bash
   task windows:package CGO_ENABLED=1
   ```
3. **在 Apple Silicon (ARM) 架构的 Mac 上打包**：
   如果您的主机是 ARM 架构，必须明确指定目标架构 `ARCH=amd64`，否则 NSIS 会将程序打包为 `arm64` 版本：
   ```bash
   task windows:package CGO_ENABLED=1 ARCH=amd64
   ```

## 许可证

本软件基于 MIT 许可证开源 - 详见 [LICENSE](../LICENSE) 文件。
