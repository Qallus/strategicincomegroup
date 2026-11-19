// Team roster mirrored from strategicincomegroup.com/team and each /team/<slug> page.

export type TeamMember = {
  slug: string;
  name: string;
  credentials?: string;
  title: string;
  group: "planner" | "admin" | "leadership";
  office?: "East Valley Office" | "West Valley Office";
  photo: string;
  /** Native booking (SIG dashboard → Bookings & Events → Booking Pages with this planner page). */
  booking?: string;
  quote?: string;
  history: string[];
  inspires?: string;
  hobbies?: string;
  destination?: string;
  why?: string;
};

/** Planner booking pages live at /book?planner=<team slug>, managed in the dashboard. */
export const bookingHref = (slug: string) => `/book?planner=${slug}`;

export const TEAM: TeamMember[] = [
  {
    slug: "michael-gauthier",
    name: "Michael Gauthier",
    credentials: "CFP®",
    title: "Founder & CEO",
    group: "leadership",
    photo: "/team/michael-gauthier.webp",
    booking: bookingHref("michael-gauthier"),
    quote:
      "Our family life verse is from Matthew 5:16 and says “In the same way, let your light shine before others, that they may see your good deeds and glorify your father in heaven”.",
    history: [
      "Michael is a CERTIFIED FINANCIAL PLANNER™ professional with over two decades worth of experience helping families and individuals meet their wealth-building goals. In March of 2013, he left a large Wall Street firm to start Strategic Income Group, where he provides one-on-one financial consulting and management services.",
      "Michael enjoys sitting down with clients and showing them new capabilities and offerings. His mission is to change your relationship with money. In his downtime, he loves spending time with his wife and three children.",
    ],
    inspires:
      "My wife Kristi! She is selflessly dedicated to our family and others and at the same time has more personal discipline than anyone I know. She is gentle yet strong; humble and beautiful. She amazes me every day.",
    hobbies:
      "I love the outdoors. It is where I can find adventure and refill my energy tank. Mountain biking, camping, hiking, hunting, fishing especially with friends and family.",
    destination:
      "Any adventure with Team G (my family)! We have so much fun together exploring new places and sharing new experiences. I’ll never forget the summer of 2022 where we did a 2500-mile road trip from Arizona, through Utah, Idaho, Wyoming and Montana. Amazing adventures and lifetime of memories.",
    why: "I love to teach and equip others to not only fulfill their dreams but even encourage them to dream bigger. Obviously being a good steward with your finances is a big part of achieving this. Our clients’ dreams continue to expand and grow which is why one of SIG’s core values is to Pursue Excellence and constantly improve as an organization. It is at that point, where SIG’s strive for excellence and our clients dreams meet that I find the most satisfaction in.",
  },
  {
    slug: "laurie-simons",
    name: "Laurie Simons",
    credentials: "CFP®, CTFA®",
    title: "Certified Financial Planner",
    group: "planner",
    office: "East Valley Office",
    photo: "/team/laurie-simons.webp",
    booking: bookingHref("laurie-simons"),
    history: [
      "Laurie joined Strategic Income Group in October 2019 but she began her career with a large well known Financial Services firm in 1993 and instantly fell in love with this industry. Over the years she has worked in many facets of this amazing industry including trust services, investment management, retirement income planning, insurance planning and estate planning.",
      "In addition to the normal industry licenses and training she received specialized training and became accredited as a Certified Trust Financial Advisor in 2002 and a CERTIFIED FINANCIAL PLANNER™ in 2012.",
      "In her role as a fiduciary she brings her past experiences and education and leverages it with the Strategic Income Group Planning process. Her real strength is the patient way she can take a complex concept and explain it in a way that clients can understand.",
      "Laurie grew up in eastern Oregon and has been a resident of Arizona for over 19 years. She graduated from Eastern Washington University in 1992 and then relocated to Texas to start her career in this business.",
    ],
    hobbies:
      "Laurie has one son that keeps her busy with high school and club baseball as he chases his dream to play college baseball. When Laurie is not at a baseball game she may be hiking, mountain biking, watching sports or walking Bubba – their 100 pound black lab.",
  },
  {
    slug: "chad-manberg",
    name: "Chad Manberg",
    credentials: "CFP®",
    title: "Certified Financial Planner",
    group: "planner",
    office: "West Valley Office",
    photo: "/team/chad-manberg.webp",
    booking: bookingHref("chad-manberg"),
    history: [
      "Chad has been with Strategic Income Group since 2013 and has more than a decade of experience as a financial planner. As a CERTIFIED FINANCIAL PLANNER™ professional, he has developed a passion for helping people reach their financial potential and serves as a trusted advocate for his clients.",
      "In believing that everyone should have a basic understanding of financial planning and investment management, Chad teaches adult learning classes in multiple subject areas of finance around the valley. Chad is a proud graduate of Arizona State University and has been invited back to be a guest speaker on multiple occasions.",
    ],
    inspires: "Chad is happily married to his lovely wife Lesly and has two daughters and a son.",
    hobbies: "Away from the business he enjoys playing soccer and tennis, traveling and spending time with his family and friends.",
    why: "He also holds his Accredited Asset Management Specialist (SM) (AAMS®) and is one of the rare people that enjoys investment analysis.",
  },
  {
    slug: "keri-alcos",
    name: "Keri Alcos",
    credentials: "CWS®",
    title: "Wealth Planner",
    group: "planner",
    office: "West Valley Office",
    photo: "/team/keri-alcos.webp",
    booking: bookingHref("keri-alcos"),
    quote:
      "“I’ve learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.” ― Maya Angelou",
    history: [
      "Keri Alcos joined Strategic Income Group in 2023 as a seasoned financial planner and licensed Medicare specialist with 20+ years in the financial services industry. Keri brings with her the Certified Wealth Strategist® designation and she is also a Licensed Medicare Agent.",
      "Keri has significant expertise in managing investment portfolios and creating comprehensive financial plans for clients at large brokerage firms including Charles Schwab & Company, Morgan Stanley, and USAA. She has a highly robust depth of knowledge in wealth management solutions, financial planning strategies, tax management, and Medicare health care solutions.",
      "As a former collegiate athlete, Keri has a passion for health and loves educating and helping others with Medicare solutions tailored to their unique health needs and wellness preferences. She was born in Southern California and graduated from Cal State Long Beach with a BA in Psychology.",
    ],
    inspires:
      "My father inspires me because he would give the shirt off his back or the last dollar in his wallet to help those he loves.",
    hobbies:
      "I like to invest time in relationships with family and friends and get outside for a hike, ride on the lake, or traveling to new destinations.",
    destination:
      "Nothing beats the beauty of mother nature. I love any scenic destination that provides tranquility and peace. Maui is top on this list for me.",
    why: "I love getting to collaborate with like-minded individuals that are passionate about serving each other, our clients, and the community.",
  },
  {
    slug: "martha-cortez",
    name: "Martha “MO” Cortez",
    credentials: "FPQP®",
    title: "Senior Client Service Associate",
    group: "admin",
    photo: "/team/martha-cortez.webp",
    quote: "“What doesn’t kill you makes you stronger” – Friedrich Nietzsche",
    history: [
      "As a Senior Client Service Associate, I manage client relationships with our custodians which includes account processing, transfers, trading, wires, etc. Also one of my main responsibilities is to assist in managing our two Reg D Funds – Strategic Income Fund, LP, and SIG Opportunities Fund, LP. These funds are available exclusively to our accredited investors. In order to bring the most to my many roles over the years including office manager and compliance, I studied and earned my Series 7 license, Series 66 license, and Financial Paraplanner designation.",
      "MO Cortez is a founding member of Strategic Income Group opening our doors in March 2013. MO has been in the financial services industry for 30+ years. 21 of those years have been spent working alongside CEO Mike Gauthier servicing our clients with all of their financial planning needs.",
    ],
    inspires:
      "My daughters are my number one inspiration. Becoming a Mom is the best thing that has ever happened to me. Watching them grow and become independent successful young women is the best reward I could ever earn.",
    destination: "Traveling with my husband! Wish we could go more often but we try to travel at least two to three times a year.",
    why: "100% My Clients! My favorite part of my day is talking with my clients and knowing they trust in me and can call me any time and I will always be there for them! Financial and personal. A relationship I take to heart!",
  },
  {
    slug: "julie-klodt",
    name: "Julie Klodt",
    title: "Executive Assistant to Michael Gauthier, CEO",
    group: "admin",
    photo: "/team/julie-klodt.webp",
    quote: "“We are all faced with a series of great opportunities brilliantly disguised as impossible situations.” – Chuck Swindoll",
    history: [
      "Julie joined Strategic Income Group as our Administrative Assistant in January 2021. In March 2022, she was promoted to Mike’s Executive Assistant. Julie is tasked with helping Mike bring new ideas and business strategies across the finish line. She contributes to the efficiency of the business by providing personalized and timely support to Mike so that Mike can focus on Pursuing Excellence—one of SIG’s Core Values.",
      "Julie is originally from the Midwest and moved to Arizona 8 years ago. She is a graduate of Iowa State University and has over 30 years of client support and account management experience in the pharmaceutical, retail and travel industries. Julie has always believed in the value of financial and estate planning and encourages others to be involved in this extremely important process.",
    ],
    inspires: "My father inspires me because he works tirelessly at something he loves to do.",
    hobbies: "I love to visit the Desert Botanical Garden and Boyce Thompson Arboretum. I love nature, plants, animals and the great outdoors.",
    destination: "Hawaii. I have been to Maui, Oahu, and The Big Island. Each island is unique as well as beautiful and serene.",
    why: "It is very rewarding to contribute to a positive client experience, our team’s success and to get to be involved in so many different projects that keep the firm humming.",
  },
  {
    slug: "bree-sigler",
    name: "Bree Sigler",
    title: "Client Service Associate",
    group: "admin",
    photo: "/team/bree-sigler-2026.webp",
    history: ["Full profile coming soon."],
  },
  {
    slug: "cecilia-gauthier",
    name: "Cecilia Gauthier",
    title: "Project Specialist",
    group: "admin",
    photo: "/team/cecilia-gauthier.webp",
    history: [
      "I started working at Strategic Income Group on March 7, 2013. I wanted to help my son Michael Gauthier at his new Company. I helped MO with paperwork bringing over established clients and setting up new ones. I did whatever was needed at the time.",
      "I worked full-time until December of 2017 when I retired. In early 2018 Michael asked me if I would come in when I could just to help with scanning, shredding, and whatever needed to be done. So, now I’m working one day a week.",
    ],
    inspires: "My Dad did as he was always helping people at St. Vincent De Paul. He was always available to help when someone needed him.",
    hobbies:
      "I like to spend time with my family and Grandkids whenever I get a chance. I like doing puzzles and I have a lot of pictures that I have made with Diamond Art Painting. I like to walk with friends.",
    destination:
      "My husband and I went to Italy with some friends. Our friend was born in Italy in a small town outside of Rome. We spent some time with his family in their homes. It was a true experience enjoying their cultures.",
    why: "I love working with my son and seeing the professional side of him.",
  },
  {
    slug: "jeremy-waters",
    name: "Jeremy Waters",
    title: "Marketing Director",
    group: "admin",
    photo: "/team/jeremy-waters-2026.webp",
    quote: "Move with momentum and momentum will move you.",
    history: [
      "Over 20 years of projects ranging from web development, design, print design, digital displays, signage, vehicle graphics, packaging and more.",
    ],
    inspires: "Jesus and the people I work with everyday. Leaders, inventors, disruptors.",
    hobbies: "Woodworking - 3D Design - Web Development - Animation - Software - Hardware Engineering - Playing sports with my kids",
    destination: "Crystal Mountain - The summit of Rainier Express",
    why: "I get to help businesses and brands become more efficient, expand their reach and attract new customers through branding, web design and web development best practices.",
  },
];

export const PLANNERS = TEAM.filter((m) => m.group === "planner");
export const ADMIN_TEAM = TEAM.filter((m) => m.group === "admin");
export const CEO = TEAM.find((m) => m.slug === "michael-gauthier")!;

export function getTeamMember(slug: string) {
  return TEAM.find((m) => m.slug === slug) ?? null;
}
