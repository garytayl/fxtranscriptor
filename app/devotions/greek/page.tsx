import { redirect } from "next/navigation"

export const metadata = {
  title: "Greek Study · Endings Lab",
  description:
    "Greek Study routes here first: memorize endings, then move into Grammar Reader or Verse Quest.",
}

export default function DevotionsGreekPage() {
  redirect("/devotions/greek/endings")
}
