const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Root licenses directories
const GO_TARGET_DIR = path.resolve(__dirname, "../licenses/go");
const NPM_TARGET_DIR = path.resolve(__dirname, "../licenses/npm");

function runCommand(command, cwd) {
  try {
    execSync(command, { cwd, encoding: "utf8", stdio: "inherit" });
  } catch (error) {
    console.error(`Error running command: ${command}`, error.message);
    process.exit(1);
  }
}

function cleanupGoLicenses(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanupGoLicenses(fullPath);
      // Remove directory if empty after cleaning files
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    } else if (entry.isFile()) {
      const lowerName = entry.name.toLowerCase();
      // Keep files containing 'license', 'copying', 'notice', 'copyright'
      const isLicense =
        lowerName.includes("license") ||
        lowerName.includes("copying") ||
        lowerName.includes("notice") ||
        lowerName.includes("copyright");

      if (!isLicense) {
        fs.unlinkSync(fullPath);
      }
    }
  }
}

function collectNpmLicenses() {
  console.log("Running license-checker for NPM dependencies...");
  let output;
  try {
    output = execSync("npx license-checker --production --json", {
      cwd: path.resolve(__dirname, "../frontend"),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    console.error("Error running license-checker:", error.message);
    process.exit(1);
  }

  const data = JSON.parse(output);

  // Ensure target directory is clean
  if (fs.existsSync(NPM_TARGET_DIR)) {
    fs.rmSync(NPM_TARGET_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(NPM_TARGET_DIR, { recursive: true });

  for (const [pkgKey, pkgInfo] of Object.entries(data)) {
    // Skip private packages (such as the app itself)
    if (pkgInfo.private === true) {
      continue;
    }

    if (!pkgInfo.licenseFile) {
      console.warn(`Warning: No license file found for ${pkgKey}`);
      continue;
    }

    if (!fs.existsSync(pkgInfo.licenseFile)) {
      console.warn(
        `Warning: License file path does not exist: ${pkgInfo.licenseFile}`,
      );
      continue;
    }

    const pkgDirName = pkgKey;
    const destDir = path.join(NPM_TARGET_DIR, pkgDirName);
    fs.mkdirSync(destDir, { recursive: true });

    const srcFile = pkgInfo.licenseFile;
    const destFile = path.join(destDir, path.basename(srcFile));

    try {
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied license for ${pkgKey} to ${destFile}`);
    } catch (err) {
      console.error(`Failed to copy license for ${pkgKey}:`, err.message);
    }
  }
}

function main() {
  const rootDir = path.resolve(__dirname, "..");

  // Ensure the root licenses directory exists
  const parentLicensesDir = path.resolve(__dirname, "../licenses");
  if (!fs.existsSync(parentLicensesDir)) {
    fs.mkdirSync(parentLicensesDir, { recursive: true });
  }

  // 1. Run go-licenses save
  console.log("Running go-licenses save...");
  runCommand(
    `~/go/bin/go-licenses save . --save_path="${GO_TARGET_DIR}" --force`,
    rootDir,
  );

  // 2. Cleanup Go licenses to keep only license text files
  console.log("Cleaning up Go source files from licenses/go...");
  cleanupGoLicenses(GO_TARGET_DIR);

  // 3. Run NPM license collection
  collectNpmLicenses();

  console.log("All licenses collected successfully!");
}

main();
