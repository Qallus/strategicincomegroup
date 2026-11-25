"use client";

import * as React from "react";
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Embla carousel on SIG tokens: one horizontal, swipeable track with arrow buttons
// and edge fades that only appear when there is more to scroll in that direction.

type CarouselApi = UseEmblaCarouselType[1];
type CarouselOptions = Parameters<typeof useEmblaCarousel>[0];

type CarouselCtx = {
  viewportRef: UseEmblaCarouselType[0];
  api: CarouselApi;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
};

const CarouselContext = React.createContext<CarouselCtx | null>(null);

export function useCarousel() {
  const ctx = React.useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used inside <Carousel>");
  return ctx;
}

function Carousel({
  opts,
  className,
  children,
  setApi,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { opts?: CarouselOptions; setApi?: (api: CarouselApi) => void }) {
  const [viewportRef, api] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps", dragFree: true, ...opts });
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const sync = React.useCallback((a: CarouselApi) => {
    if (!a) return;
    setCanPrev(a.canScrollPrev());
    setCanNext(a.canScrollNext());
  }, []);

  React.useEffect(() => {
    if (!api) return;
    setApi?.(api);
    sync(api);
    api.on("select", sync).on("reInit", sync).on("scroll", sync).on("resize", sync);
    return () => {
      api.off("select", sync).off("reInit", sync).off("scroll", sync).off("resize", sync);
    };
  }, [api, setApi, sync]);

  const prev = React.useCallback(() => api?.scrollPrev(), [api]);
  const next = React.useCallback(() => api?.scrollNext(), [api]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    },
    [prev, next],
  );

  return (
    <CarouselContext.Provider value={{ viewportRef, api, canPrev, canNext, prev, next }}>
      <div role="region" aria-roledescription="carousel" className={cn("relative", className)} onKeyDown={onKeyDown} {...props}>
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

function CarouselContent({ className, children, fades = true }: { className?: string; children: React.ReactNode; fades?: boolean }) {
  const { viewportRef, canPrev, canNext } = useCarousel();
  return (
    <div className="relative">
      <div ref={viewportRef} className="-my-4 overflow-hidden py-4">
        <div className={cn("-ml-3 flex touch-pan-y sm:-ml-4", className)}>{children}</div>
      </div>
      {fades ? (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 -left-px w-8 bg-gradient-to-r from-background via-background/70 to-transparent transition-opacity duration-300 motion-reduce:transition-none sm:w-12",
              canPrev ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 -right-px w-10 bg-gradient-to-l from-background via-background/70 to-transparent transition-opacity duration-300 motion-reduce:transition-none sm:w-16",
              canNext ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : null}
    </div>
  );
}

function CarouselItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" aria-roledescription="slide" className={cn("min-w-0 shrink-0 grow-0 pl-3 sm:pl-4", className)} {...props} />;
}

function CarouselArrows({ className, label = "cards" }: { className?: string; label?: string }) {
  const { canPrev, canNext, prev, next } = useCarousel();
  if (!canPrev && !canNext) return null;
  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:border-brand-gold/60 hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button type="button" className={btn} onClick={prev} disabled={!canPrev} aria-label={`Previous ${label}`}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" className={btn} onClick={next} disabled={!canNext} aria-label={`Next ${label}`}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export { Carousel, CarouselContent, CarouselItem, CarouselArrows, type CarouselApi };
