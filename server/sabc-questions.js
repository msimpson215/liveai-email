/**
 * Tim Donahue's StartABusiness.Center methodology, as a question bank.
 *
 * The seven guides are the structure. This file is that structure in a form the
 * system can keep score against: every meaningful question, decision point and
 * exercise from the guides, each with a stable id (G1-Q01 …) so the system
 * always knows what has been answered, part-answered, skipped or never raised.
 *
 * The ids are internal. Nobody ever hears one. They exist so the conversation
 * can be natural on top and bookkept underneath.
 *
 * `ask` is how the assistant would raise it out loud if it had to ask cold —
 * plain and short, not a form field. `field` is where the answer lands in the
 * business profile. `needs` names a concept the person may not know, so the
 * assistant can teach it first rather than quizzing them.
 */

/** Concepts people routinely have not met yet, in plain language. */
const CONCEPTS = {
  'value proposition': 'The reason someone picks you instead of the alternative, in one sentence: who it is for, what changes for them, and why you. Not a slogan — a reason.',
  'target customer': 'One specific kind of person or business, described tightly enough that you could name three real ones. "Everyone" is not a target market.',
  'target market': 'The particular group you are selling to, and how many of them there are within reach of you. Narrower is easier to reach and easier to sell to.',
  'customer acquisition': 'How a stranger becomes a customer — where they first hear of you, what makes them enquire, and what closes it. Every business needs a route that works whether you feel like hustling or not.',
  'competitive advantage': 'The one or two things you are meaningfully better at for that specific customer. "Better quality" does not count unless the customer can see it.',
  'market validation': 'Evidence from other people\'s actions — money, a deposit, an email address, coming back — that they want this. Opinions and compliments are not evidence.',
  'gross margin': 'What is left out of each sale after the direct cost of delivering it, as a percentage. Sell for a hundred, spend sixty making it, that is a forty percent gross margin.',
  'break-even point': 'How many sales a month cover your fixed costs. Fixed monthly costs divided by the gross profit on one sale.',
  'fixed costs': 'What you owe every month whether you sell anything or not — rent, insurance, software, a phone line.',
  'variable costs': 'What each individual sale costs you — materials, packaging, shipping, the card processing fee.',
  'customer acquisition cost': 'What it costs on average to win one customer. Everything you spent getting customers, divided by how many you got.',
  'lifetime value': 'What a customer is worth over the whole relationship: average purchase, times how often they buy in a year, times how many years they stay.',
  'cash flow': 'The timing of money in and out, which is not the same as profit. You can be profitable on paper and still not make payroll, because you paid the supplier in March and get paid in May.',
  'revenue model': 'How the money actually arrives — one-time sale, subscription, retainer, per project, wholesale.',
  'pricing': 'What you charge and why. Priced on what the result is worth to the customer, not on the hours it took you.',
  'business structure': 'The legal form — sole proprietor, LLC, S-corp election, corporation. It decides who is liable and how the tax works.',
  'ein': 'A federal tax ID number for the business. Free from the IRS, takes about ten minutes, and the bank will want it before opening a business account.',
  'dba': 'Doing Business As — registering a trade name different from your own name. Cheap and quick, and not the same thing as forming an LLC.',
  'mvp': 'The smallest thing you can actually deliver that still solves the main problem. Manual and unglamorous is fine. If it takes more than a few weeks to build, it is too big.',
  'sunk cost': 'Money and time already spent, which should not decide what you do next. The founders who lose most are the ones who keep going because of what they already put in.',
  'runway': 'How many months you can keep going on the cash you have, at your current burn rate.',
  'churn': 'The share of customers who stop buying in a given month.',
  'profit margin': 'Net margin is what is left after everything, including your fixed costs, as a percentage of revenue.'
}

/**
 * Ordered by the guides, which is also roughly the order a founder needs them.
 * The conversation does not have to follow this order — it follows the person —
 * but when nothing else is pressing, this is the priority.
 */
