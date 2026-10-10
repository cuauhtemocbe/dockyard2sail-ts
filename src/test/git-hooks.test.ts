import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf-8");

// Executable lines only: comments may mention host tools (pnpm, node) while
// explaining why the hook avoids them, which is not the same as invoking them.
function codeLines(source: string, commentPrefix = "#"): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith(commentPrefix));
}

// Recipe of a Makefile target: the tab-indented lines right after `target:`.
function makeRecipe(makefile: string, target: string): string[] {
  const lines = makefile.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${target}:`));
  if (start === -1) return [];
  const recipe: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("\t")) break;
    recipe.push(line.trim());
  }
  return recipe.filter((line) => !line.startsWith("#"));
}

function makeTargetLine(makefile: string, target: string): string {
  return makefile.split("\n").find((line) => line.startsWith(`${target}:`)) ?? "";
}

describe("pre-commit hook runs lint-staged inside the container", () => {
  const hook = codeLines(read(".husky/pre-commit")).join("\n");

  it("delegates lint-staged to the make target", () => {
    expect(hook).toMatch(/^make lint-staged\b/m);
  });

  it("does not invoke host node tooling", () => {
    expect(hook).not.toMatch(/\b(pnpm|npx|npm|yarn|node)\b/);
  });
});

describe("make lint-staged target", () => {
  const makefile = read("Makefile");
  const recipe = makeRecipe(makefile, "lint-staged").join("\n");

  it("is declared in .PHONY", () => {
    expect(makefile).toMatch(/^\.PHONY:.*\blint-staged\b/m);
  });

  it("is documented in make help", () => {
    expect(makeTargetLine(makefile, "lint-staged")).toMatch(/## \S/);
  });

  it("does not depend on up-d, which rebuilds and force-recreates the container on every commit", () => {
    const targetLine = makeTargetLine(makefile, "lint-staged");
    const dependencies = targetLine.split("##")[0] ?? "";

    expect(targetLine).not.toBe("");
    expect(dependencies).not.toMatch(/\bup-d\b/);
  });

  it("starts the container without rebuilding or recreating it", () => {
    expect(recipe).toMatch(/docker compose up -d --wait/);
    expect(recipe).not.toMatch(/--build|--force-recreate/);
  });

  it("runs lint-staged in the container as the host user, not root", () => {
    expect(recipe).toMatch(/docker compose exec\b/);
    expect(recipe).toMatch(/--user "\$\$\(id -u\):\$\$\(id -g\)"/);
    expect(recipe).toMatch(/pnpm exec lint-staged/);
  });

  it("disables the TTY, which git hooks do not have", () => {
    expect(recipe).toMatch(/docker compose exec\b[^\n]*\s-T\b/);
  });
});

describe(".lintstagedrc.mjs tasks", () => {
  type Task = string | string[] | ((files: string[]) => string | string[]);

  async function allCommands(): Promise<string[]> {
    const href = pathToFileURL(resolve(process.cwd(), ".lintstagedrc.mjs")).href;
    const config = (await import(/* @vite-ignore */ href)).default as Record<string, Task>;

    return Object.values(config).flatMap((task) => {
      const commands = typeof task === "function" ? task([]) : task;
      return Array.isArray(commands) ? commands : [commands];
    });
  }

  it("runs Biome on staged files", async () => {
    expect((await allCommands()).some((command) => command.startsWith("biome check"))).toBe(true);
  });

  it("keeps the project-wide typecheck, which is cheap and writes nothing", async () => {
    expect((await allCommands()).some((command) => command.includes("typecheck"))).toBe(true);
  });

  it("does not run the build: vite build cannot write as the host user in the container and would touch dist/", async () => {
    expect((await allCommands()).some((command) => /\bbuild\b/.test(command))).toBe(false);
  });
});

describe("CLAUDE.md Git Hooks section", () => {
  const claude = read("CLAUDE.md");
  const preCommitBullet =
    claude.match(/- \*\*`pre-commit`\*\*:[\s\S]*?(?=\n- \*\*`pre-push`\*\*)/)?.[0] ?? "";

  it("describes the pre-commit hook", () => {
    expect(preCommitBullet).not.toBe("");
  });

  it("says pre-commit runs lint-staged through make lint-staged, in the container", () => {
    expect(preCommitBullet).toMatch(/make lint-staged/);
    expect(preCommitBullet).toMatch(/contenedor|Docker/);
  });

  it("no longer claims pre-commit runs gitleaks and nothing else", () => {
    expect(preCommitBullet).not.toMatch(/y nada más/);
  });
});
