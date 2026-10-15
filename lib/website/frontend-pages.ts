// Frontend Editor — the catalogue of public pages Mike can point at.
//
// The website has two kinds of page and the difference decides what can happen
// when he describes an edit:
//
//   "managed"    — a website_pages row. Shepherd reads it, proposes a change set,
//                  the change lands in a draft, he previews it and publishes.
//
//   "code"       — a page built in the repository (a static file under main/, or
//                  a React route). It has no block model, so no amount of
//                  prompting can rewrite it from the dashboard. A description of
//                  the change goes to the developer queue instead.
//
// Keeping the code-owned list here rather than inferring it means the picker
// shows Mike the whole site, not just the part the editor happens to own.

export type FrontendPageKind = "managed" | "code";

export type CodeOwnedPage = {
  slug: string;
  label: string;
  path: string;
  /** Where the page actually lives, shown to editors and sent to the developer. */
  source: string;
  group: string;
};

/**
 * Public, code-owned pages worth listing. Application routes (login, dashboard,
 * checkout and the rest) are deliberately absent — they are not content.
 */
export const CODE_OWNED_PAGES: CodeOwnedPage[] = [
  { slug: "home", label: "Home", path: "/", source: "app/(site)/page.tsx", group: "Marketing site" },
  { slug: "events", label: "Events", path: "/events", source: "app/events", group: "Marketing site" },
  { slug: "book", label: "Booking", path: "/book", source: "app/book", group: "Marketing site" },
];

/** One row in the page picker, whichever kind of page it describes. */
export type PickablePage = {
  /** website_pages id for managed pages; `code:<slug>` for code-owned ones. */
  id: string;
  kind: FrontendPageKind;
  label: string;
  path: string;
  group: string;
  status?: string;
  /** Code-owned only — where a developer would go to change it. */
  source?: string;
};

export function codeOwnedToPickable(page: CodeOwnedPage): PickablePage {
  return {
    id: `code:${page.slug}`,
    kind: "code",
    label: page.label,
    path: page.path,
    group: page.group,
    source: page.source,
  };
}

export function findCodeOwnedPage(id: string): CodeOwnedPage | undefined {
  if (!id.startsWith("code:")) return undefined;
  const slug = id.slice("code:".length);
  return CODE_OWNED_PAGES.find((p) => p.slug === slug);
}
