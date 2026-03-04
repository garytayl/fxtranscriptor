/**
 * re:groups and other small groups for fxchurch.
 * Shown on the studies page so users can identify their group.
 */

export type StudyTrack = "mat" | "jason"

export interface SmallGroup {
  name: string
  schedule: string
  contact: string
  location: string
  /** Optional link (e.g. Zoom) */
  link?: { label: string; url: string }
  /** Which study track this group uses (default: mat) */
  studyTrack?: StudyTrack
}

/** Spring 2026 re:groups */
export const REGROUPS_SPRING_2026: SmallGroup[] = [
  {
    name: "Snyder's",
    schedule: "Sundays - 1:00PM",
    contact: "Jason - (812) 606-7151",
    location: "Snyder's House (Spencer)",
    studyTrack: "jason",
  },
  {
    name: "Bilotta's",
    schedule: "Sundays - 4:30PM",
    contact: "Luke - (574) 344-6543",
    location: "Bilotta's House (Spencer)",
  },
  {
    name: "Shockney's",
    schedule: "Tuesdays - 6:30PM",
    contact: "Mat - (260) 403-7918",
    location: "Shockney's House (Bloomington West Side)",
  },
  {
    name: "Ramsey's",
    schedule: "Tuesdays - 6:30PM",
    contact: "Bryan - (219) 286-2825",
    location: "Ramsey's House (Bloomington West Side)",
  },
  {
    name: "Han's",
    schedule: "Wednesdays - 7:30PM",
    contact: "Jinsik - (812) 318-7680",
    location: "Han's House (Bloomington West Side)",
  },
]

/** Other groups (fxCampus, Men's Breakfast, Zoom Prayer) */
export const OTHER_GROUPS: SmallGroup[] = [
  {
    name: "fxCampus",
    schedule: "Wednesdays - 7:00PM",
    contact: "Luke - (574) 344-6543",
    location: "On Campus - Wylie Hall 115",
  },
  {
    name: "Men's Breakfast",
    schedule: "Wednesdays - 6:00AM",
    contact: "Mat - (260) 403-7918",
    location: "Panera Bread",
  },
  {
    name: "Zoom Prayer",
    schedule: "Tuesdays/Thursdays - 7:10AM",
    contact: "Click link to join",
    location: "Zoom",
    link: { label: "Click here to join Zoom", url: "https://zoom.us/j/95204896899" },
  },
]

export const SIGN_UP_URL = "https://fxchurch.notion.site" // or replace with actual sign-up link if you have one

/** All groups (re:groups + other) for filtering by study track. */
export const ALL_GROUPS: SmallGroup[] = [...REGROUPS_SPRING_2026, ...OTHER_GROUPS]

export function getGroupsByTrack(track: StudyTrack): SmallGroup[] {
  return ALL_GROUPS.filter((g) => (g.studyTrack ?? "mat") === track)
}
