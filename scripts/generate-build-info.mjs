import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(rootDir, "package.json");
const outputPath = resolve(rootDir, "src/generated/build-info.ts");

function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}

function readGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unknown";
  }
}

const buildInfo = {
  version: readPackageVersion(),
  commit: readGitCommit(),
  builtAt: new Date().toISOString()
};

const content = `export const buildInfo = ${JSON.stringify(buildInfo, null, 2)} as const;\n`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content, "utf8");

console.log(`Generated ${outputPath}`);
