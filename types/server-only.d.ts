// `server-only` is resolved by Next.js itself (next/dist/compiled/server-only): an empty
// module in server bundles and a build error if a client component imports it. The
// package isn't installed separately, so declare it for the type checker.
declare module "server-only";
