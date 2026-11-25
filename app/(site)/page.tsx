// Team hero carousel (previously previewed at /home-2). The former static hero lives in
// components/public-site/home-hero.tsx if it needs to come back.
import { HomeHeroCarousel } from "@/components/public-site/home-hero-carousel";
import { HomeSections } from "@/components/public-site/home-sections";
import { getAllPosts } from "@/lib/public-site/posts";

export const revalidate = 300;

export default async function HomePage() {
  const posts = (await getAllPosts()).slice(0, 3);

  return (
    <>
      <HomeHeroCarousel />
      <HomeSections posts={posts} />
    </>
  );
}
