import { describe, expect, it } from "vitest"

import { getMorphHintAbbrev } from "@/lib/bible/greek-morph-hints"

describe("getMorphHintAbbrev", () => {
  it("abbreviates finite verb", () => {
    expect(
      getMorphHintAbbrev({
        text: "ἦν",
        word: "ἦν",
        lemma: "εἰμί",
        pos: "V-",
        parse: "3IAI-S--",
      }),
    ).toBe("impf.act.ind")
  })

  it("abbreviates participle", () => {
    expect(
      getMorphHintAbbrev({
        text: "λέγων",
        word: "λέγων",
        lemma: "λέγω",
        pos: "V-",
        parse: "-PAPNSM-",
      }),
    ).toBe("pres.act.ptc·nom")
  })
})
