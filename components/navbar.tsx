"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

const routeLinks = [
  { label: "Home", href: "/" },
  { label: "Sermons", href: "/#sermons" },
  { label: "Studies", href: "/studies" },
  { label: "Scripture", href: "/bible" },
  { label: "Devotions", href: "/devotions" },
  { label: "Admin", href: "/admin/login" },
]

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    if (href.startsWith("/bible")) return pathname.startsWith("/bible")
    if (href.startsWith("/admin")) return pathname.startsWith("/admin")
    if (href.startsWith("/studies")) return pathname.startsWith("/studies")
    if (href.startsWith("/devotions")) return pathname.startsWith("/devotions")
    return pathname === href
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 pt-[env(safe-area-inset-top)] bg-[#080808] md:bg-background/80 md:backdrop-blur-md"
      >
        <nav className="flex items-center justify-between min-h-[3.25rem] px-4 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-4 md:px-12 md:py-5">
          <Link href="/" className="group flex items-center gap-2" aria-label="Home">
            <span className="font-mono text-xs tracking-widest text-muted-foreground">fxarchives</span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform duration-300" />
          </Link>

          <ul className="hidden md:flex items-center gap-6">
            {routeLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith("/#") ? (
                  <a
                    href={link.href}
                    className={`group relative font-mono text-xs tracking-wider transition-colors duration-300 ${
                      pathname === "/" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label.toUpperCase()}
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className={`group relative font-mono text-xs tracking-wider transition-colors duration-300 ${
                      isActive(link.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label.toUpperCase()}
                    <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
                  </Link>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="font-mono text-xs tracking-wider text-muted-foreground">SERMON TRANSCRIPTS</span>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden relative min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-1.5 -mr-2"
            aria-label="Toggle menu"
          >
            <motion.span
              animate={isMenuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              className="w-6 h-px bg-foreground origin-center shrink-0"
            />
            <motion.span
              animate={isMenuOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
              className="w-6 h-px bg-foreground shrink-0"
            />
            <motion.span
              animate={isMenuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              className="w-6 h-px bg-foreground origin-center shrink-0"
            />
          </button>
        </nav>
      </motion.header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-lg md:hidden"
          >
            <nav className="flex flex-col items-center justify-center h-full gap-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] px-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-10 sm:gap-y-4 max-w-[280px] sm:max-w-sm">
                {routeLinks.map((link, index) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ delay: index * 0.06 }}
                    className="min-h-[44px] flex items-center justify-center"
                  >
                    {link.href.startsWith("/#") ? (
                      <a
                        href={link.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`block py-2 px-3 text-xl sm:text-2xl font-display tracking-tight text-center ${pathname === "/" ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`block py-2 px-3 text-xl sm:text-2xl font-display tracking-tight text-center ${isActive(link.href) ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {link.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="flex items-center gap-3 mt-4"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="font-mono text-[10px] sm:text-xs tracking-wider text-muted-foreground">SERMON TRANSCRIPTS</span>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
