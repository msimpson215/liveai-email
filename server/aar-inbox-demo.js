/**
 * Sample inbox for the talk-only email demo. Not Randy's real email.
 * Names and addresses are made up; every address is @example.com.
 */

const BUYERS = [
  {
    id: 'b1', from: 'Dave Whitaker', email: 'dave.whitaker@example.com', city: 'Tulsa, OK',
    subject: 'The red Hellcat from Tuesday’s video',
    body: 'Randy, I watched Tuesday’s video on the red 2019 Challenger Hellcat. If it’s for sale when it’s done, I’m in. I’m pre-approved through my credit union up to $48,000, or I can bring a cashier’s check. I’m two hours away and can come look at it any Saturday. Call me at 918-555-0147. Big fan, Dave.',
    why: 'Names the exact car, has financing lined up, gives a phone number, and can come in person.',
    score: 96
  },
  {
    id: 'b2', from: 'Maria Lopez', email: 'mlopez.trucks@example.com', city: 'Amarillo, TX',
    subject: 'Ram 2500 Cummins — still available?',
    body: 'Hi Randy, is the white Ram 2500 Cummins you fixed last month still around? I need a work truck for my landscaping business. Budget is around $38k. I can drive up this week. My cell is 806-555-0193.',
    why: 'Business buyer with a real need, a budget, and a timeline this week.',
    score: 91
  },
  {
    id: 'b3', from: 'Tom Becker', email: 'tbecker@example.com', city: 'Wichita, KS',
    subject: 'Interested in the Corvette',
    body: 'Randy, the 2018 Corvette Grand Sport you rebuilt is exactly what I’ve been looking for. What would you want for it? I’ve owned two C6s. I can pay cash. 316-555-0122.',
    why: 'Knows the car, says cash, and left a number. Asked for a price.',
    score: 88
  },
  {
    id: 'b4', from: 'Kevin Nguyen', email: 'kevin.n@example.com', city: 'Dallas, TX',
    subject: 'F-150 Raptor',
    body: 'If the Raptor goes up for sale, please put me on the list. I can do $55k and I’m ready now.',
    why: 'Ready now with a number in mind, but no phone and no visit plan yet.',
    score: 80
  },
  {
    id: 'b5', from: 'Lisa Graham', email: 'lgraham@example.com', city: 'Joplin, MO',
    subject: 'Car for my son',
    body: 'Do you ever have reliable cars around $12,000? My son just got his license. We can come see it.',
    why: 'Real buyer with a budget, but not asking about a specific car.',
    score: 72
  },
  {
    id: 'b6', from: 'Ray Holcomb', email: 'rholcomb@example.com', city: 'Little Rock, AR',
    subject: 'Tesla Model 3',
    body: 'Saw the flood Tesla. If it runs right when you’re done, what are you asking?',
    why: 'Interested in a specific car, early stage.',
    score: 66
  },
  {
    id: 'b7', from: 'Shane Porter', email: 'sporter@example.com', city: 'Fort Smith, AR',
    subject: 'Jeep Wrangler',
    body: 'Any Wranglers coming up? Looking for a 4-door under $30k.',
    why: 'Shopping, no specific car yet.',
    score: 61
  },
  {
    id: 'b8', from: 'Angela Reyes', email: 'areyes@example.com', city: 'Oklahoma City, OK',
    subject: 'Mustang GT',
    body: 'Would you sell the blue Mustang GT? I’m local.',
    why: 'Local and interested, short on details.',
    score: 58
  },
  {
    id: 'b9', from: 'Brian Cole', email: 'bcole@example.com', city: 'Springfield, MO',
    subject: 'Trade?',
    body: 'Would you take a trade on one of your trucks? I have a 2015 Silverado.',
    why: 'Wants to trade, which is less certain than a cash buyer.',
    score: 52
  },
  {
    id: 'b10', from: 'Jim Darby', email: 'jdarby@example.com', city: 'Shawnee, OK',
    subject: 'Price on the Charger',
    body: 'What do you want for the Charger?',
    why: 'One line, no details. Worth a short reply.',
    score: 45
  }
]

