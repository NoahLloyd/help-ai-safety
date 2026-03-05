"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface Insight {
  title: string;
  body: string;
}

interface Section {
  heading: string;
  intro?: string;
  insights: Insight[];
}

// ─── Content ────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    heading: "Before the call",
    insights: [
      {
        title: "Prep the question, not the answer",
        body: "Their stated question (\"how do I get into AI safety?\") is almost never the real bottleneck. Maybe they're optimizing for prestige over impact, or stuck on a false constraint (\"I don't have a CS degree so I can't contribute technically\"). Spend your prep time figuring out what they actually need help with.",
      },
      {
        title: "Have them write down their situation beforehand",
        body: "80,000 Hours found that the prep document is often more valuable than the call itself. When people write out their current situation, options, and uncertainties, they frequently resolve their own confusion. Send a few prompts ahead of time: What are you currently doing? What 2-3 options are you considering? What's the main thing you're unsure about?",
      },
    ],
  },
  {
    heading: "How to actually help",
    insights: [
      {
        title: "They probably already know the answer",
        body: "People often arrive with a strong instinct about what to do but lack the confidence to trust it. Ask \"What does your gut tell you?\" before offering your take. If their instinct is right, confirm it. If it's wrong, you now know exactly where the gap is.",
      },
      {
        title: "Tell your story",
        body: "Research shows that \"just describing who you are and how you ended up in your current position\" is often the single most useful thing in a career conversation. It reveals hidden pathways, makes the field feel accessible, and gives people a concrete model to reason against. Don't skip this because it feels self-indulgent.",
      },
      {
        title: "Challenge their constraints, not their goals",
        body: "When someone says \"I want to work on AI governance but I don't have a policy background,\" don't debate whether governance is the right path. Challenge the assumption that they need a policy background. Many of the most impactful people in AI safety got there through unusual paths.",
      },
      {
        title: "Rank by impact first, then find personal fit",
        body: "Most career advice starts with \"what do you enjoy?\" and then checks for impact. 80,000 Hours found you get better outcomes by inverting this: rank the options by impact first, then figure out which high-impact paths the person could flourish in. This prevents people from settling for \"good enough\" roles when more impactful alternatives exist that they'd also enjoy.",
      },
      {
        title: "Name the roles no one talks about",
        body: "The AI safety talent pipeline is over-optimized for researchers. The field also needs operations people, managers, field-builders, communicators, and founders. If someone doesn't seem like a natural fit for research, don't let them walk away thinking there's nothing for them.",
      },
    ],
  },
  {
    heading: "Common traps",
    insights: [
      {
        title: "Don't be more confident than you should be",
        body: "\"You should do X\" hits differently than \"My best guess is X, and here's why I'm uncertain.\" Even 80,000 Hours, after 1,000+ advising conversations, emphasizes how much individual variation matters. Signal your uncertainty honestly. It makes your confident claims more credible and prevents people from over-indexing on one conversation.",
      },
      {
        title: "Don't recommend your own path",
        body: "Most of the people you talk to have different skills, circumstances, and motivations. The question isn't \"what would I do?\" but \"what should this specific person do given their specific situation?\"",
      },
      {
        title: "Dig into motivation before concluding someone isn't a fit",
        body: "Some people need visible beneficiaries to stay motivated. Others thrive on team loyalty or abstract mission. If someone says they're not excited about a high-impact path, the issue often isn't the path. It's that they haven't found the version of it that matches what drives them. Ask what has energized them in the past.",
      },
      {
        title: "Encouragement is not filler",
        body: "Research consistently shows that mentees value encouragement and realistic framing more than tactical advice. Many people talk themselves out of competitive applications due to imposter syndrome. Concrete encouragement (\"your background in X is unusual and valuable here, I'd encourage you to apply even if it feels like a stretch\") paired with a backup plan is often the highest-value thing you can say.",
      },
    ],
  },
  {
    heading: "Conversation techniques",
    insights: [
      {
        title: "Ask questions that surface real preferences",
        body: "\"What do you want to do?\" invites socially acceptable answers. Better: \"If you had a clone, what tasks would you hand off and what would you keep?\" or \"What parts of your current work make time disappear?\" or \"If this path didn't exist, what would you be doing instead?\"",
      },
      {
        title: "Use the Plan Z technique",
        body: "People avoid ambitious paths because they're scared of the downside. Help them articulate their worst-case fallback: \"If you tried this for a year and it didn't work out, what would you do?\" Usually the Plan Z is fine (go back to previous career, take a different role). Making it concrete reduces the fear that's blocking better decisions.",
      },
      {
        title: "Go deep on one question, not wide on five",
        body: "At the start, ask: \"What's the one thing that, if we figured it out today, would be most useful to you?\" Then stay there.",
      },
    ],
  },
  {
    heading: "After the call",
    insights: [
      {
        title: "One warm introduction > ten resource links",
        body: "An intro to one specific person who can help with their specific situation is worth more than any reading list. If you can make one introduction, do that first.",
      },
      {
        title: "Send one resource, not ten",
        body: "A follow-up with ten links gets zero clicks. One link with a sentence about why it matters for their situation gets read.",
      },
    ],
  },
];

const FURTHER_READING = [
  {
    title: "Guide to Successful Community 1-1s",
    url: "https://forum.effectivealtruism.org/posts/NrLCM4vcf8PRqkLaH/guide-to-successful-community-1-1s",
    source: "EA Forum",
  },
  {
    title: "How to Have High-Impact Conversations",
    url: "https://forum.effectivealtruism.org/posts/eQiSxi3oaxdiM9b24/how-to-have-high-impact-conversations",
    source: "EA Forum",
  },
  {
    title: "What Happens on an 80,000 Hours Call",
    url: "https://forum.effectivealtruism.org/posts/6dPecDMarq3pm3Fbx/what-happens-on-an-80-000-hours-call",
    source: "EA Forum",
  },
  {
    title: "Career-Changing Mentorship: 25 Tips",
    url: "https://review.firstround.com/how-to-be-a-career-changing-mentor-25-tips-from-the-best-mentors-we-know/",
    source: "First Round Review",
  },
  {
    title: "Career Planning Process",
    url: "https://80000hours.org/career-planning/process/",
    source: "80,000 Hours",
  },
];

// ─── Component ──────────────────────────────────────────────

export default function ResourcesPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        The guide playbook
      </h1>
      <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-2xl">
        How to have 1:1s that actually change someone&apos;s trajectory.
        Based on 80,000 Hours&apos; advising methodology, EA community
        research, and mentorship studies.
      </p>

      <div className="mt-10 flex flex-col gap-14">
        {SECTIONS.map((section, si) => (
          <section key={si}>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {section.heading}
            </h2>
            {section.intro && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {section.intro}
              </p>
            )}

            <div className="mt-5 flex flex-col">
              {section.insights.map((insight, ii) => (
                <div
                  key={ii}
                  className={`py-5 ${ii > 0 ? "border-t border-border" : ""}`}
                >
                  <h3 className="text-sm font-semibold text-foreground leading-snug">
                    {insight.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {insight.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Further reading */}
      <div className="mt-14 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Further reading
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sources and more depth on specific techniques.
        </p>

        <div className="mt-5 flex flex-col">
          {FURTHER_READING.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center justify-between py-3 transition-colors hover:text-accent ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                  {link.title}
                </p>
                <p className="text-xs text-muted mt-0.5">{link.source}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted group-hover:text-accent transition-colors ml-3" />
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
