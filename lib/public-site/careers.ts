// Careers content mirrored from strategicincomegroup.com/join-our-team.

export type Role = { title: string; summary: string; slug?: string; status?: "Open" | "Available" | "Part-Time" };

export const ROLE_GROUPS: { heading: string; roles: Role[] }[] = [
  {
    heading: "Financial & Investment Professionals",
    roles: [
      { title: "Associate Financial Planner", slug: "associate-financial-planner", status: "Open", summary: "Support financial planning, client relationships, and investment strategies while developing into a trusted financial advisor." },
      { title: "Trading Associate", summary: "Execute trades, firm wide rebalances, and ensure compliance with investment strategies." },
      { title: "Private Fund Associate", summary: "Support the management of private investment funds and alternative assets." },
      { title: "Investment Officer", summary: "Oversee and manage investment strategies, portfolio construction, and market research and communicate firm views with staff and clients." },
      { title: "CPA Tax Advisor", slug: "cpa-tax-advisor", status: "Open", summary: "We are seeking a high-character, highly skilled CPA or tax advisor to join our growing team." },
      { title: "Wealth Manager (CFP®)", summary: "Provide comprehensive financial planning and investment advice with wisdom and integrity." },
    ],
  },
  {
    heading: "Client Services & Operations",
    roles: [
      { title: "New Client Onboarding", slug: "onboarding-specialist", status: "Available", summary: "Serve as the primary point of contact for new clients during onboarding." },
      { title: "Client Service Associate", slug: "client-service-associate", summary: "Deliver outstanding service and support to ensure a seamless client experience." },
      { title: "Compliance Officer", summary: "Maintain regulatory compliance and ethical business practices." },
      { title: "Operations Officer", summary: "Oversee and optimize the day-to-day functions of our growing firm." },
      { title: "SIG Internship", slug: "internship-program", status: "Open", summary: "Explore a Career in Financial Planning, Investment Research, and Client Impact." },
      { title: "Compliance Associate", summary: "Assist in implementing and monitoring compliance programs and industry regulations." },
      { title: "Billing Associate", summary: "Manage invoicing, billing reconciliation, and client account transactions." },
    ],
  },
  {
    heading: "Administrative & Technology",
    roles: [
      { title: "Part-Time Marketing & Communications Coordinator", slug: "marketing-communicaitons-coordinator", status: "Part-Time", summary: "Location: Chandler or Peoria Office | Hours: 20–30 hours/week | Compensation: $22 - $28/hour" },
      { title: "Executive Assistant", summary: "Provide high-level administrative support to CEO." },
      { title: "Administrative Associate", summary: "Assist with office management, scheduling, and operational support." },
      { title: "IT Specialist", summary: "Manage technology systems, cybersecurity, and IT support for the firm." },
    ],
  },
];

export const WHY_SIG = [
  { title: "A Mission That Matters", copy: "We believe in helping clients honor God with their finances, ensuring they make wise decisions for their families and future generations." },
  { title: "A Values-Driven Culture", copy: "We don’t just talk about integrity, stewardship, and excellence—we live it every day." },
  { title: "Opportunities for Growth", copy: "Whether you’re an experienced professional or just starting your career, we provide mentorship, training, and a clear path for advancement." },
  { title: "A Team That Feels Like Family", copy: "We believe in working hard, supporting each other, and celebrating wins together." },
  { title: "A Legacy of Excellence", copy: "We set the bar high and work with driven, talented, and ethical individuals who want to make an impact." },
];

export type JobPosting = {
  slug: string;
  title: string;
  type: string;
  intro: string[];
  sections: { heading: string; items?: string[]; paragraphs?: string[] }[];
  closing?: string;
};

