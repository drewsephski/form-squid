"use client"

import * as React from "react"
import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { parseIsoDate, toIsoDate } from "@/lib/formatter"

interface DatePickerProps {
  id?: string
  value?: string
  onChange: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
  "aria-required"?: boolean
}

function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = typeof value === "string" ? parseIsoDate(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            data-empty={!date}
            aria-invalid={ariaInvalid}
            aria-required={ariaRequired}
            className={cn(
              "w-full justify-between font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        {date ? format(date, "PPP") : <span>{placeholder}</span>}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(next) => {
            onChange(next ? toIsoDate(next) : undefined)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
