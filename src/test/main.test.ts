import { describe, expect, it } from "vitest";
import { fetchData, greetUser } from "../main";

describe("Main module", () => {
  it("should greet user correctly", () => {
    const result = greetUser("Test User");
    expect(result).toBe("Hola, Test User! Bienvenido a la plantilla de TypeScript.");
  });

  it("should greet user with empty string", () => {
    const result = greetUser("");
    expect(result).toBe("Hola, ! Bienvenido a la plantilla de TypeScript.");
  });

  it("should fetch data successfully", async () => {
    const result = await fetchData();
    expect(result).toBe("Data loaded successfully!");
  });
});