export const JOBS: JobPosting[] = [
  {
    slug: "associate-financial-planner",
    title: "Associate Financial Planner",
    type: "Full-Time Position",
    intro: [
      "Strategic Income Group is an independent Registered Investment Adviser serving individuals and families through comprehensive financial planning, disciplined investment management, and exceptional client service.",
      "We help clients optimize their wealth, align their lives, and live with purpose. Our planning process considers investments, retirement, taxes, insurance, estate planning, generosity, family priorities, and legacy.",
      "SIG’s Christian faith shapes our understanding of stewardship and our commitment to integrity, compassion, generosity, service, and respect. We serve clients from many different backgrounds and welcome qualified candidates who can work respectfully and professionally within this culture.",
    ],
    sections: [
      {
        heading: "Position Overview",
        paragraphs: [
          "SIG is seeking a motivated, service-minded Associate Financial Planner to join our team.",
          "This is a developmental, client-facing role that combines financial planning, client service, Senior Wealth Planner support, and reasonable shared office responsibilities. The Associate Financial Planner will help prepare financial plans, participate in client meetings, complete follow-up work, and support ongoing client relationships.",
          "As the Associate demonstrates technical competency, sound judgment, strong communication, appropriate licensing, and reliable follow-through, the role will expand to include permanent responsibility for selected client households.",
          "This is not a pure sales position, a purely administrative position, or an immediate independent Lead Planner role. It is an opportunity to develop into a trusted financial planner within an established, collaborative advisory firm.",
        ],
      },
      {
        heading: "Financial Planning and Client Relationships",
        items: [
          "Gather and organize client financial information, goals, planning assumptions, and relevant documents.",
          "Prepare financial plans, retirement analyses, planning updates, and alternative scenarios.",
          "Assist with investment, tax, insurance, estate-planning, charitable, and legacy-planning analysis.",
          "Help guide clients through SIG’s 3 Phases of Wealth and Stewardship Blueprint processes.",
          "Prepare for and participate in client meetings.",
          "Document client decisions, recommendations, and next steps.",
          "Lead portions of meetings as experience, competency, and licensing permit.",
          "Gradually assume permanent responsibility for selected client relationships.",
          "Monitor financial plans and help update recommendations as client circumstances and goals evolve.",
          "Explain financial concepts clearly and help clients feel informed, confident, and cared for.",
        ],
      },
      {
        heading: "Senior Planner and Team Support",
        items: [
          "Support Senior Wealth Planners with financial-plan preparation, research, meeting preparation, and implementation.",
          "Participate in joint client meetings and thoughtful transitions of appropriate client relationships.",
          "Help create capacity for Senior Wealth Planners to focus on complex planning and larger client relationships.",
          "Complete assigned meeting follow-up and help ensure that recommendations move from discussion to implementation.",
          "Support Wealth.com estate-planning workflows and professional coordination.",
          "Assist with client events, educational programs, roundtables, and other firm initiatives.",
          "Collaborate with planners, CSAs, operations teammates, and leadership across SIG locations.",
        ],
      },
      {
        heading: "Shared Office and Client-Experience Responsibilities",
        items: [
          "Greeting clients and guests.",
          "Preparing conference rooms and meeting materials.",
          "Helping answer incoming office phone calls.",
          "Scanning, organizing, and securely saving client documents.",
          "Helping schedule and confirm appointments.",
          "Supporting client events and team meetings.",
        ],
      },
    ],
  },
  {
    slug: "client-service-associate",
    title: "Client Service Associate",
    type: "Full-Time Position",
    intro: [
      "At Strategic Income Group, we believe great financial planning is only as effective as the client experience behind it. Our Client Service Associates (CSAs) play a critical role in delivering the proactive, high-touch service that helps clients live their best lives with confidence and peace of mind.",
      "We are seeking a high-character, detail-oriented professional who thrives on supporting others, building strong relationships, and being part of a mission-driven team. This is more than just an administrative role—it’s a frontline opportunity to serve clients, work closely with Financial Planners, and contribute to a lasting legacy of impact.",
    ],
    sections: [
      {
        heading: "Who We’re Looking For",
        items: [
          "You believe every detail matters—because clients deserve peace of mind",
          "You enjoy building relationships and supporting long-term financial success",
          "You work well alongside Financial Planners and contribute to a collaborative, high-performing team",
          "You bring excellence, organization, and clear communication to everything you do",
          "You thrive in a firm where spiritual values and professional standards go hand-in-hand",
        ],
      },
      {
        heading: "Key Responsibilities",
        items: [
          "Serve as a trusted point of contact for client service needs",
          "Collaborate closely with Financial Planners to deliver a seamless and thoughtful client experience",
          "Support the onboarding of new clients by coordinating with the New Client Onboarding Specialist; assist with account openings when needed",
          "Process account service requests, including ACH transfers, wires, and money movement",
          "Manage and monitor Required Minimum Distributions (RMDs), beneficiary updates, and other critical client milestones",
          "Prepare for and follow up on client meetings with the planning team",
          "Maintain accurate data across CRM, custodial platforms, and internal workflows",
          "Ensure compliance standards are met while providing timely, proactive service",
        ],
      },
      {
        heading: "Qualifications",
        items: [
          "1–3 years of experience in client service, operations, or administrative support (financial services a plus)",
          "Excellent communication skills and a strong client-first mindset",
          "High attention to detail, strong task management, and follow-through",
          "Proficient with Microsoft Office; experience with CRM tools (Redtail), Orion, and custodial platforms like Schwab preferred",
          "Able to handle confidential information with integrity and professionalism",
        ],
      },
      {
        heading: "Location & Work Structure",
        items: [
          "Position available in either Chandler or Peoria office",
          "Full-time, salaried position with opportunity for performance-based bonus",
          "Some flexibility for remote tasks following training and onboarding",
        ],
      },
      {
        heading: "What We Offer",
        items: [
          "A values-driven culture rooted in biblical stewardship and client-centered service",
          "Ongoing training and growth opportunities",
          "Flexible work arrangements",
          "Health insurance, 401(k) with match, and life insurance",
          "A chance to be part of something bigger—helping people live wisely, give generously, and leave a lasting legacy",
        ],
      },
    ],
    closing:
      "If you’re passionate about service, love working in a team environment, and want to make a real difference in the lives of clients—we’d love to meet you.",
  },
  {
    slug: "cpa-tax-advisor",
    title: "CPA Tax Advisor",
    type: "Full-Time Position",
    intro: [
      "At Strategic Income Group, we believe that true financial planning doesn’t stop with investments—it includes stewarding every part of a client’s financial picture, including tax strategy and preparation. We are seeking a high-character, highly skilled CPA or tax advisor to join our growing team.",
      "This person will help ensure our clients are not only compliant but empowered through proactive tax planning, strategic preparation, and ongoing values-aligned financial counsel.",
    ],
    sections: [
      {
        heading: "Who We’re Looking For",
        items: [
          "You want to use your tax and accounting knowledge to help others live wisely and give generously",
          "You value excellence, integrity, and clear communication",
          "You enjoy working on a team where spiritual values and professional standards work hand-in-hand",
          "You thrive in a collaborative environment that encourages growth and innovation",
        ],
      },
      {
        heading: "Key Responsibilities",
        items: [
          "Tax Preparation for individuals, families, and small businesses",
          "Tax Planning to align with client goals, charitable giving, and impact strategies",
          "Coordination with planners and clients on integrated financial plans",
          "Reviewing entity structures and optimizing for tax efficiency",
          "Assist clients with estimated taxes, projections, and IRS correspondence as needed",
          "Document processes and help improve internal systems for long-term scalability",
        ],
      },
      {
        heading: "Qualifications",
        items: [
          "CPA/EA license required",
          "Minimum 3–5 years of experience in tax preparation and/or tax advisory services",
          "Strong understanding of charitable giving strategies, small business tax law, and individual tax planning",
          "Experience with UltraTax, QuickBooks, and other tax/accounting software preferred",
        ],
      },
      {
        heading: "What We Offer",
        items: [
          "A values-driven culture rooted in biblical stewardship",
          "Opportunities for personal and professional growth",
          "Flexible work arrangements",
          "Health insurance, 401(k) with match, and life insurance",
          "A chance to impact lives through your work, not just file returns",
        ],
      },
    ],
    closing:
      "If you're ready to be part of something more—and you’re passionate about helping people steward their resources with wisdom and impact—we’d love to meet you.",
  },
  {
    slug: "onboarding-specialist",
    title: "New Client Onboarding Specialist",
    type: "Full-Time Position",
    intro: [
      "At Strategic Income Group (SIG), we guide clients toward living their best lives and leaving a lasting legacy of financial security and positive impact. We operate from a biblical worldview, and our work is rooted in principles of stewardship, generosity, excellence, and integrity.",
      "As part of our commitment to delivering an extraordinary client experience, we’re hiring for a newly created position designed to ensure a seamless and high-touch onboarding experience for each new relationship.",
    ],
    sections: [
      {
        heading: "What You’ll Do",
        items: [
          "Serve as the primary point of contact for new clients during onboarding, partnering with financial planners to determine which accounts need to be opened",
          "Coordinate all paperwork through Schwab Advisor Center, including ACATs, ACHs, and QCDs",
          "Set up new clients in Redtail CRM, Orion, and Dropbox, ensuring internal systems are prepared and synchronized",
          "Personally walk clients through Schwab login, paperless preferences, and online access",
          "Collaborate with the CSA and planner to ensure a smooth handoff after the first 60–90 days",
          "Introduce clients to the SIG team and help them understand our process, culture, and commitment to service",
        ],
      },
      {
        heading: "Location & Schedule",
        items: [
          "Primary work location: West Valley (Glendale/Peoria area)",
          "Will work from East Valley (Chandler office) when onboarding East Valley clients to meet them in person",
          "Full-time position, Monday–Friday with advance scheduling for travel days",
        ],
      },
      {
        heading: "Compensation & Benefits",
        items: [
          "Full-time, salaried position with potential performance-based bonus",
          "Monday work-from-home flexibility",
          "401(k) with company match",
          "Health insurance and life insurance benefits",
          "Opportunities for professional development, mentoring, and long-term growth",
        ],
      },
    ],
    closing: "Submit your application now and become part of a company where relationships come first.",
  },
  {
    slug: "internship-program",
    title: "Internship Program",
    type: "Intern Today. Lead Tomorrow.",
    intro: [
      "At Strategic Income Group (SIG), we are passionate about helping people live their best lives and leave a lasting legacy. Our internship program offers high school seniors and college students the opportunity to gain meaningful experience in the financial planning and investment industry.",
      "This is a semester-based, unpaid internship available at both our East Valley (Chandler) and West Valley (Peoria) office locations. Interns will have the chance to work alongside our experienced team, contribute to real projects, and gain mentorship that extends beyond the classroom.",
    ],
    sections: [
      {
        heading: "Support Day-to-Day Operations",
        items: [
          "Assist with scanning, filing, phones, and basic office support",
          "Prepare materials for client meetings and follow-up tasks",
          "Learn internal tools and workflow systems used in professional planning firms",
        ],
      },
      {
        heading: "Engage in Investment Research & Strategy",
        items: [
          "Help compile research on funds, managers, and market trends",
          "Support preparations for our Investment Committee’s quarterly manager reviews",
          "Observe how data and research inform investment decisions",
        ],
      },
      {
        heading: "Who Should Apply?",
        items: [
          "High school seniors or enrolled in college",
          "Professional, curious, and eager to grow",
          "Strong communicators with attention to detail",
          "Able to work on-site at either our East Valley or West Valley office",
          "Able to commit to a consistent schedule (we are flexible with school/life demands)",
        ],
      },
    ],
    closing: "Interested students complete the same online application used for employment candidates at SIG. Select “Internship” under the position type.",
  },
  {
    slug: "marketing-communicaitons-coordinator",
    title: "Marketing & Communications Coordinator",
    type: "Part-Time · 20–30 hours/week · $22 – $28/hour",
    intro: [
      "Strategic Income Group exists to empower individuals to live their best lives and leave a lasting legacy of financial security and positive impact. Rooted in biblical stewardship, we serve our clients with excellence, integrity, and compassion.",
      "We are seeking a Marketing & Communications Coordinator to support the strategic execution of client communications, email campaigns, social media publishing, and event planning. This role is part-time and in-office, with occasional front desk and administrative responsibilities.",
    ],
    sections: [
      {
        heading: "Key Responsibilities",
        items: [
          "Coordinate internal review and publication of blog articles and updates on SIG’s website",
          "Manage scheduling of email campaigns, autoresponder sequences, and client surveys",
          "Draft, schedule, and publish social media posts aligned with SIG’s mission and brand",
          "Support the planning and communication around client events (in-person and virtual)",
          "Greet clients and visitors in office, answer phones, and help maintain a welcoming office environment",
        ],
      },
      {
        heading: "Desired Qualifications",
        items: [
          "1–3 years of experience in marketing communications, content creation, or administrative support",
          "Excellent written and verbal communication skills",
          "Strong organizational and multitasking abilities",
          "A heart for service and alignment with SIG’s mission and values",
        ],
      },
    ],
    closing:
      "If you're passionate about clear communication, teamwork, and building meaningful relationships through marketing and service—this may be the perfect opportunity to grow with us.",
  },
];

export function getJob(slug: string) {
  return JOBS.find((j) => j.slug === slug) ?? null;
}

/** Roles with a live posting — shown as "Positions Available" in the menu and on the careers page. */
export const OPEN_POSITIONS = ROLE_GROUPS.flatMap((g) => g.roles).filter((r) => r.slug && r.status).length;
