"use client"

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "cn"

/** Morphing on-screen size — matches --ease-in-out */
const heightEase = [0.77, 0, 0.175, 1] as const

const heightTransition = {
  duration: 0.25,
  ease: heightEase,
}

const AnimateHeightContext = React.createContext(false)

interface AnimateHeightProps {
  className?: string
  children: React.ReactNode
}

function AnimateHeight({ className, children }: AnimateHeightProps) {
  const nested = React.useContext(AnimateHeightContext)
  const reduceMotion = useReducedMotion()
  const shouldAnimate = !nested && !reduceMotion

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>
  }

  return (
    <AnimateHeightContext.Provider value={true}>
      <AnimatedHeight className={className}>{children}</AnimatedHeight>
    </AnimateHeightContext.Provider>
  )
}

function AnimatedHeight({ className, children }: AnimateHeightProps) {
  const measureRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | "auto">("auto")

  React.useLayoutEffect(() => {
    const measured = measureRef.current
    if (!measured) {
      return
    }

    const observer = new ResizeObserver(() => {
      // offsetHeight is layout size; getBoundingClientRect shrinks under CSS scale
      // and would clip scaled previews (e.g. FormMiniPreview).
      const next = measured.offsetHeight
      setHeight((current) => (current === next ? current : next))
    })
    observer.observe(measured)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      className={cn("overflow-hidden", className)}
      initial={false}
      animate={{ height }}
      transition={{ height: heightTransition }}
    >
      <div ref={measureRef}>{children}</div>
    </motion.div>
  )
}

export { AnimateHeight, heightTransition }
