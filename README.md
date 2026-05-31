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

### 3. Docker-Based Windows Packaging (Cross-Compilation)
Since the application uses CGO, cross-compiling for Windows from macOS/Linux requires a Docker environment.

#### Prerequisites
Build and configure the cross-compilation Docker image using:
```bash
task setup:docker
```
*(Note: If you are building on a Windows host, Docker is not required as long as you have a local CGO-compatible GCC compiler, though Docker is still highly recommended.)*

#### Recommended Method (Simplified Packaging)
You can run the unified packaging task:
```bash
task package:windows
```
This command automatically:
1. Collects and generates dependency licenses.
2. Cross-compiles the application with `CGO_ENABLED=1`.
3. Automatically determines the final installation package architecture based on your host system's architecture (e.g., `amd64` or `arm64`).

#### Manual / Advanced Packaging
If you need to perform the steps individually or customize the target architecture:
1. **Collect Dependency Licenses**:
   ```bash
   task licenses:collect
   ```
2. **Trigger the Windows Packaging**:
   Run the packaging command with `CGO_ENABLED=1` passed as a task variable:
   ```bash
   task windows:package CGO_ENABLED=1
   ```
3. **Specify Target Architecture (Optional)**:
   By default, the architecture is determined by the host. If you want to force a specific target architecture (e.g., building `amd64` on an Apple Silicon Mac):
   ```bash
   task windows:package CGO_ENABLED=1 ARCH=amd64
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
