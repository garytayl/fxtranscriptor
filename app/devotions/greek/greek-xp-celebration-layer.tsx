"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Sparkles, Sun } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { subscribeGreekXpAwards } from "@/lib/devotions-greek-progress"

type FlyingXp = { id: number; amount: number; x: number; rot: number }

function ConfettiField({ burstKey, palette = "violet" }: { burstKey: number; palette?: "violet" | "emerald" }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const angle = (360 / 42) * i + Math.random() * 14 - 7
        const dist = 100 + Math.random() * 220
        const size = 3 + Math.random() * 6
        const hue =
          palette === "emerald"
            ? 135 + Math.random() * 55
            : Math.random() < 0.33
              ? 155 + Math.random() * 35
              : 265 + Math.random() * 55
        const delay = Math.random() * 0.08
        return { i, angle, dist, size, hue, delay }
      }),
    [burstKey, palette],
  )

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={`${burstKey}-${p.i}`}
          className="absolute rounded-[2px] shadow-sm"
          style={{
            width: p.size,
            height: p.size * 2.4,
            backgroundColor: `hsla(${p.hue}, 82%, 62%, 0.92)`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
            y: Math.sin((p.angle * Math.PI) / 180) * p.dist + 40,
            opacity: 0,
            rotate: p.angle * 4 + 180,
            scale: 0.3,
          }}
          transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1], delay: p.delay }}
        />
      ))}
    </div>
  )
}

/**
 * Full-screen Greek XP / level-up celebrations for all routes under `/devotions/greek`.
 * Driven by `recordGreekStudyEvent` → `subscribeGreekXpAwards` / window event.
 */
