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
  const measureRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | "auto">("auto")
  const shouldAnimate = !nested && !reduceMotion

  React.useLayoutEffect(() => {
    if (!shouldAnimate) {
      setHeight("auto")
      return
    }

    const measured = measureRef.current
    if (!measured) {
      return
    }

    function sync(element: HTMLDivElement) {
      const next = element.getBoundingClientRect().height
      setHeight((current) => (current === next ? current : next))
    }

    sync(measured)
    const observer = new ResizeObserver(() => sync(measured))
    observer.observe(measured)
    return () => observer.disconnect()
  }, [shouldAnimate])

  if (!shouldAnimate) {
    return <div className={className}>{children}</div>
  }

  return (
    <AnimateHeightContext.Provider value={true}>
      <motion.div
        className={cn("overflow-hidden", className)}
        initial={false}
        animate={{ height }}
        transition={{ height: heightTransition }}
      >
        <div ref={measureRef}>{children}</div>
      </motion.div>
    </AnimateHeightContext.Provider>
  )
}

export { AnimateHeight, heightTransition }