const FAN_NAMES = [
  'Mike', 'Jen', 'Carlos', 'Steve', 'Amanda', 'Rick', 'Tony', 'Beth', 'Gary', 'Chris',
  'Paul', 'Dana', 'Luis', 'Kim', 'Frank', 'Heather', 'Josh', 'Rachel', 'Walt', 'Nina',
  'Bobby', 'Tara', 'Glenn', 'Sara', 'Eddie', 'Molly', 'Dwayne', 'Kelly', 'Hank', 'Joy',
  'Marcus', 'Pam', 'Leo', 'Tina', 'Darrell', 'Wendy', 'Curtis', 'Lori', 'Ozzie', 'Grace',
  'Russ', 'Vicky', 'Earl', 'Megan', 'Sam'
]
const FAN_LINES = [
  'Love the show, man. Watch every video with my dad.',
  'Your videos got me through a rough week. Thank you.',
  'Great job on the Hellcat. Keep it up!',
  'Been watching since the beginning. Proud of how far you’ve come.',
  'Just wanted to say thanks for being real on camera.'
]
const FANS = FAN_NAMES.map((name, i) => ({
  id: `f${i + 1}`,
  from: name,
  email: `${name.toLowerCase()}${i + 1}@example.com`,
  subject: i % 3 === 0 ? 'Love the channel' : i % 3 === 1 ? 'Thank you' : 'Big fan',
  body: FAN_LINES[i % FAN_LINES.length]
}))

const RUDE = [
  { id: 'r1', from: 'anon4421', email: 'anon4421@example.com', subject: 'You’re a joke', body: 'You overpaid for that car and you know it. Worst channel on YouTube.' },
  { id: 'r2', from: 'TruckGuy77', email: 'truckguy77@example.com', subject: 'Really?', body: 'That paint job was garbage. Stop pretending you know what you’re doing.' },
  { id: 'r3', from: 'Dale R.', email: 'daler@example.com', subject: 'Unsubscribed', body: 'Too many ads. Done with you.' },
  { id: 'r4', from: 'no_name', email: 'noname@example.com', subject: '(no subject)', body: 'You’re an asshole.' }
]

const FLAGGED = [
  {
    id: 'x1', from: 'Linda Martin', email: 'linda.martin@example.com', city: 'Richmond, VA',
    subject: 'I sent money for a Chevelle — was this you?',
    body: 'Hi, I sent a $4,000 deposit to “AAR Auto Sales” on Facebook for a 1970 Chevelle. Now the seller won’t answer. The page had your address. Was this you? I have screenshots.',
    why: 'Looks like a victim of one of the fake pages. Not a buyer and not a fan. She has screenshots, which is evidence.'
  }
]

export const FAN_REPLY = 'Thanks so much, I really appreciate you watching! — Randy'
export const RUDE_REPLY = 'Sorry you feel that way. I do the best I can, and I appreciate you watching. — Randy'

export function inbox() {
  return {
    sample: true,
    buyers: [...BUYERS].sort((a, b) => b.score - a.score),
    fans: FANS,
    rude: RUDE,
    flagged: FLAGGED,
    fanReply: FAN_REPLY,
    rudeReply: RUDE_REPLY
  }
}

export function inboxInstructions() {
  const box = inbox()
  const buyers = box.buyers.map((b, i) =>
    `${i + 1}. ${b.from} from ${b.city}, "${b.subject}". ${b.body} Why: ${b.why}`).join('\n')
  return `INBOX DEMO — this session is a talk-only demo of Randy's email assistant. Do not say the long opening. Do not mention Jessica.
This is a SAMPLE inbox so Randy and Marty can see how it works. Say that once, briefly, the first time it comes up. Never claim this is his real email.
Everything happens by voice. Never tell him to click, tap, type, or press anything. The screen follows what he says on its own, so talk as if you are putting it in front of him: "Here's the best one." "Here are the serious ones."
Keep every answer to one to three short sentences. Give your opinion when he asks for it.

THE SORTED INBOX: 60 emails. ${box.buyers.length} serious buyers, ${box.fans.length} fans just saying thanks, ${box.rude.length} rude ones, and ${box.flagged.length} that looks like a scam victim.
SERIOUS BUYERS, best first:
${buyers}
FANS: ${box.fans.length} short thank-you notes, like "Love the show" and "Your videos got me through a rough week." Your suggested reply to each: "${FAN_REPLY}"
RUDE: ${box.rude.length}. ${box.rude.map(r => `"${r.body}"`).join(' ')} Your suggested reply: "${RUDE_REPLY}" Never send these without his OK, and suggest skipping the one that just says asshole. Silence is fine.
FLAGGED: ${FLAGGED[0].from} from ${FLAGGED[0].city}: ${FLAGGED[0].body} This is not a buyer. She may be a victim of a fake AAR page. Suggest he have you send her a kind reply saying it was not him, that she should report it at ReportFraud.ftc.gov and ic3.gov and to her bank, and ask her to send the screenshots so they can go with the impersonation reports.

When he says to reply to the fans, say the thank-yous are ready and ask if he wants them sent. When he says yes or send them, say they're sent. This is a sample, so nothing really goes out; if he asks, say so.
If he asks about the fake listings or the impersonators, say you can go through those with him too, on his review link.`
}
