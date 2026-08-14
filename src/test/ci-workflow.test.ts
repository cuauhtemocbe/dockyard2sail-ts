import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface WorkflowJob {
  needs?: string | string[];
  [key: string]: unknown;
}

interface Workflow {
  jobs: Record<string, WorkflowJob>;
}

function needsList(job: WorkflowJob | undefined): string[] {
  const needs = job?.needs;
  if (!needs) return [];
  return Array.isArray(needs) ? needs : [needs];
}

const workflowPath = resolve(process.cwd(), ".github/workflows/ci.yml");
const workflow = load(readFileSync(workflowPath, "utf-8")) as Workflow;

describe("CI workflow job graph", () => {
  const independentJobs = ["lock-check", "lint", "typecheck", "test"];

  it.each(independentJobs)("defines a %s job", (jobName) => {
    expect(workflow.jobs).toHaveProperty(jobName);
  });

  it("defines a build job", () => {
    expect(workflow.jobs).toHaveProperty("build");
  });

  it.each(independentJobs)("%s does not depend on any of the other independent jobs", (jobName) => {
    const others = independentJobs.filter((other) => other !== jobName);
    const needs = needsList(workflow.jobs[jobName]);

    for (const other of others) {
      expect(needs).not.toContain(other);
    }
  });

  it("build depends on lint and test", () => {
    const needs = needsList(workflow.jobs.build);

    expect(needs).toEqual(expect.arrayContaining(["lint", "test"]));
  });
});

describe("CI workflow docker-image job", () => {
  it("defines a docker-image job", () => {
    expect(workflow.jobs).toHaveProperty("docker-image");
  });

  it("depends on lint and test", () => {
    const needs = needsList(workflow.jobs["docker-image"]);

    expect(needs).toEqual(expect.arrayContaining(["lint", "test"]));
  });

  it("is gated to a push on main", () => {
    const condition = workflow.jobs["docker-image"]?.if;

    expect(condition).toEqual(expect.stringContaining("github.event_name == 'push'"));
    expect(condition).toEqual(expect.stringContaining("refs/heads/main"));
  });

  it("builds the production image and runs a Trivy image scan", () => {
    const steps = workflow.jobs["docker-image"]?.steps as
      | Array<Record<string, unknown>>
      | undefined;
    expect(steps).toBeDefined();

    const buildStep = steps?.find(
      (step) => typeof step.run === "string" && step.run.includes("docker build"),
    );
    expect(buildStep).toBeDefined();

    const scanStep = steps?.find(
      (step) => typeof step.uses === "string" && step.uses.startsWith("aquasecurity/trivy-action@"),
    );
    expect(scanStep).toBeDefined();
    expect((scanStep?.with as Record<string, unknown> | undefined)?.["scan-type"]).toBe("image");
  });
});