const QUESTIONS = [
  /* ---------- Guide 1: Will Your New Business Idea Work? ---------- */
  { id: 'G1-Q01', guide: 1, phase: 'idea', field: 'businessConcept', ask: 'Tell me about the business you are thinking of starting — what would you sell, and who for?' },
  { id: 'G1-Q02', guide: 1, phase: 'idea', field: 'stage', ask: 'Where are you with it right now — still an idea, testing it, already selling, or been running a while?' },
  { id: 'G1-Q03', guide: 1, phase: 'idea', field: 'customerProblem', ask: 'What problem does this solve for them, and how much does that problem actually cost them today?' },
  { id: 'G1-Q04', guide: 1, phase: 'idea', field: 'demandEvidence', ask: 'What evidence do you have that people want this — has anyone outside your friends and family shown real interest?', needs: 'market validation' },
  { id: 'G1-Q05', guide: 1, phase: 'idea', field: 'demandEvidence', ask: 'Has anyone tried to give you money for it yet, or asked when they could buy?' },
  { id: 'G1-Q06', guide: 1, phase: 'idea', field: 'customerConversations', ask: 'How many people outside your own circle have you actually talked to about it?' },
  { id: 'G1-Q07', guide: 1, phase: 'idea', field: 'targetCustomer', ask: 'Describe the one customer you are really after — specifically enough that you could name three real people who fit.', needs: 'target customer' },
  { id: 'G1-Q08', guide: 1, phase: 'idea', field: 'customerChannels', ask: 'Where do those people already gather, online or in person? Name two or three places.' },
  { id: 'G1-Q09', guide: 1, phase: 'idea', field: 'competition', ask: 'Who else is already solving this, and what do you know about how they do it and what they charge?' },
  { id: 'G1-Q10', guide: 1, phase: 'idea', field: 'competition', ask: 'What do their customers complain about — the one and two star reviews, the frustrated threads?' },
  { id: 'G1-Q11', guide: 1, phase: 'idea', field: 'valueProposition', ask: 'Why would someone pick you instead of them? What are you meaningfully better at?', needs: 'value proposition' },
  { id: 'G1-Q12', guide: 1, phase: 'idea', field: 'income', ask: 'What do you need this business to pay you, realistically, for it to be worth doing?' },
  { id: 'G1-Q13', guide: 1, phase: 'idea', field: 'pricing', ask: 'What are you thinking of charging, and where did that number come from?', needs: 'pricing' },
  { id: 'G1-Q14', guide: 1, phase: 'idea', field: 'unitEconomics', ask: 'What does it cost you to deliver one of those — materials, time, fees, all of it?', needs: 'variable costs' },
  { id: 'G1-Q15', guide: 1, phase: 'idea', field: 'unitEconomics', ask: 'So how many sales a month would you need to cover your fixed costs?', needs: 'break-even point' },
  { id: 'G1-Q16', guide: 1, phase: 'idea', field: 'marketSize', ask: 'Roughly how many people could plausibly buy this — is the market big enough that you only need a small slice?' },
  { id: 'G1-Q17', guide: 1, phase: 'idea', field: 'startupCosts', ask: 'What would it cost to get started — the one-time things before you can sell anything?' },
  { id: 'G1-Q18', guide: 1, phase: 'idea', field: 'monthlyCosts', ask: 'And what would the business cost you every month once it is running?', needs: 'fixed costs' },
  { id: 'G1-Q19', guide: 1, phase: 'idea', field: 'personalRunway', ask: 'How many months could you personally pay your own bills if the business earned nothing?', needs: 'runway' },
  { id: 'G1-Q20', guide: 1, phase: 'idea', field: 'founderSkills', ask: 'What are you genuinely good at that this business needs — and be honest, where are the gaps?' },
  { id: 'G1-Q21', guide: 1, phase: 'idea', field: 'founderSkills', ask: 'Of marketing, sales, the numbers, and the actual craft — which one worries you most?' },
  { id: 'G1-Q22', guide: 1, phase: 'idea', field: 'timeAvailable', ask: 'How many hours a week can you really give this, and which days?' },
  { id: 'G1-Q23', guide: 1, phase: 'idea', field: 'dayJob', ask: 'Are you keeping a job while you do this, or is this the whole thing?' },
  { id: 'G1-Q24', guide: 1, phase: 'idea', field: 'risks', ask: 'What is the thing most likely to go wrong here — the one that keeps you up?' },
  { id: 'G1-Q25', guide: 1, phase: 'idea', field: 'lifeFit', ask: 'If this works exactly as planned, do you want the life it creates? What does a normal week look like then?' },
  { id: 'G1-Q26', guide: 1, phase: 'idea', field: 'goDecision', ask: 'Knowing all that, where do you honestly land — go, adjust something first, or park it for now?' },
  { id: 'G1-Q27', guide: 1, phase: 'idea', field: 'founderBackground', ask: 'What have you done before this — work, trade, other businesses? What of it carries over?' },
  { id: 'G1-Q28', guide: 1, phase: 'idea', field: 'location', ask: 'Where does this operate — a shop, a territory, from home, online, or some mix?' },

  /* ---------- Guide 2: Test Your Business Idea Before You Build ---------- */
  { id: 'G2-Q01', guide: 2, phase: 'validate', field: 'validationPlan', ask: 'Before you build anything, how are you planning to find out whether people will actually pay?' },
  { id: 'G2-Q02', guide: 2, phase: 'validate', field: 'customerConversations', ask: 'Can you name ten real people who fit your customer and could be talked to this week?' },
  { id: 'G2-Q03', guide: 2, phase: 'validate', field: 'customerInsights', ask: 'When you have talked to people, what have they told you they already tried, and what did that cost them?' },
  { id: 'G2-Q04', guide: 2, phase: 'validate', field: 'customerInsights', ask: 'What words do they use for the problem? Their exact phrasing, not yours.' },
  { id: 'G2-Q05', guide: 2, phase: 'validate', field: 'painLevel', ask: 'Is this an urgent problem for them or a mild annoyance — have they spent money trying to fix it already?' },
  { id: 'G2-Q06', guide: 2, phase: 'validate', field: 'offerTest', ask: 'Have you put the offer in front of strangers yet — a simple page, a post, an ad — and what happened?' },
  { id: 'G2-Q07', guide: 2, phase: 'validate', field: 'preSales', ask: 'Could you take deposits or pre-orders before you build it? What would you offer the first handful of people?' },
  { id: 'G2-Q08', guide: 2, phase: 'validate', field: 'mvp', ask: 'What is the smallest version you could deliver by hand to five customers in the next few weeks?', needs: 'mvp' },
  { id: 'G2-Q09', guide: 2, phase: 'validate', field: 'firstCustomers', ask: 'Where are your first five customers coming from, by name if possible?' },
  { id: 'G2-Q10', guide: 2, phase: 'validate', field: 'assumptions', ask: 'What are you assuming is true that you have not actually checked?' },
  { id: 'G2-Q11', guide: 2, phase: 'validate', field: 'businessPlan', ask: 'Have you written anything down yet — even three pages — or is it all in your head?' },
  { id: 'G2-Q12', guide: 2, phase: 'validate', field: 'goDecision', ask: 'Given what the testing has told you so far, are you going ahead, changing something, or holding off?' },

  /* ---------- Guide 3: Smart Business Set Up For New Founders ---------- */
  { id: 'G3-Q01', guide: 3, phase: 'setup', field: 'businessStructure', ask: 'Have you set the business up formally yet, or are you still operating as yourself?', needs: 'business structure' },
  { id: 'G3-Q02', guide: 3, phase: 'setup', field: 'businessStructure', ask: 'How much liability risk does the work itself carry — could somebody get hurt or sue over it?' },
  { id: 'G3-Q03', guide: 3, phase: 'setup', field: 'businessName', ask: 'What name are you using, and have you checked whether it is available?', needs: 'dba' },
  { id: 'G3-Q04', guide: 3, phase: 'setup', field: 'ein', ask: 'Do you have an EIN and a separate business bank account yet?', needs: 'ein' },
  { id: 'G3-Q05', guide: 3, phase: 'setup', field: 'licenses', ask: 'Have you checked with your city about a business license, and does your trade need any special permit?' },
  { id: 'G3-Q06', guide: 3, phase: 'setup', field: 'salesTax', ask: 'Will you be collecting sales tax, and have you registered with the state for it?' },
  { id: 'G3-Q07', guide: 3, phase: 'setup', field: 'bookkeeping', ask: 'How are you tracking the money — software, a spreadsheet, or a shoebox?' },
  { id: 'G3-Q08', guide: 3, phase: 'setup', field: 'taxSetAside', ask: 'Are you setting money aside for taxes as it comes in?' },
  { id: 'G3-Q09', guide: 3, phase: 'setup', field: 'insurance', ask: 'Do you have any business insurance, and does your work need it?' },
  { id: 'G3-Q10', guide: 3, phase: 'setup', field: 'intellectualProperty', ask: 'Is there a name, logo or process here worth protecting, and have you looked into whether it is already taken?' },
  { id: 'G3-Q11', guide: 3, phase: 'setup', field: 'funding', ask: 'Where is the startup money coming from — savings, family, a loan, pre-sales?' },
  { id: 'G3-Q12', guide: 3, phase: 'setup', field: 'funding', ask: 'How much do you actually need to raise or spend before the business can pay for itself?' },
  { id: 'G3-Q13', guide: 3, phase: 'setup', field: 'partners', ask: 'Is anyone in this with you? If so, who does what, and how is the ownership split?' },
  { id: 'G3-Q14', guide: 3, phase: 'setup', field: 'partners', ask: 'Is that in writing, with what happens if one of you wants out?' },
  { id: 'G3-Q15', guide: 3, phase: 'setup', field: 'projections', ask: 'Have you put twelve months of numbers on paper — revenue, costs, what is left?' },
  { id: 'G3-Q16', guide: 3, phase: 'setup', field: 'advisors', ask: 'Do you have an accountant or a lawyer you can call when something comes up?' },
  { id: 'G3-Q17', guide: 3, phase: 'setup', field: 'operations', ask: 'Walk me through how the work actually gets done, from an order coming in to the customer being happy.' },
  { id: 'G3-Q18', guide: 3, phase: 'setup', field: 'suppliers', ask: 'Who do you depend on to deliver — suppliers, subcontractors, a platform? What happens if one of them falls over?' },
  { id: 'G3-Q19', guide: 3, phase: 'setup', field: 'staffing', ask: 'Is it just you doing the work, or do you need people? Employees or contractors?' },
  { id: 'G3-Q20', guide: 3, phase: 'setup', field: 'financialAssumptions', ask: 'The numbers in your plan — where did the sales figures come from? What are they assuming?' },

  /* ---------- Guide 4: Create An Offer That People Will Pay You For ---------- */
  { id: 'G4-Q01', guide: 4, phase: 'offer', field: 'transformation', ask: 'What changes for the customer after they buy from you? Where are they before, and where are they after?' },
  { id: 'G4-Q02', guide: 4, phase: 'offer', field: 'offer', ask: 'If you had to say your offer in one sentence — you help who, get from what, to what — how would it go?', needs: 'value proposition' },
  { id: 'G4-Q03', guide: 4, phase: 'offer', field: 'offer', ask: 'What exactly does someone get for their money? The deliverable, plainly.' },
  { id: 'G4-Q04', guide: 4, phase: 'offer', field: 'offer', ask: 'And what is not included? Where do you draw the line?' },
  { id: 'G4-Q05', guide: 4, phase: 'offer', field: 'delivery', ask: 'How long does it take to deliver, and what do you need from the customer to do it?' },
  { id: 'G4-Q06', guide: 4, phase: 'offer', field: 'pricing', ask: 'How did you land on your price — your costs, what others charge, or what the result is worth to them?' },
  { id: 'G4-Q07', guide: 4, phase: 'offer', field: 'revenueModel', ask: 'Is this a one-time sale, a subscription, a retainer, per project? How does the money repeat?', needs: 'revenue model' },
  { id: 'G4-Q08', guide: 4, phase: 'offer', field: 'unitEconomics', ask: 'What is your margin on one sale after the direct costs?', needs: 'gross margin' },
  { id: 'G4-Q09', guide: 4, phase: 'offer', field: 'priceTesting', ask: 'When you have said the price out loud to real prospects, what happened? Instant yes, or did they balk?' },
  { id: 'G4-Q10', guide: 4, phase: 'offer', field: 'objections', ask: 'What is the objection you hear most, and what do you say back?' },
  { id: 'G4-Q11', guide: 4, phase: 'offer', field: 'proof', ask: 'What proof can you show a stranger — results, testimonials, a case you can point to?' },
  { id: 'G4-Q12', guide: 4, phase: 'offer', field: 'offer', ask: 'How many times have you sold this exact offer so far?' },
  { id: 'G4-Q13', guide: 4, phase: 'offer', field: 'entryOffer', ask: 'Is there a smaller first step you could sell to someone not ready for the whole thing yet?' },

  /* ---------- Guide 5: Build a Website That Gets Customers ---------- */
  { id: 'G5-Q01', guide: 5, phase: 'web', field: 'website', ask: 'Do you have a website yet, and what is it actually meant to do — build trust, get leads, or take orders?' },
  { id: 'G5-Q02', guide: 5, phase: 'web', field: 'website', ask: 'If someone lands on it, can they tell in three seconds what you do and what to do next?' },
  { id: 'G5-Q03', guide: 5, phase: 'web', field: 'website', ask: 'Is the pricing on there, or do people have to ask?' },
  { id: 'G5-Q04', guide: 5, phase: 'web', field: 'website', ask: 'Who owns the domain and the site login — is it in your name, on your card?' },
  { id: 'G5-Q05', guide: 5, phase: 'web', field: 'website', ask: 'Have you tried the whole thing on a phone, including buying something?' },
  { id: 'G5-Q06', guide: 5, phase: 'web', field: 'website', ask: 'How are you taking payment, and have you run a real transaction through it?' },
  { id: 'G5-Q07', guide: 5, phase: 'web', field: 'websitePlan', ask: 'Before hiring anyone, have you written the headline and the few things you want it to say?' },
  { id: 'G5-Q08', guide: 5, phase: 'web', field: 'localPresence', ask: 'If someone searches for what you do near where you are, do they find you at all?' },

  /* ---------- Guide 6: How To Find Your First Customers ---------- */
  { id: 'G6-Q01', guide: 6, phase: 'customers', field: 'marketingMessage', ask: 'How do you describe what you do when a stranger asks — the problem, the fix, the result?' },
  { id: 'G6-Q02', guide: 6, phase: 'customers', field: 'marketingChannels', ask: 'How are customers finding you today? Every route, even the accidental ones.' },
  { id: 'G6-Q03', guide: 6, phase: 'customers', field: 'marketingChannels', ask: 'Which two channels are you actually going to commit to for the next ninety days?' },
  { id: 'G6-Q04', guide: 6, phase: 'customers', field: 'marketingTime', ask: 'How much of your week goes to finding customers, honestly, as a share of your working hours?' },
  { id: 'G6-Q05', guide: 6, phase: 'customers', field: 'outreach', ask: 'Are you doing direct outreach — reaching out to specific people by name? How is it going?' },
  { id: 'G6-Q06', guide: 6, phase: 'customers', field: 'referrals', ask: 'Do customers refer you, and have you ever actually asked them to?' },
  { id: 'G6-Q07', guide: 6, phase: 'customers', field: 'emailList', ask: 'Are you collecting emails or phone numbers from people who are not ready to buy yet?' },
  { id: 'G6-Q08', guide: 6, phase: 'customers', field: 'paidAds', ask: 'Have you spent anything on ads? What did you spend, and what came back?' },
  { id: 'G6-Q09', guide: 6, phase: 'customers', field: 'acquisitionCost', ask: 'Do you know what it costs you to win one customer?', needs: 'customer acquisition cost' },
  { id: 'G6-Q10', guide: 6, phase: 'customers', field: 'conversion', ask: 'Of the people who enquire, how many buy?' },
  { id: 'G6-Q11', guide: 6, phase: 'customers', field: 'partnerships', ask: 'Is there anyone serving the same customers with something different, who you could work with?' },
  { id: 'G6-Q12', guide: 6, phase: 'customers', field: 'marketingMessage', ask: 'When you tell a stranger what you do, do they get it? Have you tried it on anyone outside the business?' },

  /* ---------- Guide 7: Grow and Scale Your Business After Launch ---------- */
  { id: 'G7-Q01', guide: 7, phase: 'growth', field: 'currentRevenue', ask: 'What is the business bringing in now, and is that trending up, flat, or down?' },
  { id: 'G7-Q02', guide: 7, phase: 'growth', field: 'profitability', ask: 'After everything, what is actually left at the end of a month?', needs: 'profit margin' },
  { id: 'G7-Q03', guide: 7, phase: 'growth', field: 'revenueMix', ask: 'Which part of what you sell makes the most money — not the most revenue, the most profit?' },
  { id: 'G7-Q04', guide: 7, phase: 'growth', field: 'bottleneck', ask: 'What is the thing holding the business back right now — your time, cash, customers, or people?' },
  { id: 'G7-Q05', guide: 7, phase: 'growth', field: 'customerFeedback', ask: 'Have you asked your existing customers why they chose you and what nearly stopped them?' },
  { id: 'G7-Q06', guide: 7, phase: 'growth', field: 'pricingReview', ask: 'When did you last raise your prices?' },
  { id: 'G7-Q07', guide: 7, phase: 'growth', field: 'systems', ask: 'What do you do over and over that is only in your head, never written down?' },
  { id: 'G7-Q08', guide: 7, phase: 'growth', field: 'delegation', ask: 'Is anyone helping you — employee, contractor, family? What do they handle?' },
  { id: 'G7-Q09', guide: 7, phase: 'growth', field: 'hiringPlan', ask: 'If you were going to bring someone in, what would you hand over first?' },
  { id: 'G7-Q10', guide: 7, phase: 'growth', field: 'cashPosition', ask: 'How is cash — could you cover a month of expenses out of the bank today?', needs: 'cash flow' },
  { id: 'G7-Q11', guide: 7, phase: 'growth', field: 'receivables', ask: 'Do customers pay you up front, or are you waiting on money?' },
  { id: 'G7-Q12', guide: 7, phase: 'growth', field: 'retention', ask: 'Do customers come back? Roughly what share buy a second time?', needs: 'churn' },
  { id: 'G7-Q13', guide: 7, phase: 'growth', field: 'metrics', ask: 'Which numbers do you look at every month?' },
  { id: 'G7-Q14', guide: 7, phase: 'growth', field: 'workload', ask: 'How many hours are you working, and how long since you took a full day off?' },
  { id: 'G7-Q15', guide: 7, phase: 'growth', field: 'distractions', ask: 'What opportunities are pulling at you right now that you have not said no to?' },
  { id: 'G7-Q16', guide: 7, phase: 'growth', field: 'vision', ask: 'Three years out, what do you want this to be — a business you run yourself, one with a team, or one you sell?' },
  { id: 'G7-Q17', guide: 7, phase: 'growth', field: 'milestones', ask: 'What has to be true twelve months from now for you to call this a good year?' },
  { id: 'G7-Q18', guide: 7, phase: 'growth', field: 'goals', ask: 'And what is the very next thing you are going to do about all this?' },
  { id: 'G7-Q19', guide: 7, phase: 'growth', field: 'systems', ask: 'If you handed one of those jobs to somebody tomorrow, could they do it from what is written down?' },
  { id: 'G7-Q20', guide: 7, phase: 'growth', field: 'staffing', ask: 'Who is doing the work a year from now — still you, or a team? How many?' }
]

