import { describe, expect, it } from "vitest"

import {
  GREEK_BACKUP_VERSION,
  parseGreekBackupPayload,
  type GreekBackupPayloadV1,
} from "@/lib/devotions-greek-backup"

describe("devotions greek backup", () => {
  it("parses v1 payload", () => {
    const raw: GreekBackupPayloadV1 = {
      version: GREEK_BACKUP_VERSION,
      exportedAt: "2026-04-13T12:00:00.000Z",
      progress: '{"totalXp":1}',
      place: '{"bookSlug":"john","chapter":1,"verse":1}',
      uiPrefs: null,
      wordMemory: null,
      dailyRun: null,
      endingsLab: null,
    }
    expect(parseGreekBackupPayload(raw)).toEqual(raw)
  })

  it("rejects wrong version", () => {
    expect(parseGreekBackupPayload({ version: 99, exportedAt: "x" })).toBeNull()
  })
})
