import { describe, expect, it } from "vitest";
import { greetUser } from "@/main";
import { greetUser as greetUserRelative } from "../main";

describe("@ path alias (vite.config.ts resolve.alias)", () => {
  it("should resolve @/ to the src directory", () => {
    // Same function reference only if both specifiers land on src/main.ts.
    expect(greetUser).toBe(greetUserRelative);
  });
});
