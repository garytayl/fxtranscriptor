"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Bell, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  supportsNotifications,
  isStandalonePWA,
  isNotificationPermissionGranted,
  wasNotificationPromptDismissed,
  setNotificationPromptDismissed,
  requestNotificationPermission,
  subscribeToPush,
} from "@/lib/notifications"

export function NotificationPrompt() {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (
      !supportsNotifications() ||
      !isStandalonePWA() ||
      isNotificationPermissionGranted() ||
      wasNotificationPromptDismissed()
    ) {
      setShow(false)
      return
    }
    if (Notification.permission === "default") {
      setShow(true)
    }
  }, [mounted])

  const handleEnable = async () => {
    if (!supportsNotifications()) return
    setRequesting(true)
    try {
      const permission = await requestNotificationPermission()
      if (permission === "granted") {
        const sub = await subscribeToPush()
        if (sub.ok) {
          toast.success("Notifications enabled", {
            description: "You’ll get reminders for devotions when we send them.",
            duration: 4000,
          })
        } else {
          toast.success("Notifications allowed", {
            description: sub.error || "Reminders will work once the app is fully configured.",
            duration: 4000,
          })
        }
        setShow(false)
      } else if (permission === "denied") {
        toast.info("Notifications blocked", {
          description: "You can enable them later in your device settings.",
          duration: 4000,
        })
        setNotificationPromptDismissed()
        setShow(false)
      }
    } catch (e) {
      toast.error("Could not enable notifications")
    } finally {
      setRequesting(false)
    }
  }

  const handleDismiss = () => {
    setNotificationPromptDismissed()
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Enable notifications"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex justify-center p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent"
            aria-hidden
          >
            <Bell className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-semibold text-card-foreground">Enable notifications?</p>
            <p className="text-sm text-muted-foreground">
              Get reminders for devotions or updates. You can turn them off anytime in device settings.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={handleDismiss}>
            Not now
          </Button>
          <Button size="sm" className="flex-1" onClick={handleEnable} disabled={requesting}>
            {requesting ? "Enabling…" : "Enable"}
          </Button>
        </div>
      </div>
    </div>
  )
}
