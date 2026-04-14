/**
 * Romans Journey — one guided step at a time (not a wall of text).
 * Passage refs align with lib/meditation-series.ts `romans`.
 */

export type RomansJourneyStep = {
  index: number
  /** Display title, e.g. “I. Letter opening…” */
  label: string
  /** 2–4 sentences, plain language */
  summary: string
  /** Single reflection question */
  reflectionPrompt: string
  passageRef: string
}

const REFS = [
  "Romans 1:1-17",
  "Romans 1:18-32",
  "Romans 2:1-16",
  "Romans 2:17-29",
  "Romans 3:1-8",
  "Romans 3:9-20",
  "Romans 3:21-31",
  "Romans 4:1-25",
  "Romans 5:1-21",
  "Romans 6:1-14",
  "Romans 6:15-7:6",
  "Romans 7:7-25",
  "Romans 8:1-17",
  "Romans 8:18-30",
  "Romans 8:31-39",
  "Romans 9:1-29",
  "Romans 9:30-10:21",
  "Romans 11:1-32",
  "Romans 11:33-36",
  "Romans 12:1-21",
  "Romans 13:1-14",
  "Romans 14:1-23",
  "Romans 15:1-13",
  "Romans 15:14-33",
  "Romans 16:1-27",
] as const

const LABELS = [
  "I. Letter opening and gospel thesis",
  "II. God’s wrath and Gentile accountability",
  "III. Moralizers judged; judgment according to truth",
  "IV. Privilege of the Jew; law on the heart",
  "V. Advantage of the Jews; faithfulness of God",
  "VI. Scripture’s verdict: all under sin",
  "VII. Righteousness through faith apart from law",
  "VIII. Abraham and David: justification by faith",
  "IX. Peace, hope, love, and life in Christ",
  "X. Dead to sin, alive to God",
  "XI. Freed from law’s mastery; slaves to righteousness",
  "XII. Law is good; the problem is sin in the flesh",
  "XIII. No condemnation; life in the Spirit",
  "XIV. Glory with Christ; creation’s groaning",
  "XV. Unshakable love in Christ",
  "XVI. Paul’s anguish; God’s word has not failed",
  "XVII. Christ the goal of the law; faith",
  "XVIII. Remnant, hardening, mercy",
  "XIX. Doxology: depth of God’s wisdom",
  "XX. Living sacrifice; genuine love",
  "XXI. Authorities; love fulfills the law",
  "XXII. Weak and strong; disputable matters",
  "XXIII. Christ our example; unity",
  "XXIV. Paul’s ministry and travel plans",
  "XXV. Greetings, warnings, final grace",
] as const

