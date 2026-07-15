export default {
  "*.{ts,tsx,js,jsx,json}": ["biome check --write --no-errors-on-unmatched"],
  // typecheck/build operate on the whole project, not individual files — a
  // function config runs a fixed command instead of getting staged paths
  // appended (which broke both: `tsc --noEmit <file>` and `vite build <file>`
  // are not equivalent to running them project-wide).
  "*.{ts,tsx,js,jsx}": () => ["pnpm run typecheck", "pnpm run build"],
};
