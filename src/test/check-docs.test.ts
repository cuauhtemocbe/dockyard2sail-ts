import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/check-docs.sh");

const VALID_README = [
  "## 🐳 Comandos Docker",
  "",
  "La imagen de producción está pineada por digest para builds reproducibles.",
  "La imagen de dev usa un tag flotante para recibir parches de seguridad automáticamente.",
  "",
].join("\n");

interface FixtureOptions {
  license?: boolean;
  readme?: string;
}

function makeFixtureDir(opts: FixtureOptions = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "check-docs-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "9.9.9" }));
  writeFileSync(join(dir, "CHANGELOG.md"), "## [9.9.9]\n");
  writeFileSync(join(dir, "CLAUDE.md"), "## CI/CD (GitHub Actions)\n");
  if (opts.license !== false) {
    writeFileSync(join(dir, "LICENSE"), "MIT\n");
  }
  writeFileSync(join(dir, "README.md"), opts.readme ?? VALID_README);
  return dir;
}

function runCheckDocs(dir: string): { status: number; output: string } {
  try {
    const output = execFileSync("bash", [scriptPath], { cwd: dir, encoding: "utf-8" });
    return { status: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: string };
    return { status: err.status ?? 1, output: err.stdout ?? "" };
  }
}

describe("scripts/check-docs.sh", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("passes when LICENSE and the README pinning explanation are present", () => {
    dir = makeFixtureDir();

    const { status, output } = runCheckDocs(dir);

    expect(status).toBe(0);
    expect(output).toMatch(/LICENSE/i);
  });

  it("fails with a clear message when LICENSE is missing", () => {
    dir = makeFixtureDir({ license: false });

    const { status, output } = runCheckDocs(dir);

    expect(status).not.toBe(0);
    expect(output).toMatch(/LICENSE/i);
  });

  it("fails when README is missing the digest-pinning explanation", () => {
    dir = makeFixtureDir({
      readme:
        "La imagen de dev usa un tag flotante para recibir parches de seguridad automáticamente.",
    });

    const { status, output } = runCheckDocs(dir);

    expect(status).not.toBe(0);
    expect(output).toMatch(/digest/i);
  });

  it("fails when README is missing the floating-tag explanation", () => {
    dir = makeFixtureDir({
      readme: "La imagen de producción está pineada por digest para builds reproducibles.",
    });

    const { status, output } = runCheckDocs(dir);

    expect(status).not.toBe(0);
    expect(output).toMatch(/tag flotante/i);
  });
});
