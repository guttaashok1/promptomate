import { afterEach, describe, expect, test } from "vitest";
import { DEFAULT_MODEL, resolveModel } from "../src/models.js";

describe("resolveModel", () => {
  const saved = process.env.PROMPTOMATE_MODEL;
  afterEach(() => {
    if (saved === undefined) delete process.env.PROMPTOMATE_MODEL;
    else process.env.PROMPTOMATE_MODEL = saved;
  });

  test("returns default when nothing provided", () => {
    delete process.env.PROMPTOMATE_MODEL;
    expect(resolveModel()).toBe(DEFAULT_MODEL);
  });

  test("resolves opus alias", () => {
    expect(resolveModel("opus")).toBe("claude-opus-4-7");
  });

  test("resolves sonnet alias", () => {
    expect(resolveModel("sonnet")).toBe("claude-sonnet-4-6");
  });

  test("resolves haiku alias", () => {
    expect(resolveModel("haiku")).toBe("claude-haiku-4-5");
  });

  test("passes through an explicit full model id", () => {
    expect(resolveModel("claude-opus-4-6")).toBe("claude-opus-4-6");
  });

  test("CLI arg wins over env var", () => {
    process.env.PROMPTOMATE_MODEL = "haiku";
    expect(resolveModel("opus")).toBe("claude-opus-4-7");
  });

  test("env var wins over default when no CLI arg", () => {
    process.env.PROMPTOMATE_MODEL = "sonnet";
    expect(resolveModel()).toBe("claude-sonnet-4-6");
  });

  test("env var also goes through alias map", () => {
    process.env.PROMPTOMATE_MODEL = "haiku";
    expect(resolveModel()).toBe("claude-haiku-4-5");
  });
});
