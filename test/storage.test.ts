import { describe, expect, test } from "vitest";
import { slugify } from "../src/storage.js";

describe("slugify", () => {
  test("lowercases + hyphenates plain words", () => {
    expect(slugify("Log In With Creds")).toBe("log-in-with-creds");
  });

  test("collapses runs of non-alphanumerics into single hyphens", () => {
    expect(slugify("foo   ///   bar")).toBe("foo-bar");
  });

  test("strips leading and trailing hyphens", () => {
    expect(slugify("   hello world   ")).toBe("hello-world");
  });

  test("truncates to 60 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(60);
  });

  test("falls back to 'test' for empty or all-punctuation input", () => {
    expect(slugify("")).toBe("test");
    expect(slugify("!!!---???")).toBe("test");
  });

  test("keeps digits", () => {
    expect(slugify("checkout step 1")).toBe("checkout-step-1");
  });

  test("drops unicode / emoji", () => {
    expect(slugify("émöji 🎉 test")).toBe("m-ji-test");
  });
});
