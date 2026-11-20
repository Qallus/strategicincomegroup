-- Employee profiles: the public /team/<slug> pages, edited by each employee in
-- Dashboard → My Profile (or through the MCP connector), and by admins for anyone.
--
-- One row per team member. profile_id links the row to a dashboard user; it is
-- null until that person has an account. account_email is the (private) email
-- used to link the row automatically when that user first opens My Profile —
-- the public contact email is the separate `email` column.
--
-- The public site reads this table server-side and falls back to the static
-- roster in lib/public-site/team.ts if the table is missing or the query fails.

create table if not exists public.employee_profiles (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid unique references public.profiles(id) on delete set null,
  account_email        text,
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- Basics
  full_name            text,
  first_name           text,
  last_name            text,
  job_title            text,
  credentials          text,
  office               text check (office in ('East Valley Office', 'West Valley Office')),
  employment_date      date,

  -- Photos
  photo_url            text,
  gallery_urls         text[] not null default '{}',

  -- About me
  experience           text,            -- multi-paragraph; paragraphs separated by a blank line
  inspires             text,
  hobbies              text,
  best_purchase        text,            -- best purchase under $100
  favorite_destination text,
  why_love_job         text,
  favorite_quote       text,

  -- Contact (public)
  phone                text,
  email                text,
  linkedin_url         text,

  -- Schedule
  work_days            text[] not null default '{}'
                       check (work_days <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  start_time           time,
  close_time           time,

  -- Website
  team_group           text not null default 'admin' check (team_group in ('leadership', 'planner', 'admin')),
  booking_href         text,
  is_published         boolean not null default true,
  sort_order           integer not null default 0,

  updated_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists employee_profiles_published_idx on public.employee_profiles (is_published, sort_order);
create index if not exists employee_profiles_account_email_idx on public.employee_profiles (lower(account_email));
create index if not exists employee_profiles_updated_by_idx on public.employee_profiles (updated_by);

create or replace function public.set_employee_profiles_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employee_profiles_updated_at on public.employee_profiles;
create trigger employee_profiles_updated_at
  before update on public.employee_profiles
  for each row execute function public.set_employee_profiles_updated_at();

-- ── RLS: server-only (the app reads/writes with the service role) ─────────────
alter table public.employee_profiles enable row level security;
revoke all on table public.employee_profiles from anon, authenticated;

-- ── Seed: the current roster from lib/public-site/team.ts ─────────────────────
insert into public.employee_profiles
  (slug, account_email, full_name, first_name, last_name, job_title, credentials, team_group, office, photo_url, booking_href,
   experience,
   inspires, hobbies, favorite_destination, why_love_job, favorite_quote, sort_order)
values
  ($t$michael-gauthier$t$, $t$mike@strategicincomegroup.com$t$, $t$Michael Gauthier$t$, $t$Michael$t$, $t$Gauthier$t$, $t$Founder & CEO$t$, $t$CFP®$t$, $t$leadership$t$, null, $t$/team/michael-gauthier-2026.webp$t$, $t$/book?planner=michael-gauthier$t$,
   $t$Michael is a CERTIFIED FINANCIAL PLANNER™ professional with over two decades worth of experience helping families and individuals meet their wealth-building goals. In March of 2013, he left a large Wall Street firm to start Strategic Income Group, where he provides one-on-one financial consulting and management services.

Michael enjoys sitting down with clients and showing them new capabilities and offerings. His mission is to change your relationship with money. In his downtime, he loves spending time with his wife and three children.$t$,
   $t$My wife Kristi! She is selflessly dedicated to our family and others and at the same time has more personal discipline than anyone I know. She is gentle yet strong; humble and beautiful. She amazes me every day.$t$, $t$I love the outdoors. It is where I can find adventure and refill my energy tank. Mountain biking, camping, hiking, hunting, fishing especially with friends and family.$t$, $t$Any adventure with Team G (my family)! We have so much fun together exploring new places and sharing new experiences. I’ll never forget the summer of 2022 where we did a 2500-mile road trip from Arizona, through Utah, Idaho, Wyoming and Montana. Amazing adventures and lifetime of memories.$t$, $t$I love to teach and equip others to not only fulfill their dreams but even encourage them to dream bigger. Obviously being a good steward with your finances is a big part of achieving this. Our clients’ dreams continue to expand and grow which is why one of SIG’s core values is to Pursue Excellence and constantly improve as an organization. It is at that point, where SIG’s strive for excellence and our clients dreams meet that I find the most satisfaction in.$t$, $t$Our family life verse is from Matthew 5:16 and says “In the same way, let your light shine before others, that they may see your good deeds and glorify your father in heaven”.$t$, 10),
  ($t$laurie-simons$t$, null, $t$Laurie Simons$t$, $t$Laurie$t$, $t$Simons$t$, $t$Certified Financial Planner$t$, $t$CFP®, CTFA®$t$, $t$planner$t$, $t$East Valley Office$t$, $t$/team/laurie-simons.webp$t$, $t$/book?planner=laurie-simons$t$,
   $t$Laurie joined Strategic Income Group in October 2019 but she began her career with a large well known Financial Services firm in 1993 and instantly fell in love with this industry. Over the years she has worked in many facets of this amazing industry including trust services, investment management, retirement income planning, insurance planning and estate planning.

In addition to the normal industry licenses and training she received specialized training and became accredited as a Certified Trust Financial Advisor in 2002 and a CERTIFIED FINANCIAL PLANNER™ in 2012.

In her role as a fiduciary she brings her past experiences and education and leverages it with the Strategic Income Group Planning process. Her real strength is the patient way she can take a complex concept and explain it in a way that clients can understand.

Laurie grew up in eastern Oregon and has been a resident of Arizona for over 19 years. She graduated from Eastern Washington University in 1992 and then relocated to Texas to start her career in this business.$t$,
   null, $t$Laurie has one son that keeps her busy with high school and club baseball as he chases his dream to play college baseball. When Laurie is not at a baseball game she may be hiking, mountain biking, watching sports or walking Bubba – their 100 pound black lab.$t$, null, null, null, 20),
  ($t$chad-manberg$t$, null, $t$Chad Manberg$t$, $t$Chad$t$, $t$Manberg$t$, $t$Certified Financial Planner$t$, $t$CFP®$t$, $t$planner$t$, $t$West Valley Office$t$, $t$/team/chad-manberg.webp$t$, $t$/book?planner=chad-manberg$t$,
   $t$Chad has been with Strategic Income Group since 2013 and has more than a decade of experience as a financial planner. As a CERTIFIED FINANCIAL PLANNER™ professional, he has developed a passion for helping people reach their financial potential and serves as a trusted advocate for his clients.

In believing that everyone should have a basic understanding of financial planning and investment management, Chad teaches adult learning classes in multiple subject areas of finance around the valley. Chad is a proud graduate of Arizona State University and has been invited back to be a guest speaker on multiple occasions.$t$,
   $t$Chad is happily married to his lovely wife Lesly and has two daughters and a son.$t$, $t$Away from the business he enjoys playing soccer and tennis, traveling and spending time with his family and friends.$t$, null, $t$He also holds his Accredited Asset Management Specialist (SM) (AAMS®) and is one of the rare people that enjoys investment analysis.$t$, null, 30),
  ($t$keri-alcos$t$, null, $t$Keri Alcos$t$, $t$Keri$t$, $t$Alcos$t$, $t$Wealth Planner$t$, $t$CWS®$t$, $t$planner$t$, $t$West Valley Office$t$, $t$/team/keri-alcos.webp$t$, $t$/book?planner=keri-alcos$t$,
   $t$Keri Alcos joined Strategic Income Group in 2023 as a seasoned financial planner and licensed Medicare specialist with 20+ years in the financial services industry. Keri brings with her the Certified Wealth Strategist® designation and she is also a Licensed Medicare Agent.

Keri has significant expertise in managing investment portfolios and creating comprehensive financial plans for clients at large brokerage firms including Charles Schwab & Company, Morgan Stanley, and USAA. She has a highly robust depth of knowledge in wealth management solutions, financial planning strategies, tax management, and Medicare health care solutions.

As a former collegiate athlete, Keri has a passion for health and loves educating and helping others with Medicare solutions tailored to their unique health needs and wellness preferences. She was born in Southern California and graduated from Cal State Long Beach with a BA in Psychology.$t$,
   $t$My father inspires me because he would give the shirt off his back or the last dollar in his wallet to help those he loves.$t$, $t$I like to invest time in relationships with family and friends and get outside for a hike, ride on the lake, or traveling to new destinations.$t$, $t$Nothing beats the beauty of mother nature. I love any scenic destination that provides tranquility and peace. Maui is top on this list for me.$t$, $t$I love getting to collaborate with like-minded individuals that are passionate about serving each other, our clients, and the community.$t$, $t$“I’ve learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.” ― Maya Angelou$t$, 40),
  ($t$martha-cortez$t$, null, $t$Martha “MO” Cortez$t$, $t$Martha$t$, $t$Cortez$t$, $t$Senior Client Service Associate$t$, $t$FPQP®$t$, $t$admin$t$, null, $t$/team/martha-cortez.webp$t$, null,
   $t$As a Senior Client Service Associate, I manage client relationships with our custodians which includes account processing, transfers, trading, wires, etc. Also one of my main responsibilities is to assist in managing our two Reg D Funds – Strategic Income Fund, LP, and SIG Opportunities Fund, LP. These funds are available exclusively to our accredited investors. In order to bring the most to my many roles over the years including office manager and compliance, I studied and earned my Series 7 license, Series 66 license, and Financial Paraplanner designation.

MO Cortez is a founding member of Strategic Income Group opening our doors in March 2013. MO has been in the financial services industry for 30+ years. 21 of those years have been spent working alongside CEO Mike Gauthier servicing our clients with all of their financial planning needs.$t$,
   $t$My daughters are my number one inspiration. Becoming a Mom is the best thing that has ever happened to me. Watching them grow and become independent successful young women is the best reward I could ever earn.$t$, null, $t$Traveling with my husband! Wish we could go more often but we try to travel at least two to three times a year.$t$, $t$100% My Clients! My favorite part of my day is talking with my clients and knowing they trust in me and can call me any time and I will always be there for them! Financial and personal. A relationship I take to heart!$t$, $t$“What doesn’t kill you makes you stronger” – Friedrich Nietzsche$t$, 50),
  ($t$julie-klodt$t$, $t$julie@strategicincomegroup.com$t$, $t$Julie Klodt$t$, $t$Julie$t$, $t$Klodt$t$, $t$Executive Assistant to Michael Gauthier, CEO$t$, null, $t$admin$t$, null, $t$/team/julie-klodt.webp$t$, null,
   $t$Julie joined Strategic Income Group as our Administrative Assistant in January 2021. In March 2022, she was promoted to Mike’s Executive Assistant. Julie is tasked with helping Mike bring new ideas and business strategies across the finish line. She contributes to the efficiency of the business by providing personalized and timely support to Mike so that Mike can focus on Pursuing Excellence—one of SIG’s Core Values.

Julie is originally from the Midwest and moved to Arizona 8 years ago. She is a graduate of Iowa State University and has over 30 years of client support and account management experience in the pharmaceutical, retail and travel industries. Julie has always believed in the value of financial and estate planning and encourages others to be involved in this extremely important process.$t$,
   $t$My father inspires me because he works tirelessly at something he loves to do.$t$, $t$I love to visit the Desert Botanical Garden and Boyce Thompson Arboretum. I love nature, plants, animals and the great outdoors.$t$, $t$Hawaii. I have been to Maui, Oahu, and The Big Island. Each island is unique as well as beautiful and serene.$t$, $t$It is very rewarding to contribute to a positive client experience, our team’s success and to get to be involved in so many different projects that keep the firm humming.$t$, $t$“We are all faced with a series of great opportunities brilliantly disguised as impossible situations.” – Chuck Swindoll$t$, 60),
  ($t$bree-sigler$t$, $t$bree@strategicincomegroup.com$t$, $t$Bree Sigler$t$, $t$Bree$t$, $t$Sigler$t$, $t$Client Service Associate$t$, null, $t$admin$t$, null, $t$/team/bree-sigler-2026.webp$t$, null,
   null,
   null, null, null, null, null, 70),
  ($t$cecilia-gauthier$t$, null, $t$Cecilia Gauthier$t$, $t$Cecilia$t$, $t$Gauthier$t$, $t$Project Specialist$t$, null, $t$admin$t$, null, $t$/team/cecilia-gauthier.webp$t$, null,
   $t$I started working at Strategic Income Group on March 7, 2013. I wanted to help my son Michael Gauthier at his new Company. I helped MO with paperwork bringing over established clients and setting up new ones. I did whatever was needed at the time.

I worked full-time until December of 2017 when I retired. In early 2018 Michael asked me if I would come in when I could just to help with scanning, shredding, and whatever needed to be done. So, now I’m working one day a week.$t$,
   $t$My Dad did as he was always helping people at St. Vincent De Paul. He was always available to help when someone needed him.$t$, $t$I like to spend time with my family and Grandkids whenever I get a chance. I like doing puzzles and I have a lot of pictures that I have made with Diamond Art Painting. I like to walk with friends.$t$, $t$My husband and I went to Italy with some friends. Our friend was born in Italy in a small town outside of Rome. We spent some time with his family in their homes. It was a true experience enjoying their cultures.$t$, $t$I love working with my son and seeing the professional side of him.$t$, null, 80),
  ($t$jeremy-waters$t$, $t$jeremy@strategicincomegroup.com$t$, $t$Jeremy Waters$t$, $t$Jeremy$t$, $t$Waters$t$, $t$Marketing Director$t$, null, $t$admin$t$, null, $t$/team/jeremy-waters-2026.webp$t$, null,
   $t$Over 20 years of projects ranging from web development, design, print design, digital displays, signage, vehicle graphics, packaging and more.$t$,
   $t$Jesus and the people I work with everyday. Leaders, inventors, disruptors.$t$, $t$Woodworking - 3D Design - Web Development - Animation - Software - Hardware Engineering - Playing sports with my kids$t$, $t$Crystal Mountain - The summit of Rainier Express$t$, $t$I get to help businesses and brands become more efficient, expand their reach and attract new customers through branding, web design and web development best practices.$t$, $t$Move with momentum and momentum will move you.$t$, 90)
on conflict (slug) do nothing;

-- Link rows to existing dashboard users by email (the app also links on My Profile load).
update public.employee_profiles ep
   set profile_id = p.id
  from public.profiles p
 where ep.profile_id is null
   and ep.account_email is not null
   and lower(p.email) = lower(ep.account_email)
   and not exists (select 1 from public.employee_profiles x where x.profile_id = p.id);
