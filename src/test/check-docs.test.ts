import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(process.cwd(), "scripts/check-docs.sh");

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const CHAIN = `node:26.13.0-alpine3.24@${DIGEST_A}`;
const OTHER_CHAIN = `node:26.13.0-alpine3.24@${DIGEST_B}`;

const PROD_EXPLANATION = "Las imágenes están pineadas por digest para builds reproducibles.";
const SHARED_CHAIN_EXPLANATION =
  "Dev y producción usan la misma cadena node:<tag>@sha256:<digest>.";
const REFRESH_EXPLANATION =
  "Para refrescarla: docker pull node:<tag> y docker inspect sobre esa imagen.";
const DEPENDABOT_EXPLANATION = "Dependabot (ecosistema docker) la mantiene al día.";

function readmeWith(...lines: string[]): string {
  return ["## 🐳 Comandos Docker", "", ...lines, ""].join("\n");
}

const VALID_README = readmeWith(
  PROD_EXPLANATION,
  SHARED_CHAIN_EXPLANATION,
  REFRESH_EXPLANATION,
  DEPENDABOT_EXPLANATION,
);

const VALID_DOCKERFILE = [
  `FROM ${CHAIN} AS builder`,
  "RUN echo build",
  `FROM ${CHAIN} AS production`,
  'CMD ["echo", "ok"]',
  "",
].join("\n");

const VALID_DOCKERFILE_DEV = [`FROM ${CHAIN}`, "RUN echo dev", ""].join("\n");

interface FixtureOptions {
  license?: boolean;
  readme?: string;
  dockerfile?: string | null;
  dockerfileDev?: string | null;
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
  if (opts.dockerfile !== null) {
    writeFileSync(join(dir, "Dockerfile"), opts.dockerfile ?? VALID_DOCKERFILE);
  }
  if (opts.dockerfileDev !== null) {
    writeFileSync(join(dir, "Dockerfile.dev"), opts.dockerfileDev ?? VALID_DOCKERFILE_DEV);
  }
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

  it("passes when LICENSE, the README pinning explanation and the node chain are present", () => {
    dir = makeFixtureDir();

    const { status, output } = runCheckDocs(dir);

    expect(status).toBe(0);
    expect(output).toMatch(/LICENSE/i);
    expect(output).toMatch(/misma cadena/i);
  });

  it("fails with a clear message when LICENSE is missing", () => {
    dir = makeFixtureDir({ license: false });

    const { status, output } = runCheckDocs(dir);

    expect(status).not.toBe(0);
    expect(output).toMatch(/LICENSE/i);
  });

  describe("README pinning explanation", () => {
    it("fails when README is missing the digest-pinning explanation", () => {
      dir = makeFixtureDir({
        readme: readmeWith(SHARED_CHAIN_EXPLANATION, REFRESH_EXPLANATION, DEPENDABOT_EXPLANATION),
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/digest/i);
    });

    it("fails when README is missing the same-chain-in-dev-and-prod explanation", () => {
      dir = makeFixtureDir({
        readme: readmeWith(PROD_EXPLANATION, REFRESH_EXPLANATION, DEPENDABOT_EXPLANATION),
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/README\.md: falta .*misma cadena/i);
    });

    it("fails when README is missing how to refresh the chain", () => {
      dir = makeFixtureDir({
        readme: readmeWith(PROD_EXPLANATION, SHARED_CHAIN_EXPLANATION, DEPENDABOT_EXPLANATION),
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/README\.md: falta .*refrescar/i);
    });

    it("fails when README is missing the Dependabot explanation", () => {
      dir = makeFixtureDir({
        readme: readmeWith(PROD_EXPLANATION, SHARED_CHAIN_EXPLANATION, REFRESH_EXPLANATION),
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/README\.md: falta .*Dependabot/i);
    });

    it("fails when README still describes the old dev-vs-prod asymmetry", () => {
      dir = makeFixtureDir({
        readme: readmeWith(
          PROD_EXPLANATION,
          "La imagen de dev usa un tag flotante para recibir parches de seguridad automáticamente.",
        ),
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/misma cadena/i);
    });
  });

  describe("node chain in Dockerfile and Dockerfile.dev", () => {
    it("fails when Dockerfile.dev uses a different chain than Dockerfile", () => {
      dir = makeFixtureDir({ dockerfileDev: `FROM ${OTHER_CHAIN}\n` });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/misma cadena .* 2 distintas/);
      expect(output).toContain(CHAIN);
      expect(output).toContain(OTHER_CHAIN);
    });

    it("fails when the builder and production stages of Dockerfile use different chains", () => {
      dir = makeFixtureDir({
        dockerfile: `FROM ${CHAIN} AS builder\nFROM ${OTHER_CHAIN} AS production\n`,
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/misma cadena .* 2 distintas/);
    });

    it("fails when Dockerfile.dev goes back to a tag without digest", () => {
      dir = makeFixtureDir({ dockerfileDev: "FROM node:26-alpine\n" });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/1 sin digest/);
      expect(output).toContain("node:26-alpine");
    });

    it("fails when a digest is not a full sha256", () => {
      dir = makeFixtureDir({ dockerfileDev: "FROM node:26-alpine@sha256:abc123\n" });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/sin digest/);
    });

    it("fails when Dockerfile.dev is missing", () => {
      dir = makeFixtureDir({ dockerfileDev: null });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/Dockerfile\.dev not found/);
    });

    it("fails when Dockerfile is missing", () => {
      dir = makeFixtureDir({ dockerfile: null });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/Dockerfile not found/);
    });

    it("fails when no FROM node: line exists in either file", () => {
      dir = makeFixtureDir({
        dockerfile: "FROM alpine:3.24\n",
        dockerfileDev: "FROM alpine:3.24\n",
      });

      const { status, output } = runCheckDocs(dir);

      expect(status).not.toBe(0);
      expect(output).toMatch(/ninguna línea FROM node:/);
    });

    it("ignores non-node FROM lines when the node ones share the chain", () => {
      dir = makeFixtureDir({
        dockerfile: `FROM alpine:3.24 AS tools\nFROM ${CHAIN} AS production\n`,
      });

      const { status } = runCheckDocs(dir);

      expect(status).toBe(0);
    });
  });
});
