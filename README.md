# transmas

[简体中文](docs/README.zh.md)

`transmas` (翻译大师) is a modern, cross-platform novel translation assistant and workspace manager. Built on the **Wails v3** framework, it integrates a Go backend with a React, TypeScript, and Vite-powered frontend. It is designed to streamline translation workflows through AI-driven translation, glossary/terminology management, and deep integration with web novel platforms and browser extensions.

## Core Features

- **AI-Assisted Translation**: Integrates with LLM providers (using `aisdk`) for high-quality translation. Supports both synchronous translation for shorter segments and asynchronous stream-based translation for larger chunks. (Note: Although both OpenAI-style and Anthropic-style third-party APIs are supported, using OpenAI-style APIs is highly recommended. Compatibility with all third-party Anthropic-compatible providers is not guaranteed.)
- **Chunk-Based Workflows**: Splits chapters into manageable chunks represented as Quill-compatible Deltas. Allows translators to track translation progress and review status on a chunk-by-chunk basis.
- **Glossary & Terminology Management**: Project-specific term glossaries ensure consistent translation of characters, locations, and unique terms across chapters.
- **Kakuyomu Novel Loader**: Directly retrieves web novels from Kakuyomu (using `kakuyomu-loader`) and automatically structures them local chapter files.
- **Browser Extension Server**: Embeds a local server that communicates with the `transmas-web-helper` extension to fetch data and coordinate translations on web novel platforms.

## Development Setup

### Prerequisites
Make sure you have the following installed on your development machine:
- **Go** (v1.21 or later)
- **Node.js** (v18 or later) & **npm**
- **Wails v3** command-line interface (`wails3`)
- **Task** runner (available via Go/Homebrew/NPM)

### Running in Development Mode
To start the application with hot-reloading enabled for both the Go backend and the React frontend:

```bash
task dev
```

This runs the development build configured by `./build/config.yml` on port `9245`.

## Packaging & Production Builds

### 1. Collect Dependency Licenses
Before packaging the production build, you must gather all dependency licenses (for both Go and NPM dependencies):

```bash
task licenses:collect
```

### 2. Package for Your Local Platform
To package the production binary for your current operating system:

```bash
task package
```

### 3. Windows Packaging & Cross-Compilation

Since the application has CGO enabled, Windows builds require a CGO-compatible toolchain (specifically `zig`). You can compile either using your local `zig` installation or via a Docker container.

#### 3.1 Prerequisite for Native Compilation (Recommended)
Install `zig` (v0.14.0 is recommended) on your host machine. Once installed, the build tasks will automatically utilize local `zig cc` wrapper scripts to cross-compile for Windows.

#### 3.2 Prerequisite for Docker Compilation
If you prefer not to install `zig` locally, you can cross-compile via Docker. First, build the cross-compilation Docker image:
```bash
task setup:docker
```

#### 3.3 Default Behavior & Customization
- **Default Architecture**: The target architecture defaults to `amd64` (x86_64) instead of following your host machine's architecture.
- **Default Compile Mode**: Local native compilation with `zig` is used by default.

#### 3.4 Packaging Commands
* **Standard Windows Packaging (Native Zig, Target: amd64)**:
  ```bash
  task package:windows
  ```
* **Specify Architecture (e.g. arm64)**:
  ```bash
  task package:windows ARCH=arm64
  ```
* **Force Docker Compilation**:
  If you do not have `zig` installed locally, you can force Docker-based compilation:
  ```bash
  task package:windows USE_DOCKER=true
  ```
* **Force Docker Compilation with Specific Architecture**:
  ```bash
  task package:windows USE_DOCKER=true ARCH=arm64
  ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
