import { OPEN_POSITIONS } from "./careers";

// Code-owned content for the public site, mirrored from strategicincomegroup.com.
// Page names, URLs and copy match the live WordPress site so links and SEO carry
// over; only the presentation changes (shadcn styling, light/dark modes).

export const CONTACT = {
  phone: "(480) 466-7070",
  phoneHref: "tel:+14804667070",
  email: "planning@strategicincomegroup.com",
  generalEmail: "info@strategicincomegroup.com",
  hours: "Mon. – Fri. 9:00 am to 5:00 pm",
  facebook: "https://www.facebook.com/StrategicIncomeGroup/",
  linkedin: "https://www.linkedin.com/company/strategic-income-group/",
  crsPdf: "https://strategicincomegroup.com/wp-content/uploads/crs_165839.pdf",
  adv: "https://strategicincomegroup.com/wp-content/uploads/SIG-Form-ADV-Part-2A-3.4.26.pdf",
  privacyPdf: "https://strategicincomegroup.com/wp-content/uploads/SIG-Privacy-Policy-2026.pdf",
} as const;

export const OFFICES = [
  {
    name: "East Valley Office",
    city: "Chandler",
    street: "2330 W Ray Rd. #3",
    locality: "Chandler, AZ 85224",
    map: "/team/east-valley-map.webp",
    directions: "https://www.google.com/maps/search/?api=1&query=2330+W+Ray+Rd+%233+Chandler+AZ+85224",
  },
  {
    name: "West Valley Office",
    city: "Peoria",
    street: "20542 N. Lake Pleasant Rd. #119",
    locality: "Peoria, AZ 85382",
    map: "/team/west-valley-map.webp",
    directions: "https://www.google.com/maps/search/?api=1&query=20542+N+Lake+Pleasant+Rd+%23119+Peoria+AZ+85382",
  },
] as const;

// ── Navigation ──────────────────────────────────────────────────────────────

export type MegaLink = { label: string; href: string; description: string; icon: string };
export type MegaGroup = { heading: string; links: MegaLink[] };
export type MegaMenu = {
  label: string;
  href: string;
  groups: MegaGroup[];
  /**
   * "strip" renders a slim row under the link columns; "card" renders a third
   * column call-to-action beside them (About Us → Careers).
   */
  feature?: {
    layout?: "strip" | "card";
    eyebrow: string;
    title: string;
    copy: string;
    href: string;
    cta: string;
    stat?: string;
    statLabel?: string;
  };
};

// Both About Us link columns hold exactly three links with similar-length
// descriptions so the two columns match in height; Careers is the third-column CTA.
export const ABOUT_MENU: MegaMenu = {
  label: "About Us",
  href: "/our-approach",
  groups: [
    {
      heading: "About Strategic Income Group",
      links: [
        { label: "Our Team", href: "/team", description: "Financial planners ready to listen and provide superior solutions.", icon: "users" },
        { label: "Mission & Values", href: "/mission", description: "Empowering individuals to live their best lives and leave a legacy.", icon: "award" },
        { label: "Meet our CEO", href: "/team/michael-gauthier", description: "Michael Gauthier, CFP®, with over two decades of experience.", icon: "user" },
      ],
    },
    {
      heading: "Discover and connect with SIG",
      links: [
        { label: "Our Approach", href: "/our-approach", description: "The Three Phases of Wealth process that gives order to your goals.", icon: "compass" },
        { label: "Contact Us", href: "/contact", description: "Call (480) 466-7070 to schedule a consultation or learn more.", icon: "phone" },
        { label: "Employee Login", href: "/login", description: "Access your dashboard, login and booking tools in one place.", icon: "lock" },
      ],
    },
  ],
  feature: {
    layout: "card",
    eyebrow: "Now Hiring",
    title: "Careers",
    copy: "At Strategic Income Group (SIG), we believe that work is more than just a job—it’s a calling.",
    href: "/join-our-team",
    cta: "Career Information",
    stat: String(OPEN_POSITIONS),
    statLabel: "Positions Available",
  },
};

export const SOLUTIONS_MENU: MegaMenu = {
  label: "Solutions",
  href: "/services",
  groups: [
    {
      heading: "Strategic Income Group Solutions",
      links: [
        { label: "Financial Planning", href: "/financial-planning", description: "Managing substantial wealth can be a blessing and a challenge.", icon: "dollar" },
        { label: "Investment Management", href: "/investment-management", description: "Diversified, values-aligned portfolios managed for you.", icon: "chart" },
        { label: "Estate Planning", href: "/estate-planning", description: "The crucial third step in the Foundation Phase.", icon: "map" },
      ],
    },
    {
      heading: "Protect and plan",
      links: [
        { label: "Insurance Planning", href: "/insurance-planning", description: "A solid insurance plan protects your wealth and legacy.", icon: "heart" },
        { label: "403(b)", href: "/403b-plan", description: "Faith-based retirement plans for church leaders and staff.", icon: "trending" },
        { label: "All Solutions", href: "/services", description: "Every service designed for greater financial security.", icon: "grid" },
      ],
    },
  ],
  feature: {
    eyebrow: "Three Phases of Wealth",
    title: "Strategize. Invest. Give.",
    copy: "Our planning process gives order to financial goals and encourages proper money management.",
    href: "/our-approach",
    cta: "See the process",
  },
};

