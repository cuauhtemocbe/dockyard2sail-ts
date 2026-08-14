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
