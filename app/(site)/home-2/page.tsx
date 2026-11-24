import type { Metadata } from "next";
import { HomeHeroCarousel } from "@/components/public-site/home-hero-carousel";
import { HomeSections } from "@/components/public-site/home-sections";
import { getAllPosts } from "@/lib/public-site/posts";

export const revalidate = 300;

// Alternative homepage (team hero carousel) under review — kept out of search.
export const metadata: Metadata = {
  title: "Home (alternate)",
  robots: { index: false, follow: false },
};

export default async function HomeTwoPage() {
  const posts = (await getAllPosts()).slice(0, 3);

  return (
    <>
      <HomeHeroCarousel />
      <HomeSections posts={posts} />
    </>
  );
}
