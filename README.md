# Welcome to Your New Wails3 Project!

Congratulations on generating your Wails3 application! This README will guide you through the next steps to get your project up and running.

## Getting Started

1. Navigate to your project directory in the terminal.

2. To run your application in development mode, use the following command:

   ```
   wails3 dev
   ```

   This will start your application and enable hot-reloading for both frontend and backend changes.

3. To build your application for production, use:

   ```
   wails3 build
   ```

   This will create a production-ready executable in the `build` directory.
   _(Note: If CGO is enabled and you need to package the application for Windows, please refer to the [Packaging](#packaging) section.)_

## Exploring Wails3 Features

Now that you have your project set up, it's time to explore the features that Wails3 offers:

1. **Check out the examples**: The best way to learn is by example. Visit the `examples` directory in the `v3/examples` directory to see various sample applications.

2. **Run an example**: To run any of the examples, navigate to the example's directory and use:

   ```
   go run .
   ```

   Note: Some examples may be under development during the alpha phase.

3. **Explore the documentation**: Visit the [Wails3 documentation](https://v3.wails.io/) for in-depth guides and API references.

4. **Join the community**: Have questions or want to share your progress? Join the [Wails Discord](https://discord.gg/JDdSxwjhGf) or visit the [Wails discussions on GitHub](https://github.com/wailsapp/wails/discussions).

## Project Structure

Take a moment to familiarize yourself with your project structure:

- `frontend/`: Contains your frontend code (HTML, CSS, JavaScript/TypeScript)
- `main.go`: The entry point of your Go backend
- `app.go`: Define your application structure and methods here
- `wails.json`: Configuration file for your Wails project

## Next Steps

1. Modify the frontend in the `frontend/` directory to create your desired UI.
2. Add backend functionality in `main.go`.
3. Use `wails3 dev` to see your changes in real-time.
4. When ready, build your application with `wails3 build`.

Happy coding with Wails3! If you encounter any issues or have questions, don't hesitate to consult the documentation or reach out to the Wails community.

## Packaging

Follow these steps to package a production build of the application.

### Prerequisites

1. **Generate Dependency Licenses**:
   Before packaging, you must collect and generate the dependency licenses:

   ```bash
   task licenses:collect
   ```

2. **Set Up Docker (Recommended)**:
   Since the project uses CGO, cross-compilation requires a Docker environment. Build and configure the cross-compilation Docker image using:
   ```bash
   task setup:docker
   ```
   _Note: Alternatively, if you are building on a Windows host, you can use a local CGO-compatible GCC compiler, but using Docker is still highly recommended._

### Packaging for Windows

To trigger the Docker-based Windows compilation and packaging:

1. Ensure the prerequisites above are completed.
2. Run the packaging command with `CGO_ENABLED=1` passed as a task variable (not an environment variable):
   ```bash
   task windows:package CGO_ENABLED=1
   ```
3. **Important for ARM Hosts (e.g., Apple Silicon Macs)**:
   If you are building on an ARM architecture host, you must also pass the architecture `ARCH=amd64` to the task. Otherwise, NSIS will package the application as `arm64`:
   ```bash
   task windows:package CGO_ENABLED=1 ARCH=amd64
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
