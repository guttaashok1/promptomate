import { beforeEach, describe, expect, test } from "vitest";
import {
  extractSecretNames,
  resolveSecrets,
  scrubSecrets,
  substituteSecretsDeep,
} from "../src/secrets.js";

describe("extractSecretNames", () => {
  test("returns empty for text with no placeholders", () => {
    expect(extractSecretNames("just plain text")).toEqual([]);
  });

  test("extracts a single placeholder", () => {
    expect(extractSecretNames("log in with ${SAUCE_PASSWORD}")).toEqual([
      "SAUCE_PASSWORD",
    ]);
  });

  test("extracts multiple distinct placeholders", () => {
    expect(
      extractSecretNames("login as ${USERNAME} with ${PASSWORD}"),
    ).toEqual(["USERNAME", "PASSWORD"]);
  });

  test("dedupes duplicate placeholders", () => {
    expect(extractSecretNames("${FOO} and ${FOO} again")).toEqual(["FOO"]);
  });

  test("ignores lowercase (must be UPPER_CASE)", () => {
    expect(extractSecretNames("${foo}")).toEqual([]);
  });

  test("ignores non-placeholder dollar signs", () => {
    expect(extractSecretNames("price is $10 for ${ITEM}")).toEqual(["ITEM"]);
  });
});

describe("resolveSecrets", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved.TEST_SECRET_A = process.env.TEST_SECRET_A;
    saved.TEST_SECRET_B = process.env.TEST_SECRET_B;
    delete process.env.TEST_SECRET_A;
    delete process.env.TEST_SECRET_B;
    return () => {
      if (saved.TEST_SECRET_A !== undefined) process.env.TEST_SECRET_A = saved.TEST_SECRET_A;
      if (saved.TEST_SECRET_B !== undefined) process.env.TEST_SECRET_B = saved.TEST_SECRET_B;
    };
  });

  test("returns values from process.env", () => {
    process.env.TEST_SECRET_A = "alpha";
    process.env.TEST_SECRET_B = "beta";
    expect(resolveSecrets(["TEST_SECRET_A", "TEST_SECRET_B"])).toEqual({
      TEST_SECRET_A: "alpha",
      TEST_SECRET_B: "beta",
    });
  });

  test("throws with a list of missing vars", () => {
    process.env.TEST_SECRET_A = "present";
    expect(() => resolveSecrets(["TEST_SECRET_A", "TEST_SECRET_B"])).toThrow(
      /TEST_SECRET_B/,
    );
  });

  test("treats empty string as missing", () => {
    process.env.TEST_SECRET_A = "";
    expect(() => resolveSecrets(["TEST_SECRET_A"])).toThrow(/TEST_SECRET_A/);
  });

  test("returns empty object for empty input", () => {
    expect(resolveSecrets([])).toEqual({});
  });
});

describe("substituteSecretsDeep", () => {
  const secrets = { USER: "alice", PASS: "s3cret" };

  test("replaces placeholders in strings", () => {
    expect(substituteSecretsDeep("hello ${USER}", secrets)).toBe("hello alice");
  });

  test("replaces multiple placeholders in one string", () => {
    expect(
      substituteSecretsDeep("${USER}:${PASS}", secrets),
    ).toBe("alice:s3cret");
  });

  test("leaves unknown placeholders intact", () => {
    expect(substituteSecretsDeep("hi ${UNKNOWN}", secrets)).toBe(
      "hi ${UNKNOWN}",
    );
  });

  test("recurses into arrays", () => {
    expect(
      substituteSecretsDeep(["hi ${USER}", "bye"], secrets),
    ).toEqual(["hi alice", "bye"]);
  });

  test("recurses into objects", () => {
    expect(
      substituteSecretsDeep({ k: "v-${USER}", arr: ["${PASS}"] }, secrets),
    ).toEqual({ k: "v-alice", arr: ["s3cret"] });
  });

  test("passes through non-string primitives untouched", () => {
    expect(substituteSecretsDeep(42, secrets)).toBe(42);
    expect(substituteSecretsDeep(true, secrets)).toBe(true);
    expect(substituteSecretsDeep(null, secrets)).toBe(null);
  });
});

describe("scrubSecrets", () => {
  const secrets = { PASS: "s3cret", USER: "alice" };

  test("replaces resolved values with their placeholder", () => {
    expect(
      scrubSecrets("welcome alice, token=s3cret", secrets),
    ).toBe("welcome ${USER}, token=${PASS}");
  });

  test("handles multiple occurrences of the same value", () => {
    expect(scrubSecrets("s3cret s3cret", secrets)).toBe("${PASS} ${PASS}");
  });

  test("returns text unchanged when no secrets appear", () => {
    expect(scrubSecrets("nothing sensitive here", secrets)).toBe(
      "nothing sensitive here",
    );
  });

  test("skips empty values in the map", () => {
    expect(scrubSecrets("keep me", { EMPTY: "" })).toBe("keep me");
  });
});
