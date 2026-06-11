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

### 3. Windows 打包与交叉编译

由于项目启用了 CGO，编译 Windows 版本需要 CGO 兼容的工具链（具体为 `zig`）。您可以选择使用本地安装的 `zig` 工具链，或者通过 Docker 容器进行编译。

#### 3.1 本地编译前提条件（推荐）
在您的宿主机上安装 `zig`（推荐 v0.14.0）。安装完成后，编译任务将自动调用本地的 `zig cc` 包装脚本为 Windows 进行交叉编译。

#### 3.2 Docker 编译前提条件
如果您不想在本地安装 `zig`，可以使用 Docker 进行交叉编译。首先，构建交叉编译所需的 Docker 镜像：
```bash
task setup:docker
```

#### 3.3 默认行为与自定义参数
- **默认架构**：目标架构默认为 `amd64` (x86_64)，而不是跟随宿主机的架构。
- **默认编译方式**：默认使用本地的 `zig` 进行本地交叉编译。

#### 3.4 打包命令
* **标准 Windows 打包（使用本地 Zig，目标架构为 amd64）**：
  ```bash
  task package:windows
  ```
* **指定目标架构（例如 arm64）**：
  ```bash
  task package:windows ARCH=arm64
  ```
* **强制使用 Docker 编译**：
  如果您的本地没有安装 `zig`，可以强制使用 Docker 镜像进行编译：
  ```bash
  task package:windows USE_DOCKER=true
  ```
* **强制使用 Docker 编译并指定目标架构**：
  ```bash
  task package:windows USE_DOCKER=true ARCH=arm64
  ```

## 许可证

本软件基于 MIT 许可证开源 - 详见 [LICENSE](../LICENSE) 文件。
