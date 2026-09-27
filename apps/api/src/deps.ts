/** Everything that depends on the outside world, so tests can swap it. */
export interface Deps {
  now(): Date;
}

export const defaultDeps: Deps = {
  now: () => new Date(),
};
