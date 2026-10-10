export default {
  "*.{ts,tsx,js,jsx,json}": ["biome check --write --no-errors-on-unmatched"],
  // typecheck operates on the whole project, not individual files — a function
  // config runs a fixed command instead of getting staged paths appended
  // (`tsc --noEmit <file>` is not equivalent to running it project-wide).
  // `build` is deliberately not here (issue #86): this runs in the dev container
  // as the host user, where `vite build` fails (the node_modules volume is
  // root-owned) and would empty the root-written dist/. It runs in `make
  // validate` and CI instead.
  "*.{ts,tsx,js,jsx}": () => ["pnpm run typecheck"],
};
