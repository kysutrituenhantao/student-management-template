const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;
export type Level = keyof typeof LEVELS;

let minLevel: number = LEVELS.info;

export function setLogLevel(level: string | undefined): void {
  minLevel = LEVELS[(level as Level) ?? "info"] ?? LEVELS.info;
}

/** One JSON object per line, so Workers Logs and `docker compose logs` can be filtered by field. */
export function log(level: Exclude<Level, "silent">, msg: string, fields: Record<string, unknown> = {}): void {
  if (LEVELS[level] < minLevel) return;
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function errorFields(err: unknown): Record<string, unknown> {
  return err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) };
}
