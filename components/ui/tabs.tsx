"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"

const tabIndicatorTransition = {
  type: "spring" as const,
  bounce: 0.16,
  duration: 0.45,
}

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  const layoutGroupId = React.useId()

  return (
    <LayoutGroup id={layoutGroupId}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex min-w-0 gap-2 data-horizontal:flex-col",
          className
        )}
        {...props}
      />
    </LayoutGroup>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const reduceMotion = useReducedMotion()

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:text-foreground dark:data-active:text-foreground",
        className
      )}
      render={(renderProps, state) => {
        const { children, ...buttonProps } = renderProps

        return (
          <button type="button" {...buttonProps}>
            {state.active ? (
              <motion.span
                layoutId="active-tab"
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md bg-background shadow-sm group-data-[variant=line]/tabs-list:inset-x-0 group-data-[variant=line]/tabs-list:top-auto group-data-[variant=line]/tabs-list:bottom-[-5px] group-data-[variant=line]/tabs-list:h-0.5 group-data-[variant=line]/tabs-list:rounded-full group-data-[variant=line]/tabs-list:bg-foreground group-data-[variant=line]/tabs-list:shadow-none group-data-vertical/tabs:group-data-[variant=line]/tabs-list:inset-y-0 group-data-vertical/tabs:group-data-[variant=line]/tabs-list:inset-x-auto group-data-vertical/tabs:group-data-[variant=line]/tabs-list:-right-1 group-data-vertical/tabs:group-data-[variant=line]/tabs-list:bottom-auto group-data-vertical/tabs:group-data-[variant=line]/tabs-list:h-auto group-data-vertical/tabs:group-data-[variant=line]/tabs-list:w-0.5 dark:border dark:border-input dark:bg-input/30 dark:group-data-[variant=line]/tabs-list:border-transparent dark:group-data-[variant=line]/tabs-list:bg-foreground"
                transition={
                  reduceMotion ? { duration: 0 } : { layout: tabIndicatorTransition }
                }
              />
            ) : null}
            {children}
          </button>
        )
      }}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("min-w-0 flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