export const PRIMARY_NAV = [
  ABOUT_MENU,
  SOLUTIONS_MENU,
  { label: "Resources", href: "/resources" },
  { label: "Events", href: "/events" },
  { label: "Contact", href: "/contact" },
] as const;

export const FOOTER_COLUMNS = [
  {
    heading: "Company",
    links: [
      { label: "Our Team", href: "/team" },
      { label: "Mission & Values", href: "/mission" },
      { label: "Careers", href: "/join-our-team" },
      { label: "Resources", href: "/resources" },
      { label: "Events", href: "/events" },
      { label: "SIGCares", href: "/sigcares" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { label: "Financial Planning", href: "/financial-planning" },
      { label: "Investment Management", href: "/investment-management" },
      { label: "Estate Planning", href: "/estate-planning" },
      { label: "Insurance Planning", href: "/insurance-planning" },
      { label: "403(b) Plans", href: "/403b-plan" },
    ],
  },
  {
    heading: "Approach",
    links: [
      { label: "Phase I", href: "/phase-1-2" },
      { label: "Phase II", href: "/phase-2-2" },
      { label: "Phase III", href: "/phase-3-2" },
      { label: "Our Approach", href: "/our-approach" },
      { label: "Get Started", href: "/get-started" },
    ],
  },
];

export const LEGAL_LINKS = [
  { label: "Login", href: "/login" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "ADV", href: CONTACT.adv, external: true },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "CRS", href: CONTACT.crsPdf, external: true },
  { label: "Communication", href: "/communication-policy" },
];

// ── Solutions ───────────────────────────────────────────────────────────────

export const SOLUTIONS = [
  {
    title: "Financial Planning",
    href: "/financial-planning",
    icon: "dollar",
    summary:
      "Financial Planning begins with us listening to your financial concerns, needs, and questions. Our goal is to find the best possible solutions that will take you from where you are to where you want to be.",
  },
  {
    title: "Investment Management",
    href: "/investment-management",
    icon: "chart",
    summary:
      "Investment Management ensures your retirement and other investment assets are properly handled. Whether you are just starting to invest, are a long-time investor, or are seeking to start taking retirement distributions, allow our Financial Planners to help.",
  },
  {
    title: "Estate Planning",
    href: "/estate-planning",
    icon: "map",
    summary:
      "Estate Planning ensures that your assets are properly transferred at your passing to your named beneficiaries and your will is carried out should you not be able to make critical decisions.",
  },
  {
    title: "Insurance Planning",
    href: "/insurance-planning",
    icon: "heart",
    summary:
      "Insurance Planning is designed to put in place appropriate insurance policies to transfer risk away from your financial assets. Secure your wealth by allowing us to complete detailed analysis of your insurance needs.",
  },
  {
    title: "Tax Planning",
    href: "/contact",
    icon: "receipt",
    summary:
      "Strategic Income Group's Tax Planning service is designed to minimize tax liabilities while maximizing financial efficiency. This includes utilizing tax-efficient strategies across your accounts.",
  },
  {
    title: "403(b) Plans",
    href: "/403b-plan",
    icon: "trending",
    summary:
      "Tax-advantaged retirement savings plans designed specifically for church and nonprofit employees, aligned with your ministry’s benefits structure and biblical values.",
  },
] as const;

// ── Three Phases of Wealth ──────────────────────────────────────────────────

export const PHASES = [
  {
    n: "I",
    href: "/phase-1-2",
    name: "The Foundation Phase",
    short: "Foundation",
    tagline: "Designed to Protect Your Today",
    teaser: "Many people feel like certain details of their financial lives are falling through the cracks.",
  },
  {
    n: "II",
    href: "/phase-2-2",
    name: "The Accumulating Wealth Phase",
    short: "Accumulating Wealth",
    tagline: "Helping You Build and Plan for Tomorrow",
    teaser: "After you’ve built a solid foundation by following the five prioritized steps, it’s time to grow.",
  },
  {
    n: "III",
    href: "/phase-3-2",
    name: "The Strategic Income Phase",
    short: "Strategic Income",
    tagline: "Managing Income and Leaving a Lasting Legacy",
    teaser: "Congrats! Not only have you completed the Foundation Phase, but you’ve been accumulating wealth.",
  },
] as const;

