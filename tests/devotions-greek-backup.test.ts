import { describe, expect, it } from "vitest"

import {
  GREEK_BACKUP_VERSION,
  parseGreekBackupPayload,
  type GreekBackupPayloadV1,
} from "@/lib/devotions-greek-backup"

describe("devotions greek backup", () => {
  it("parses v2 payload", () => {
    const raw: GreekBackupPayloadV1 = {
      version: GREEK_BACKUP_VERSION,
      exportedAt: "2026-04-13T12:00:00.000Z",
      progress: '{"totalXp":1}',
      place: '{"bookSlug":"john","chapter":1,"verse":1}',
      uiPrefs: null,
      wordMemory: null,
      dailyRun: null,
      endingsLab: null,
      questTrack: '{"mode":"calendar"}',
    }
    expect(parseGreekBackupPayload(raw)).toEqual(raw)
  })

  it("parses legacy v1 export without questTrack field", () => {
    const legacy = {
      version: 1 as const,
      exportedAt: "2026-01-01T00:00:00.000Z",
      progress: null,
      place: null,
      uiPrefs: null,
      wordMemory: null,
      dailyRun: null,
      endingsLab: null,
    }
    expect(parseGreekBackupPayload(legacy)).toEqual({
      ...legacy,
      questTrack: null,
    })
  })

  it("rejects wrong version", () => {
    expect(parseGreekBackupPayload({ version: 99, exportedAt: "x" })).toBeNull()
  })
})
