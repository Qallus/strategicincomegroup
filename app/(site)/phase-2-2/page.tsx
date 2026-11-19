import { PhasePage } from "@/components/public-site/phase-page";

export const metadata = {
  title: "Phase II — The Accumulating Wealth Phase",
  description: "Grow your wealth with flexible, tax-efficient strategies that adapt to life’s changes and give every dollar a purpose.",
};

export default function PhaseTwoPage() {
  return (
    <PhasePage
      numeral="II"
      name="The Accumulating Wealth Phase"
      href="/phase-2-2"
      intro="In the Accumulating Wealth Phase, we focus on growing your wealth through sophisticated strategies that adapt to life's changes. We ensure that your investments remain flexible and aligned with your evolving goals, leverage our deep understanding of tax laws to help you keep more of what you earn, and give every dollar a purpose within your comprehensive financial plan."
      stepsTitle="Moving into Phase II"
      stepsIntro="Your financial strategy transforms from a step-by-step plan into a customized set of tasks designed to build not just a prosperous retirement, but a life that aligns with your pre-retirement and retirement goals—whether it’s buying a second home, paying for college, planning a wedding, or securing a comfortable retirement."
      prev={{ href: "/phase-1-2", label: "Back to Phase I" }}
      next={{ href: "/phase-3-2", label: "Next Phase III" }}
      steps={[
        {
          title: "Define Goals and Purpose",
          body: (
            <p>
              The first step is establishing clear, measurable financial goals. Whether it’s retirement, education, charitable giving, or lifestyle
              objectives, we ensure every dollar in your plan has a specific purpose. This step helps clarify the funding needed for each goal and
              aligns your wealth-building strategy with your values and legacy.
            </p>
          ),
        },
        {
          title: "Flexible Investment Strategy",
          body: (
            <p>
              Life can change, and so should your investments. We design a flexible, diversified portfolio that can adapt as your circumstances
              evolve. This strategy enables us to adjust your asset allocation as needed, ensuring that you stay on track to achieve your goals while
              minimizing risk.
            </p>
          ),
        },
        {
          title: "Tax-Efficient Growth",
          body: (
            <p>
              We work closely with you to create tax-efficient strategies that allow you to keep more of what you earn. By understanding and utilizing
              tax laws, we optimize account funding and reduce tax liabilities, helping your wealth grow faster while securing your long-term
              financial goals.
            </p>
          ),
        },
        {
          title: "Advanced Wealth-Building Tools",
          body: (
            <p>
              As your wealth grows, we introduce sophisticated tools and investment vehicles such as private equity, alternative investments, and other
              custom strategies that maximize growth potential. These advanced tools provide additional opportunities to fund your goals while
              balancing risk and return.
            </p>
          ),
        },
        {
          title: "Monitor and Adjust",
          body: (
            <p>
              Regularly reviewing your financial plan ensures that it continues to align with your evolving goals. We monitor your investments, adjust
              account funding, and refine your strategy to capitalize on new opportunities or address life changes, keeping you on course for
              sustained success.
            </p>
          ),
        },
      ]}
    />
  );
}
