"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Menu, Phone, Search, X } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SiteIcon } from "@/components/public-site/icons";
import { SiteSearchPanel } from "@/components/public-site/site-search";
import { CONTACT, PRIMARY_NAV, type MegaMenu } from "@/lib/public-site/site-data";
import { cn } from "@/lib/utils";

const isMega = (item: (typeof PRIMARY_NAV)[number]): item is MegaMenu => "groups" in item;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function menuHrefs(menu: MegaMenu) {
  return menu.groups.flatMap((g) => g.links.map((l) => l.href));
}

/**
 * Public site header. "About Us" and "Solutions" open compact two-column
 * mega menus (Stripe-style): icon, label and one-line description per link,
 * with a slim feature strip underneath.
 */
export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setMobileOpen(false);
        setSearchOpen(false);
      }
      // "/" opens search from anywhere except while typing in a field.
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(null);
        setSearchOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", mobileOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [mobileOpen]);

  const openMenu = (label: string) => {
    if (searchOpen) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(label);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 140);
  };

  return (
    <>
    <header
      ref={navRef}
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors",
        scrolled ? "border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75" : "border-transparent bg-background",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Strategic Income Group home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sig-logo.png" alt="Strategic Income Group" className="h-7 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sig-logo-white.png" alt="" aria-hidden className="hidden h-7 w-auto dark:block" />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) =>
              isMega(item) ? (
                <li key={item.label} onMouseEnter={() => openMenu(item.label)} onMouseLeave={scheduleClose}>
                  <button
                    type="button"
                    aria-expanded={open === item.label}
                    aria-haspopup="true"
                    onClick={() => (open === item.label ? setOpen(null) : openMenu(item.label))}
                    className={cn(
                      "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors hover:text-foreground",
                      open === item.label || menuHrefs(item).some((h) => isActive(pathname, h))
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open === item.label && "rotate-180")} />
                  </button>
                  {open === item.label ? <MegaPanel menu={item} onNavigate={() => setOpen(null)} /> : null}
                </li>
              ) : (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={cn(
                      "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors hover:text-foreground",
                      isActive(pathname, item.href) ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={searchOpen ? "Close search" : "Search the site"}
            aria-expanded={searchOpen}
            onClick={() => {
              setOpen(null);
              setMobileOpen(false);
              setSearchOpen((v) => !v);
            }}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
              searchOpen && "bg-muted",
            )}
          >
            {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
          </button>
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-md border border-primary/60 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/get-started"
            className="hidden h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 md:inline-flex"
          >
            Get Started
          </Link>
          <ThemeToggle />
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {searchOpen ? <SiteSearchPanel onClose={() => setSearchOpen(false)} /> : null}
      {mobileOpen ? <MobileMenu pathname={pathname} onNavigate={() => setMobileOpen(false)} /> : null}
    </header>
    {searchOpen ? (
      <div aria-hidden onClick={() => setSearchOpen(false)} className="fixed inset-0 top-16 z-40 bg-black/30 backdrop-blur-sm" />
    ) : null}
    </>
  );
}

function MegaPanel({ menu, onNavigate }: { menu: MegaMenu; onNavigate: () => void }) {
  const card = menu.feature?.layout === "card" ? menu.feature : null;
  // Pad every column to the longest one so the link columns always match in height.
  const rows = Math.max(...menu.groups.map((g) => g.links.length));
  return (
    <div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
      <div
        className={cn(
          "sig-pop overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl shadow-black/5 dark:shadow-black/40",
          card ? "w-[min(880px,calc(100vw-2rem))]" : "w-[min(620px,calc(100vw-2rem))]",
        )}
      >
        <div className={cn("grid items-stretch gap-x-2 p-3", card ? "grid-cols-[1fr_1fr_17rem]" : "grid-cols-2")}>
          {menu.groups.map((group) => (
            <div key={group.heading} className="flex flex-col">
              <p className="truncate px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.heading}</p>
              <ul className="grid flex-1" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={onNavigate} className="group flex h-full gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-primary transition-colors group-hover:border-primary/40">
                        <SiteIcon name={link.icon} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-5 text-foreground">{link.label}</span>
                        <span className="mt-0.5 line-clamp-2 block min-h-[2lh] text-xs leading-snug text-muted-foreground">{link.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {card ? (
            <Link
              href={card.href}
              onClick={onNavigate}
              className="sig-on-navy group relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-[hsl(225_95%_15%)] p-6 text-center text-white dark:border dark:bg-[hsl(228_60%_5%)]"
            >
              <span className="sig-grid-bg pointer-events-none absolute inset-0" aria-hidden />
              <span className="relative rounded-full bg-brand-gold px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(225_80%_10%)]">{card.eyebrow}</span>
              <span className="relative mt-3 font-serif text-3xl leading-none">{card.title}</span>
              <span className="relative mt-2 text-xs leading-relaxed text-white/75">{card.copy}</span>
              {card.stat ? (
                <span className="relative mt-4 flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-[hsl(225_80%_10%)]">{card.stat}</span>
                  <span className="mt-1.5 text-sm font-semibold">{card.statLabel}</span>
                </span>
              ) : null}
              <span className="relative mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-white text-sm font-semibold text-[hsl(225_95%_15%)] transition group-hover:bg-brand-gold">
                {card.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : null}
        </div>
        {menu.feature && !card ? (
          <Link
            href={menu.feature.href}
            onClick={onNavigate}
            className="group flex items-center justify-between gap-4 border-t bg-muted/50 px-5 py-3.5 transition-colors hover:bg-muted"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-[hsl(36_60%_38%)] dark:text-brand-gold">
                {menu.feature.eyebrow}
              </span>
              <span className="truncate text-sm">
                <span className="font-medium text-foreground">{menu.feature.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  {menu.feature.stat ? `· ${menu.feature.stat} ${menu.feature.statLabel}` : `· ${menu.feature.copy}`}
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
              {menu.feature.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function MobileMenu({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t bg-background px-4 pb-10 pt-3 sm:px-6 lg:hidden">
      <ul className="divide-y">
        {PRIMARY_NAV.map((item) =>
          isMega(item) ? (
            <li key={item.label}>
              <button
                type="button"
                aria-expanded={expanded === item.label}
                onClick={() => setExpanded((cur) => (cur === item.label ? null : item.label))}
                className="flex w-full items-center justify-between py-3.5 text-base font-medium"
              >
                {item.label}
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded === item.label && "rotate-180")} />
              </button>
              {expanded === item.label ? (
                <ul className="grid gap-1 pb-3">
                  {item.groups.flatMap((g) => g.links).map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted",
                          isActive(pathname, link.href) && "bg-muted",
                        )}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-primary">
                          <SiteIcon name={link.icon} className="h-4 w-4" />
                        </span>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ) : (
            <li key={item.label}>
              <Link href={item.href} onClick={onNavigate} className={cn("block py-3.5 text-base font-medium", isActive(pathname, item.href) && "text-primary")}>
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/login" onClick={onNavigate} className="inline-flex h-11 items-center justify-center rounded-md border text-sm font-medium">
          Login
        </Link>
        <Link href="/get-started" onClick={onNavigate} className="inline-flex h-11 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
          Get Started
        </Link>
      </div>
      <a href={CONTACT.phoneHref} className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Phone className="h-4 w-4" /> {CONTACT.phone}
      </a>
    </div>
  );
}
