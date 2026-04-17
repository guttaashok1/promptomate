const PLACEHOLDER_RE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

export function extractSecretNames(text: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) names.add(m[1]);
  return [...names];
}

export function resolveSecrets(names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const n of names) {
    const v = process.env[n];
    if (v == null || v === "") missing.push(n);
    else out[n] = v;
  }
  if (missing.length) {
    throw new Error(
      `Missing secret(s) from environment: ${missing.join(", ")}. Set them in .env or export them in your shell.`,
    );
  }
  return out;
}

export function substituteSecretsDeep<T>(value: T, secrets: Record<string, string>): T {
  if (typeof value === "string") {
    return value.replace(PLACEHOLDER_RE, (_, name) =>
      Object.prototype.hasOwnProperty.call(secrets, name) ? secrets[name] : `\${${name}}`,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => substituteSecretsDeep(v, secrets)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteSecretsDeep(v, secrets);
    }
    return out as unknown as T;
  }
  return value;
}

export function scrubSecrets(text: string, secrets: Record<string, string>): string {
  let out = text;
  for (const [name, value] of Object.entries(secrets)) {
    if (!value) continue;
    out = out.split(value).join(`\${${name}}`);
  }
  return out;
}
