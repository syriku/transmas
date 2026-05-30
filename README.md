# transmas

[简体中文](docs/README.zh.md)

`transmas` (翻译大师) is a modern, cross-platform novel translation assistant and workspace manager. Built on the **Wails v3** framework, it integrates a Go backend with a React, TypeScript, and Vite-powered frontend. It is designed to streamline translation workflows through AI-driven translation, glossary/terminology management, and deep integration with web novel platforms and browser extensions.

## Core Features

- **AI-Assisted Translation**: Integrates with LLM providers (using `aisdk`) for high-quality translation. Supports both synchronous translation for shorter segments and asynchronous stream-based translation for larger chunks.
- **Chunk-Based Workflows**: Splits chapters into manageable chunks represented as Quill-compatible Deltas. Allows translators to track translation progress and review status on a chunk-by-chunk basis.
- **Glossary & Terminology Management**: Project-specific term glossaries ensure consistent translation of characters, locations, and unique terms across chapters.
- **Kakuyomu Novel Loader**: Directly retrieves web novels from Kakuyomu (using `kakuyomu-loader`) and automatically structures them into local chapter files.
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

1. **Set Up the Compilation Image**:
   ```bash
   task setup:docker
   ```
2. **Build and Package for Windows (amd64)**:
   ```bash
   task windows:package CGO_ENABLED=1
   ```
3. **Packaging from Apple Silicon (ARM) Macs**:
   If building on an ARM host, specify the target architecture explicitly as `amd64` to prevent NSIS from packaging it as `arm64`:
   ```bash
   task windows:package CGO_ENABLED=1 ARCH=amd64
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
