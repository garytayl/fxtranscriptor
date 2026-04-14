"use client"

import { useEffect, useState, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Download, Share2 } from "lucide-react"

const STORAGE_KEY = "fx_devotions_a2hs_v1"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return !!nav.standalone || window.matchMedia("(display-mode: standalone)").matches
}

function wasDismissed(): boolean {
  if (typeof localStorage === "undefined") return true
  return localStorage.getItem(STORAGE_KEY) === "1"
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    /* ignore */
  }
}

/** Phones & small tablets — avoid a full-width install bar on desktop browsers. */
function isInstallPromptViewport(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(max-width: 1024px)").matches) return true
  return isIOS() || /Android/i.test(navigator.userAgent)
}

export function AddToHomeScreenPrompt() {
  const pathname = usePathname()
  const onDevotionsRoute =
    pathname === "/devotions" || (typeof pathname === "string" && pathname.startsWith("/devotions/"))

  const [mounted, setMounted] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBip)
    return () => window.removeEventListener("beforeinstallprompt", onBip)
  }, [])

  useEffect(() => {
    if (!mounted || !onDevotionsRoute || isStandalone() || wasDismissed() || !isInstallPromptViewport()) {
      setShow(false)
      return
    }
    setShow(true)
  }, [mounted, onDevotionsRoute])

  const dismiss = useCallback(() => {
    setDismissed()
    setShow(false)
  }, [])

  const runInstall = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (outcome === "accepted") {
        setDismissed()
        setShow(false)
      }
    } catch {
      /* user dismissed OS sheet */
    } finally {
      setInstalling(false)
    }
  }, [deferredPrompt])

  if (!show) return null

  const canInstall = deferredPrompt != null

  return (
    <div
      role="dialog"
      aria-label="Add devotions to Home Screen"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[90] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "animate-in slide-in-from-bottom-4 duration-300",
      )}
    >
      <div className="flex w-full max-w-lg items-stretch gap-2 rounded-2xl border border-white/15 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/85">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"
            aria-hidden
          >
            {isIOS() ? <Share2 className="size-5" /> : <Download className="size-5" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-tight text-white">Add devotions to your Home Screen</p>
            {canInstall ? (
              <p className="text-xs leading-snug text-white/65">One tap installs this site like an app for faster return.</p>
            ) : isIOS() ? (
              <p className="text-xs leading-snug text-white/65">
                Tap <strong className="text-white/90">Share</strong>{" "}
                <Share2 className="inline size-3.5 align-text-bottom opacity-90" /> in Safari, then{" "}
                <strong className="text-white/90">Add to Home Screen</strong>.
              </p>
            ) : (
              <p className="text-xs leading-snug text-white/65">
                Open your browser <strong className="text-white/90">menu (⋮)</strong> and choose{" "}
                <strong className="text-white/90">Install app</strong> or{" "}
                <strong className="text-white/90">Add to Home screen</strong>.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col justify-center gap-1.5 sm:flex-row sm:items-center">
          {canInstall ? (
            <Button
              type="button"
              size="sm"
              className="h-9 min-w-[5.5rem] whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={installing}
              onClick={() => void runInstall()}
            >
              {installing ? "…" : "Install"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={dismiss}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  )
}