const BY_ID = new Map(QUESTIONS.map(q => [q.id, q]))

/** Profile sections, in the order a review reads best. */
const PROFILE_FIELDS = [
  'businessConcept', 'stage', 'location', 'founderBackground', 'founderSkills', 'timeAvailable', 'dayJob', 'lifeFit',
  'customerProblem', 'targetCustomer', 'customerInsights', 'painLevel', 'customerChannels',
  'marketSize', 'competition', 'valueProposition', 'transformation', 'offer', 'entryOffer', 'delivery', 'proof',
  'pricing', 'priceTesting', 'objections', 'revenueModel', 'unitEconomics',
  'demandEvidence', 'customerConversations', 'validationPlan', 'offerTest', 'preSales', 'mvp', 'firstCustomers',
  'startupCosts', 'monthlyCosts', 'income', 'personalRunway', 'funding', 'projections', 'financialAssumptions',
  'businessStructure', 'businessName', 'ein', 'licenses', 'salesTax', 'insurance',
  'intellectualProperty', 'bookkeeping', 'taxSetAside', 'partners', 'advisors',
  'operations', 'suppliers', 'staffing',
  'website', 'websitePlan', 'localPresence',
  'marketingMessage', 'marketingChannels', 'marketingTime', 'outreach', 'referrals',
  'emailList', 'paidAds', 'acquisitionCost', 'conversion', 'partnerships',
  'currentRevenue', 'profitability', 'revenueMix', 'cashPosition', 'receivables', 'retention', 'metrics',
  'bottleneck', 'systems', 'delegation', 'hiringPlan', 'workload', 'distractions',
  'customerFeedback', 'pricingReview', 'risks', 'assumptions', 'businessPlan',
  'vision', 'milestones', 'goals', 'goDecision'
]

const FIELD_SET = new Set(PROFILE_FIELDS)

const GUIDE_TITLES = {
  1: 'Will Your New Business Idea Work?',
  2: 'Test Your Business Idea Before You Build',
  3: 'Smart Business Set Up For New Founders',
  4: 'Create An Offer That People Will Pay You For',
  5: 'Build a Website That Gets Customers',
  6: 'How To Find Your First Customers',
  7: 'Grow and Scale Your Business After Launch'
}

/**
 * A compact index for the model that does the bookkeeping: every id with just
 * enough text to recognise when an answer covers it.
 */
function questionIndex() {
  return QUESTIONS.map(q => `${q.id} [${q.field}] ${q.ask}`).join('\n')
}

export { QUESTIONS, BY_ID, CONCEPTS, PROFILE_FIELDS, FIELD_SET, GUIDE_TITLES, questionIndex }
