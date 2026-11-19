import { PhasePage } from "@/components/public-site/phase-page";

export const metadata = {
  title: "Phase III — The Strategic Income Phase",
  description: "Convert your wealth into reliable income streams that support both your lifestyle and your legacy.",
};

const BUCKETS = [
  { name: "Reserve Bucket", copy: "Covers 12 months of living expenses." },
  { name: "Income Bucket", copy: "Provides cash flow for years 2-4." },
  { name: "Income+ Bucket", copy: "Covers years 4-7 with a mix of income and growth assets." },
  { name: "Long-Term Growth Bucket", copy: "Holds growth assets for years 7+, supporting future needs." },
];

export default function PhaseThreePage() {
  return (
    <PhasePage
      numeral="III"
      name="The Strategic Income Phase"
      href="/phase-3-2"
      intro="In the Strategic Income Phase, we help you convert your wealth into reliable income streams, supporting both your lifestyle and legacy. This phase reflects our mission to empower clients to live abundantly and create a lasting impact, all while adhering to our core values of servant leadership, disciplined planning, and purposeful living."
      stepsTitle="Here’s how we support you"
      stepsIntro="As you enter Phase III, your financial strategy evolves to focus on both income management and continued growth. We’ll guide you through managing income streams, preserving assets, and maintaining flexibility, so you can enjoy your retirement while keeping your long-term goals and legacy in mind."
      prev={{ href: "/phase-2-2", label: "Back to Phase II" }}
      steps={[
        {
          title: "Define Income Needs and Goals",
          body: (
            <p>
              We begin by working with you to define your income needs—whether it’s for retirement, charitable giving, or legacy goals. Every dollar
              in your plan is given a purpose that aligns with your financial vision.
            </p>
          ),
        },
        {
          title: "Bucket Strategy for Structured Income",
          body: (
            <>
              <p>Our bucket strategy helps ensure a balanced approach to income management:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {BUCKETS.map((b, i) => (
                  <div key={b.name} className="rounded-lg border bg-background p-4">
                    <p className="text-xs font-semibold text-gold">Bucket {i + 1}</p>
                    <p className="mt-1 font-medium text-foreground">{b.name}</p>
                    <p className="mt-1 text-sm">{b.copy}</p>
                  </div>
                ))}
              </div>
              <p>This strategy allows for flexibility while managing risks.</p>
            </>
          ),
        },
        {
          title: "Tax-Efficient Income Distribution",
          body: (
            <p>
              We optimize your income distributions through tax-efficient strategies, including Qualified Charitable Distributions (QCDs), when
              appropriate. By managing withdrawals from taxable and tax-advantaged accounts, we aim to reduce tax liabilities while supporting your
              income needs.
            </p>
          ),
        },
        {
          title: "Preserve Wealth and Manage Risk",
          body: (
            <p>
              We use risk management strategies such as diversification into private credit, private real estate and equity along with hedge
              strategies to help protect your wealth. While we cannot guarantee outcomes, our goal is to provide a structured approach that seeks to
              balance income generation with wealth preservation.
            </p>
          ),
        },
        {
          title: "Legacy and Impact Planning",
          body: (
            <p>
              We work with you to ensure that your wealth continues to support the people and causes that matter to you. Whether through estate
              planning, charitable giving, or creating a lasting family legacy, we guide you and your family in aligning your wealth with your
              long-term vision.
            </p>
          ),
        },
        {
          title: "Monitor and Adjust",
          body: (
            <p>
              We regularly review your financial plan, making necessary adjustments to reflect changing life circumstances, market conditions, or
              income needs. This ensures that your income strategy remains aligned with your overall financial goals.
            </p>
          ),
        },
      ]}
    />
  );
}
