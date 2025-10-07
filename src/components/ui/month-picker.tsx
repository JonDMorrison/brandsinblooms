import * as React from "react"
import { format, parse, startOfMonth, isBefore, isSameMonth } from "date-fns"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MonthPickerProps {
  value?: string // YYYY-MM format
  onChange?: (value: string) => void
  minDate?: Date
  className?: string
  disabled?: boolean
}

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
]

export function MonthPicker({ 
  value, 
  onChange, 
  minDate = new Date(),
  className,
  disabled = false
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [displayYear, setDisplayYear] = React.useState(() => {
    if (value) {
      const parsed = parse(value, 'yyyy-MM', new Date())
      return parsed.getFullYear()
    }
    return new Date().getFullYear()
  })

  const selectedDate = value ? parse(value, 'yyyy-MM', new Date()) : null
  const currentMonth = new Date()
  const minMonth = startOfMonth(minDate)

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(displayYear, monthIndex, 1)
    const formattedValue = format(newDate, 'yyyy-MM')
    onChange?.(formattedValue)
    setOpen(false)
  }

  const isMonthDisabled = (monthIndex: number) => {
    const monthDate = startOfMonth(new Date(displayYear, monthIndex, 1))
    return isBefore(monthDate, minMonth)
  }

  const isMonthSelected = (monthIndex: number) => {
    if (!selectedDate) return false
    const monthDate = new Date(displayYear, monthIndex, 1)
    return isSameMonth(monthDate, selectedDate)
  }

  const isCurrentMonth = (monthIndex: number) => {
    const monthDate = new Date(displayYear, monthIndex, 1)
    return isSameMonth(monthDate, currentMonth)
  }

  const previousYear = () => {
    setDisplayYear(prev => prev - 1)
  }

  const nextYear = () => {
    setDisplayYear(prev => prev + 1)
  }

  const displayValue = selectedDate 
    ? format(selectedDate, 'MMMM yyyy')
    : 'Select month'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-12 pl-11 pr-4 text-lg font-medium justify-start text-left bg-background border border-gray-300 transition-all duration-200 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="p-4 space-y-4">
          {/* Year Navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={previousYear}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[100px] text-center">
              {displayYear}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={nextYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Months Grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month, index) => {
              const disabled = isMonthDisabled(index)
              const selected = isMonthSelected(index)
              const current = isCurrentMonth(index)

              return (
                <button
                  key={month}
                  onClick={() => !disabled && handleMonthSelect(index)}
                  disabled={disabled}
                  className={cn(
                    "relative px-3 py-2 text-sm font-medium rounded-md transition-all duration-200",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                    selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    !selected && !disabled && "hover:bg-accent",
                    current && !selected && "ring-2 ring-primary/50"
                  )}
                >
                  {month.slice(0, 3)}
                  {current && !selected && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Helper Text */}
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {selectedDate ? (
              <span>Selected: {format(selectedDate, 'MMMM yyyy')}</span>
            ) : (
              <span>Select a month to continue</span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