export function GreekXpCelebrationLayer() {
  const reduceMotion = useReducedMotion()
  const nextId = useRef(0)
  const [flying, setFlying] = useState<FlyingXp[]>([])
  const [toastXp, setToastXp] = useState<number | null>(null)
  const [levelModal, setLevelModal] = useState<{ level: number; from: number; burstKey: number } | null>(null)
  const [dailyGoalModal, setDailyGoalModal] = useState<{
    todayXp: number
    goalXp: number
    burstKey: number
  } | null>(null)

  useEffect(() => {
    return subscribeGreekXpAwards((d) => {
      if (reduceMotion) {
        setToastXp(d.awardedXp)
        window.setTimeout(() => setToastXp(null), 1400)
        if (d.leveledUp) {
          setLevelModal({ level: d.level, from: d.previousLevel, burstKey: Date.now() })
          window.setTimeout(() => setLevelModal(null), 2800)
        } else if (d.dailyGoalJustMet) {
          setDailyGoalModal({ todayXp: d.todayXp, goalXp: d.dailyGoalXp, burstKey: Date.now() })
          window.setTimeout(() => setDailyGoalModal(null), 2800)
        }
        return
      }

      const id = ++nextId.current
      const x = 28 + Math.random() * 44
      const rot = -12 + Math.random() * 24
      setFlying((f) => [...f, { id, amount: d.awardedXp, x, rot }])
      window.setTimeout(() => {
        setFlying((f) => f.filter((k) => k.id !== id))
      }, 1500)

      if (d.leveledUp) {
        setLevelModal({ level: d.level, from: d.previousLevel, burstKey: Date.now() })
        window.setTimeout(() => setLevelModal(null), 3400)
      } else if (d.dailyGoalJustMet) {
        setDailyGoalModal({ todayXp: d.todayXp, goalXp: d.dailyGoalXp, burstKey: Date.now() })
        window.setTimeout(() => setDailyGoalModal(null), 3400)
      }
    })
  }, [reduceMotion])

  return (
    <div className="pointer-events-none fixed inset-0 z-[600] overflow-hidden">
      <AnimatePresence initial={false}>
        {flying.map((f) => (
          <motion.div
            key={f.id}
            className="absolute bottom-[22%] -translate-x-1/2"
            style={{ left: `${f.x}%` }}
            initial={{ opacity: 0, y: 24, scale: 0.6, rotate: f.rot * 0.3 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [24, -8, -56, -100],
              scale: [0.6, 1.15, 1.05, 0.9],
              rotate: [f.rot * 0.3, f.rot * -0.2, 0],
            }}
            transition={{ duration: 1.35, times: [0, 0.12, 0.55, 1], ease: [0.22, 1, 0.36, 1] }}
          >
            <span
              className="relative whitespace-nowrap font-sans text-xl font-bold tabular-nums tracking-tight text-emerald-100 sm:text-2xl"
              style={{
                textShadow:
                  "0 0 24px rgba(52,211,153,0.9), 0 0 48px rgba(34,197,94,0.45), 0 2px 0 rgba(0,0,0,0.5)",
              }}
            >
              +{f.amount} XP
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {toastXp != null ? (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 left-1/2 z-[610] -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-950/90 px-5 py-2 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/20"
          >
            +{toastXp} XP
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {dailyGoalModal ? (
          <>
            <motion.div
              key="dg-back"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(52,211,153,0.32),transparent_55%),rgba(0,0,0,0.55)]"
            />
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <motion.div
                key="dg-card"
                initial={{ opacity: 0, scale: 0.82, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.06, y: -12 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="relative max-w-sm overflow-hidden rounded-[28px] border border-emerald-400/45 bg-gradient-to-b from-emerald-950/95 via-[#04120c] to-black/95 px-8 pb-10 pt-9 shadow-[0_0_80px_rgba(52,211,153,0.4),0_25px_50px_rgba(0,0,0,0.65)]"
              >
                {!reduceMotion ? <ConfettiField burstKey={dailyGoalModal.burstKey} palette="emerald" /> : null}
                <div className="relative z-[1] text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                    className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-500/20"
                  >
                    <Sun className="size-8 text-emerald-200" aria-hidden />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-300/90"
                  >
                    Daily goal crushed
                  </motion.p>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.18 }}
                    className="mt-2 bg-gradient-to-br from-white via-emerald-100 to-cyan-300 bg-clip-text text-5xl font-bold tabular-nums leading-none text-transparent sm:text-6xl"
                  >
                    {dailyGoalModal.todayXp}
                    <span className="text-3xl font-semibold text-white/35 sm:text-4xl">/{dailyGoalModal.goalXp}</span>
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="mt-3 text-sm text-white/55"
                  >
                    Today&apos;s XP target — keep the streak alive
                  </motion.p>
                </div>
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {levelModal ? (
          <>
            <motion.div
              key="lu-back"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.35),transparent_55%),rgba(0,0,0,0.55)]"
            />
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <motion.div
                key="lu-card"
                initial={{ opacity: 0, scale: 0.82, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.06, y: -12 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                className="relative max-w-sm overflow-hidden rounded-[28px] border border-violet-400/45 bg-gradient-to-b from-violet-950/95 via-[#0c0618] to-black/95 px-8 pb-10 pt-9 shadow-[0_0_80px_rgba(139,92,246,0.45),0_25px_50px_rgba(0,0,0,0.65)]"
              >
                {!reduceMotion ? <ConfettiField burstKey={levelModal.burstKey} /> : null}
                <div className="relative z-[1] text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                    className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-violet-400/35 bg-violet-500/20"
                  >
                    <Sparkles className="size-8 text-violet-200" aria-hidden />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    className="text-[11px] font-semibold uppercase tracking-[0.35em] text-violet-300/90"
                  >
                    Level up
                  </motion.p>
                  <motion.p
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.18 }}
                    className="mt-2 bg-gradient-to-br from-white via-violet-100 to-violet-300 bg-clip-text text-6xl font-bold tabular-nums leading-none text-transparent sm:text-7xl"
                  >
                    {levelModal.level}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="mt-3 text-sm text-white/55"
                  >
                    Promoted from level {levelModal.from}
                  </motion.p>
                </div>
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