export const PILLARS = [
  {
    n: "01",
    key: "strategize",
    title: "Strategize",
    short: "Build a plan with purpose.",
    eyebrow: "Strategic Income Group",
    heading: ["Financial Solutions", "For", "Every Phase", "of Life"],
    body: [
      "Our comprehensive, proactive approach ensures we address your financial goals and objectives using the most efficient methods available. Strategic Income Group not only has the expertise to offer financial advice, but also the services to help facilitate the appropriate actions we recommend to our clients.",
      "We’ll construct a plan to help you achieve your goals utilizing one or several of our core services to keep you on track toward a meaningful and purpose-driven financial future.",
    ],
    callout: "Build a plan with purpose around your goals, values, family, and future.",
    primary: { label: "Start Planning", href: "/contact" },
    secondary: { label: "Learn More", href: "/our-approach" },
  },
  {
    n: "02",
    key: "invest",
    title: "Invest",
    short: "Align your finances with your future.",
    eyebrow: "Investment Strategy",
    heading: ["Invest With", "", "Clarity", "and Confidence"],
    body: [
      "Your investments should work in alignment with your larger financial plan. We help you think through risk, income needs, tax considerations, and long-term goals so your investment strategy has clear direction.",
      "Whether you are preparing for retirement, managing income, or planning for future growth, we help position your portfolio around the goals that matter most.",
    ],
    callout: "Align your investments with your plan, income needs, risk tolerance, and long-term objectives.",
    primary: { label: "Review Your Strategy", href: "/contact" },
    secondary: { label: "View Services", href: "/services" },
  },
  {
    n: "03",
    key: "give",
    title: "Give",
    short: "Leave a lasting legacy.",
    eyebrow: "Legacy Planning",
    heading: ["Give With", "", "Purpose", "and Impact"],
    body: [
      "Financial planning is about more than wealth accumulation. We help you think through generosity, family impact, charitable giving, and legacy planning so your resources can support what matters most.",
      "Our goal is to help you plan beyond today by aligning your financial decisions with your values, your family, your faith, and the legacy you want to leave.",
    ],
    callout: "Create a lasting legacy through generosity, family impact, charitable strategies, and purpose-driven planning.",
    primary: { label: "Plan Your Legacy", href: "/contact" },
    secondary: { label: "Our Mission", href: "/mission" },
  },
] as const;

export const CORE_VALUES = [
  {
    title: "Servant Leadership",
    copy: "Leading by serving others, embodying humility, and prioritizing the needs and growth of clients and team members. This approach is rooted in Christian values, where leadership is seen as a call to serve, inspire, and elevate others.",
  },
  {
    title: "Regimented Discipline",
    copy: "Adopting structured and disciplined financial practices to achieve stability and growth. This involves meticulous planning, consistent monitoring, and adherence to the “Three Phases of Wealth” process, ensuring that every recommendation is aligned with sound principles and strategies.",
  },
  {
    title: "Compassion",
    copy: "Leading by example in charitable giving and encouraging clients to adopt a lifestyle of generosity. This involves establishing the Strategic Impact Foundation for charitable giving and empowering clients to experience the fulfillment that comes from using their resources to help others.",
  },
  {
    title: "Abundant Living",
    copy: "Prioritizing a holistic approach to life that encompasses faith, family, friends, freedom, fun, fulfillment, fitness, and finance. This means living intentionally and fully, integrating all aspects of life to achieve personal and spiritual goals in alignment with God’s purpose.",
  },
  {
    title: "Trusted Advocate",
    copy: "Lifetime commitment to client’s best interest, by providing honest, ethical, and reliable advice that supports clients’ long-term financial well-being, ensuring their trust is earned and maintained through consistent integrity and care.",
  },
  {
    title: "Growth",
    copy: "We believe that personal and professional development for our teammates leads to growth for our company. This involves embracing challenges as opportunities for improvement, expanding knowledge, skills, and capabilities, and driving the growth of the organization to better serve clients and make a larger IMPACT in the community.",
  },
  {
    title: "Excellence",
    copy: "Constantly improving as a team for the benefit of our clients. 100% committed to the highest standards in all internal processes, continuous innovation of products and services and seeking to excel in every aspect of financial planning, investments and client service.",
  },
  {
    title: "Togetherness",
    copy: "Building and maintaining strong, reliable relationships based on honesty and integrity. This involves fostering a supportive community where collaboration and mutual respect are paramount, ensuring that everyone works together towards common goals.",
  },
  {
    title: "Impact",
    copy: "Utilizing the investment of over $1 billion by strategically investing in projects and companies that generate social and environmental benefits alongside financial returns, aligning our financial goals with our commitment to serve and uplift others in accordance with Christian values.",
  },
] as const;

export const IMPACT_GOAL =
  "To educate and inspire 25,000 people to positively transform communities through charitable contributions and making impact investments of $1 billion+.";

export const CEO_BIO =
  "Mike Gauthier, CFP®, founded Strategic Income Group with a mission to elevate financial stewardship based on Christian principles. After a decade of experience at a national Wall Street firm, Mike took a leap of faith in 2013 to start his own company, focusing on empowering individuals from all financial backgrounds to be wise stewards of their money. Strategic Income Group’s mission is to empower individuals to live their best lives and leave a lasting legacy of financial security and positive impact. Mike is passionate about teaching sound financial principles, advocating for strategic planning, and promoting a heart of generosity in every financial decision.";
