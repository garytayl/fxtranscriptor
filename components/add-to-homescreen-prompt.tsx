"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "fxarchives-add-to-homescreen-dismissed"

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return !!nav.standalone || (window.matchMedia("(display-mode: standalone)").matches)
}

function wasDismissed(): boolean {
  if (typeof localStorage === "undefined") return true
  return localStorage.getItem(STORAGE_KEY) === "1"
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // ignore
  }
}

export function AddToHomeScreenPrompt() {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isIOS() || isStandalone() || wasDismissed()) {
      setShow(false)
      return
    }
    setShow(true)
  }, [mounted])

  const dismiss = () => {
    setDismissed()
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Add to Home Screen"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent" aria-hidden>
            <ShareIcon />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold text-card-foreground">Add fxarchives to your Home Screen</p>
            <p className="text-sm text-muted-foreground">
              Get quick access like an app: tap the <strong className="text-foreground">Share</strong> button{" "}
              <ShareIcon className="inline size-4" /> at the bottom of Safari, then choose{" "}
              <strong className="text-foreground">Add to Home Screen</strong>.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            <XIcon />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={dismiss}>
            Maybe later
          </Button>
          <Button size="sm" className="flex-1" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("size-5", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
