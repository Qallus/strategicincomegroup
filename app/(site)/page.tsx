import { HomeHero } from "@/components/public-site/home-hero";
import { HomeSections } from "@/components/public-site/home-sections";
import { getAllPosts } from "@/lib/public-site/posts";

export const revalidate = 300;

export default async function HomePage() {
  const posts = (await getAllPosts()).slice(0, 3);

  return (
    <>
      <HomeHero />
      <HomeSections posts={posts} />
    </>
  );
}
