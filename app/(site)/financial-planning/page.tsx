import { ShieldCheck } from "lucide-react";
import { ButtonLink, CheckList, CtaBand, PageHero, PhaseCards, PlannerGrid, Section, SectionHeading } from "@/components/public-site/blocks";

export const metadata = {
  title: "Financial Planning",
  description:
    "Overcome financial obstacles and build a brighter financial future with the Three Phases of Wealth planning process from Strategic Income Group.",
};

const PROCESS = [
  "Create a working budget",
  "Appropriate insurance policies",
  "Personalize your estate plan",
  "Pay off debt",
  "Avoid expensive debt",
  "Build an emergency fund",
  "Proper savings goals",
  "Accumulate wealth",
  "Prepare for retirement",
  "Secure multiple income streams",
  "Determine appropriate Social Security",
  "Pension maximization strategies",
];

export default function FinancialPlanningPage() {
  return (
    <>
      <PageHero
        eyebrow="Financial Planning"
        title="Overcome Financial Obstacles & Build a Brighter Financial Future"
        accent="Brighter Financial Future"
        breadcrumb={[{ label: "Solutions", href: "/services" }, { label: "Financial Planning" }]}
        description="At Strategic Income Group, we recognize that managing substantial wealth can be both a blessing and a challenge. As your wealth grows, so does the complexity of the decisions you need to make. Whether you’re too busy to manage the intricate details of your financial life or your wealth has expanded beyond your comfort zone, our team is here to help."
        actions={[{ label: "Schedule Consultation", href: "/get-started" }, { label: "Contact Us", href: "/contact" }]}
      />

      <Section>
        <SectionHeading
          eyebrow="The Three Phases of Wealth"
          title="A process designed to simplify your financial life"
          description="Our founder, Michael Gauthier, CFP®, has developed the Three Phases of Wealth—a comprehensive financial planning process designed to simplify your financial life and help you achieve a secure and prosperous future. We guide you through each phase, providing tailored strategies that address the unique needs of individuals and families."
        />
        <div className="mt-12">
          <PhaseCards />
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our Financial Planning Process" title="Every step, in the right order" />
            <CheckList className="mt-8" columns={2} items={PROCESS} />
            <div className="mt-8">
              <ButtonLink label="Schedule Consultation" href="/get-started" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-7">
              <h3 className="font-serif text-2xl">How We Can Help</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Our seasoned professionals use the latest financial planning technology to bring clarity and control to your complex financial life.
                By consolidating your account assets and tracking your progress against your goals, we make it easier for you to focus on what
                matters most. When you entrust us with your investments, you’ll gain access to a personalized financial planning portal, giving you a
                comprehensive view of your wealth and the confidence that comes from having a trusted team by your side.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-7">
              <ShieldCheck className="h-6 w-6 text-gold" />
              <h3 className="mt-3 font-serif text-2xl">Our Commitment to You</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                As fiduciaries, we are committed to acting in your best interests, helping you navigate the challenges and opportunities that come
                with substantial wealth. Our mission is to provide you with the expert advice and strategic insights you need to make informed
                decisions and optimize your financial future.
              </p>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                We utilize the most comprehensive financial planning software available in the industry, bringing together account assets and
                information so that we can track financial progress against goals—and work together as a team.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <PlannerGrid tone="default" eyebrow="Meet With Our Investment Professionals" title="Sit down with a planner" description="Sit down with one of our investment professionals at least once a year (preferably 2-4 times) to review your investment performance. They can help you build a customized portfolio of investments that are right for you." />

      <CtaBand title="Send Us a Message" description="If managing your wealth has become overwhelming, or if you simply want to ensure your financial plan is as effective as possible, contact us today." />
    </>
  );
}
