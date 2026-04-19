/**
 * Koine / biblical Greek combining forms and recognizable stems for root-based vocabulary study.
 * Meanings are short English glosses used as multiple-choice answers (keep them distinct).
 */

export type GreekLessonRoot = {
  id: string
  /** Transliterated form as learners usually see it in textbooks */
  form: string
  /** Core English idea — must be unique enough to distinguish from other roots in MC */
  meaning: string
  exampleGreek?: string
  exampleGloss?: string
  /** Optional tie-in for the explainer */
  note?: string
}

export const GREEK_LESSON_ROOTS: GreekLessonRoot[] = [
  { id: "mono", form: "mono-", meaning: "one, single", exampleGreek: "μονογενής", exampleGloss: "only, one of a kind" },
  { id: "di", form: "di- / δί-", meaning: "two", exampleGreek: "δίδυμος", exampleGloss: "twin", note: "Related: διά- as a prefix often means ‘through.’" },
  { id: "tri", form: "tri-", meaning: "three", exampleGreek: "τρίτος", exampleGloss: "third" },
  { id: "tetra", form: "tetra-", meaning: "four", exampleGreek: "τετρακόσιοι", exampleGloss: "four hundred" },
  { id: "penta", form: "penta-", meaning: "five", exampleGreek: "πεντακόσιοι", exampleGloss: "five hundred" },
  { id: "hex", form: "hex-", meaning: "six", exampleGreek: "ἑξακόσιοι", exampleGloss: "six hundred (in Revelation-style counts)" },
  { id: "hepta", form: "hepta-", meaning: "seven", exampleGreek: "ἑβδομήκοντα", exampleGloss: "seventy" },
  { id: "deca", form: "deca-", meaning: "ten", exampleGreek: "δέκα", exampleGloss: "ten" },
  { id: "polys", form: "poly-", meaning: "many", exampleGreek: "πολύς", exampleGloss: "much, many" },
  { id: "theo", form: "theo- (θεο-)", meaning: "God", exampleGreek: "θεολογία", exampleGloss: "speech about God / theology" },
  { id: "christ", form: "Christ- (Χριστ-)", meaning: "anointed, Messiah", exampleGreek: "Χριστός", exampleGloss: "Christ, Messiah" },
  { id: "angel", form: "angel- (ἀγγελ-)", meaning: "messenger, angel", exampleGreek: "ἄγγελος", exampleGloss: "messenger, angel" },
  { id: "biblio", form: "biblio-", meaning: "book", exampleGreek: "βιβλίον", exampleGloss: "scroll, book" },
  { id: "eu", form: "eu-", meaning: "good, well", exampleGreek: "εὐαγγέλιον", exampleGloss: "good news, gospel" },
  { id: "dys", form: "dys-", meaning: "hard, bad, difficult", exampleGreek: "δυσκόλως", exampleGloss: "with difficulty" },
  { id: "syn", form: "syn- (συν-)", meaning: "with, together", exampleGreek: "συναγωγή", exampleGloss: "gathering, synagogue" },
  { id: "anti", form: "anti-", meaning: "instead of, against, in place of", exampleGreek: "ἀντίχριστος", exampleGloss: "antichrist, instead-of-Christ figure" },
  { id: "kata", form: "kata- (κατά)", meaning: "down, according to, against", exampleGreek: "καταβαίνω", exampleGloss: "I go down" },
  { id: "ana", form: "ana- (ἀνά)", meaning: "up, again, back", exampleGreek: "ἀνίστημι", exampleGloss: "I raise / I rise" },
  { id: "dia", form: "dia- (διά)", meaning: "through, because of", exampleGreek: "διαθήκη", exampleGloss: "covenant, arrangement through cutting" },
  { id: "hyper", form: "hyper-", meaning: "over, above, beyond", exampleGreek: "ὑπερβολή", exampleGloss: "excess, surpassing" },
  { id: "hypo", form: "hypo-", meaning: "under", exampleGreek: "ὑποκριτής", exampleGloss: "actor, pretender (one who answers from under a mask)" },
  { id: "proto", form: "proto-", meaning: "first, chief", exampleGreek: "πρωτότοκος", exampleGloss: "firstborn" },
  { id: "arche", form: "arche-", meaning: "beginning, rule", exampleGreek: "ἀρχή", exampleGloss: "beginning, origin" },
  { id: "tele", form: "tele-", meaning: "end, completion", exampleGreek: "τελειόω", exampleGloss: "I complete, perfect" },
  { id: "soma", form: "somato- (σωματ-)", meaning: "body", exampleGreek: "σωματικός", exampleGloss: "bodily, physical" },
  { id: "sarx", form: "sark- (σαρκ-)", meaning: "flesh", exampleGreek: "σάρξ", exampleGloss: "flesh, human nature" },
  { id: "psych", form: "psych- (ψυχ-)", meaning: "soul, life, mind", exampleGreek: "ψυχή", exampleGloss: "soul, life" },
  { id: "graph", form: "graph- (γραφ-)", meaning: "write, draw", exampleGreek: "γραφή", exampleGloss: "writing, Scripture" },
  { id: "log", form: "log- (λογ-)", meaning: "word, reason, account", exampleGreek: "λόγος", exampleGloss: "word, message, reason" },
  { id: "nom", form: "nom- (νομ-)", meaning: "law, custom", exampleGreek: "νόμος", exampleGloss: "law" },
  { id: "bapt", form: "bapt- (βαπτ-)", meaning: "dip, immerse", exampleGreek: "βαπτίζω", exampleGloss: "I baptize, immerse" },
  { id: "martys", form: "marty- (μαρτυρ-)", meaning: "witness", exampleGreek: "μάρτυς", exampleGloss: "witness" },
  { id: "presbyter", form: "presbyter- (πρεσβυτ-)", meaning: "elder", exampleGreek: "πρεσβύτερος", exampleGloss: "elder" },
  { id: "episkop", form: "episkop- (ἐπισκοπ-)", meaning: "overseer, bishop", exampleGreek: "ἐπίσκοπος", exampleGloss: "overseer, bishop" },
  { id: "ecclesia", form: "eccles- (ἐκκλησ-)", meaning: "assembly, church", exampleGreek: "ἐκκλησία", exampleGloss: "assembly, church" },
  { id: "hagios", form: "hagio- (ἁγι-)", meaning: "holy, saint", exampleGreek: "ἅγιος", exampleGloss: "holy, saint" },
  { id: "doxa", form: "dox- (δοξ-)", meaning: "glory, opinion", exampleGreek: "δόξα", exampleGloss: "glory" },
  { id: "krino", form: "crith- / krin- (κριν-)", meaning: "judge, separate", exampleGreek: "κρίσις", exampleGloss: "judgment" },
  { id: "pist", form: "pist- (πιστ-)", meaning: "faith, trust", exampleGreek: "πίστις", exampleGloss: "faith" },
  { id: "agap", form: "agap- (ἀγαπ-)", meaning: "love", exampleGreek: "ἀγάπη", exampleGloss: "love" },
]