const SUMMARIES: string[] = [
  "Paul names his calling: the gospel is God’s power to save everyone who believes—not clever talk, but God’s righteousness revealed from faith to faith.",
  "Humanity suppresses what we know of God; idolatry and exchange of truth for lies lead to God handing people over—yet they still know his decree.",
  "Those who judge others indict themselves; God judges secrets; Jew and Gentile meet the same standard of truth.",
  "Outward markers are nothing without inward reality—true circumcision is of the heart, by the Spirit.",
  "Israel received the oracles; God remains true when people are false—his righteousness shines even in judgment.",
  "Psalms and Law agree: no one is righteous; the law shuts every mouth; the world stands accountable before God.",
  "God’s righteousness is through faith in Jesus for all who believe—justified freely, boasting excluded, God one and just.",
  "Abraham’s faith was credited as righteousness before circumcision; David blesses forgivenness; we trust the God who raised Jesus.",
  "Justified, we have peace with God; suffering shapes hope; love is poured in; Adam’s sin is answered by Christ’s grace and reign in life.",
  "Baptism unites us with Christ’s death and resurrection—sin must not reign; present yourselves to God as alive from the dead.",
  "You have been slaves to sin or to God—freed from sin, united to Christ; the illustration of marriage shows death to the law’s old claim.",
  "The law is holy but sin hijacks it; Paul names the inner war—thanks be to God through Jesus our deliverer.",
  "No condemnation for those in Christ; the Spirit gives life and adoption; we are heirs with Christ.",
  "Present suffering is not worth comparing to future glory; creation groans; the Spirit intercedes; God works all for good toward conformity to Christ.",
  "If God is for us, who against us? Christ died, rose, intercedes—nothing separates us from God’s love.",
  "Paul’s heart breaks for Israel; not all Israel is Israel; God’s freedom in election and mercy stands.",
  "Israel stumbled over Christ; righteousness is by faith; beautiful are the feet of those who bring good news.",
  "God has not rejected his people; branches grafted; a mystery—hardening until fullness; God’s mercy on all.",
  "Paul bursts into praise: how unsearchable God’s judgments; from him, through him, to him are all things.",
  "Offer your bodies; don’t conform—renewed mind; one body, many gifts; sincere love; overcome evil with good.",
  "Submit to authorities; owe no one except love; the day is near; put on Christ.",
  "Welcome the weak in faith; don’t quarrel; each stands before God; the kingdom is righteousness, peace, and joy in the Spirit.",
  "Christ did not please himself; unity in praise across Jew and Gentile; hope together.",
  "Paul’s aim: preach where Christ isn’t named; plans toward Spain; collection for Jerusalem; asks for prayer.",
  "Phoebe and many friends; watch divisive people; God will crush Satan under feet; the mystery revealed; glory to God.",
]

const PROMPTS: string[] = [
  "What does it mean to you that the gospel is power, not just information?",
  "Where do you see truth suppressed or exchanged for something lesser—in the world or in yourself?",
  "When you judge others, what does Paul’s mirror ask you to notice about your own heart?",
  "What would it look like for your faith to be ‘inward’ more than performative?",
  "How does God’s faithfulness change the way you think about his silence or your failures?",
  "What does it do to your pride to hear ‘no one righteous’—relief, fear, or hope?",
  "Why might ‘apart from works’ feel threatening—or freeing—to you today?",
  "What encourages you most: Abraham’s trust, David’s forgiveness, or Christ’s resurrection—and why?",
  "Where do you need peace with God or endurance in suffering this week?",
  "What habit or attitude are you tempted to ‘let reign’ instead of offering yourself to God?",
  "What master are you most prone to serve—approval, appetite, anxiety—and how does grace speak to that?",
  "How does naming the ‘inner war’ change how you pray about sin?",
  "What does ‘no condemnation’ free you to do or feel today?",
  "What groaning in you or in the world do you want to hand to God in hope?",
  "What threatens to separate you from God’s love—and what does Paul’s list do to that fear?",
  "How does election talk land for you: comfort, confusion, or both?",
  "What might it mean that Christ is the ‘goal of the law’ for faith?",
  "Where do you see mercy where you expected only judgment—in Romans or in your life?",
  "What one attribute of God in this doxology do you want to sit with quietly?",
  "What would a ‘living sacrifice’ look like in your actual week—not abstractly?",
  "How does ‘love fulfills the law’ reshape a concrete relationship you’re in?",
  "Where are you tempted to despise someone ‘weak’—or fear being judged?",
  "Who needs you to ‘bear with’ them for God’s glory this week?",
  "What part of Paul’s mission heart do you want to imitate—boldness, generosity, prayer?",
  "Who in your church or city might need the ‘grace’ Paul closes with—and how could you carry it?",
]

function buildSteps(): RomansJourneyStep[] {
  return REFS.map((passageRef, i) => ({
    index: i,
    label: LABELS[i] ?? `Step ${i + 1}`,
    summary: SUMMARIES[i] ?? "",
    reflectionPrompt: PROMPTS[i] ?? "What is God stirring in you from this section?",
    passageRef,
  }))
}

export const ROMANS_JOURNEY_STEPS: RomansJourneyStep[] = buildSteps()

export const ROMANS_JOURNEY_TOTAL = ROMANS_JOURNEY_STEPS.length
