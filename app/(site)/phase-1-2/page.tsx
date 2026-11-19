import Link from "next/link";
import { PhasePage } from "@/components/public-site/phase-page";

export const metadata = {
  title: "Phase I — The Foundation Phase",
  description: "Five steps to build a solid financial foundation: budget, insurance, estate plan, consumer debt and an emergency fund.",
};

export default function PhaseOnePage() {
  return (
    <PhasePage
      numeral="I"
      name="The Foundation Phase"
      href="/phase-1-2"
      intro="Many individuals often feel like crucial aspects of their financial lives are slipping through the cracks. Fortunately, there’s a systematic approach to building and enhancing your financial health—one that ensures no detail is overlooked. By following our step-by-step process, you can take control of your financial future with confidence."
      stepsTitle="5 Steps"
      stepsIntro="Here is an overview of the five steps in building a solid foundation. You know that planning your financial future, saving for retirement, customizing an estate plan, and securing adequate insurance coverage are essential steps — this is where to begin."
      next={{ href: "/phase-2-2", label: "Next Phase II" }}
      aside={
        <div className="mt-8 rounded-xl border bg-card p-6">
          <p className="font-serif text-xl">Get Resources</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up and receive our Three Phases of Wealth Checklist and our exclusive Strategic Financial Organizer Forms as a free gift!
          </p>
          <Link href="/resources" className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline">
            Get Resources →
          </Link>
        </div>
      }
      steps={[
        {
          label: "Step 1",
          title: "Create a Budget & Save $1,000",
          body: (
            <>
              <p>
                Create a realistic budget that you will actually implement. Understand that it will take time to make a budget that works month to
                month, and don’t become discouraged when you can’t get it right the first time around. Just make a budget!
              </p>
              <p>
                In addition, be sure to save up $1,000 in cash. Should you have a small emergency, $1,000 is typically enough to cover the expense.
                Later, you’ll grow your emergency fund to three to six months of living expenses.
              </p>
            </>
          ),
        },
        {
          label: "Step 2",
          title: "Appropriate Insurance Policies",
          body: (
            <>
              <p>
                Insurance is designed to help you pay for expenses that you can’t afford. It protects you and your family from emergencies larger
                than your emergency fund. In addition, it can protect your future income.
              </p>
              <p>Some types of insurance policies you may need include: Homeowners/Renters, Auto, Life, Health, Disability and Umbrella.</p>
              <p>
                Need insurance? <Link href="/insurance-planning" className="font-medium text-primary underline-offset-2 hover:underline">Let us help you get the insurance appropriate for you and your family.</Link>
              </p>
            </>
          ),
        },
        {
          label: "Step 3",
          title: "Personalize Your Estate Plan",
          body: (
            <>
              <p>
                Don’t die without a living trust. The last thing you want is for the state to decide where your assets go and when, who will have
                custody over your minor children, and whether your estate will be made public.
              </p>
              <p>
                Also, get a living will. A living will can make your desires known regarding difficult medical situations in which you may not be
                able to express your wishes. These documents are not just for the wealthy. They’re for everyone!
              </p>
              <p>
                Don’t have a living trust or living will yet? <Link href="/estate-planning" className="font-medium text-primary underline-offset-2 hover:underline">Let us help you get an estate plan in place.</Link>
              </p>
            </>
          ),
        },
        {
          label: "Step 4",
          title: "Pay off All Consumer Debt",
          body: (
            <>
              <p>
                Now is the time to tackle all your personal debt—excluding any mortgages. This includes credit card debt, auto loans, school loans,
                personal and family loans, and any other non-mortgage obligations.
              </p>
              <p>
                Why not the mortgage? First, the next step in the Foundation Phase involves building your full emergency fund—a critical safety net
                for long-term financial stability. Second, contrary to popular belief, paying off your mortgage early might not always be the best
                strategy.
              </p>
              <p>
                To pay down your debt effectively, consider using the debt snowball method, which allows you to achieve quick wins by focusing on
                smaller debts first. If you’re feeling stuck, don’t hesitate to seek help from one of our excellent financial planners.
              </p>
            </>
          ),
        },
        {
          label: "Step 5",
          title: "Save 6 Months Emergency Fund",
          body: (
            <>
              <p>No job is completely safe. Good health is temporary. Emergencies happen!</p>
              <p>
                Having three to six months of living expenses in an emergency fund will come in handy when the inevitable hits. If you live in a
                two-income household where each spouse works for a different employer and both incomes are similar, save three months of living
                expenses. Otherwise, save six months.
              </p>
              <p>
                Make sure you save your money in a liquid savings account. Don’t get fancy with the money you have here—if you don’t have easy
                access to your emergency fund, it might not be able to serve its purpose during an emergency.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
