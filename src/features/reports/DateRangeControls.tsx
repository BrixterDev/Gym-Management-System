import { CalendarRange, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { todayIsoDate } from '@/lib/utils'
import {
  presetLabels,
  presetRange,
  rangeDays,
  validateRange,
  type DateRange,
  type RangePreset,
} from './reportsApi'

const presets = Object.keys(presetLabels) as RangePreset[]

export function DateRangeControls({
  preset,
  range,
  onChange,
  onReset,
}: {
  preset: RangePreset
  range: DateRange
  onChange: (preset: RangePreset, range: DateRange) => void
  onReset: () => void
}) {
  const error = validateRange(range)
  const days = rangeDays(range)

  const selectPreset = (next: RangePreset) => {
    if (next === 'custom') {
      onChange('custom', range)
      return
    }
    onChange(next, presetRange(next))
  }

  const updateDate = (key: 'from' | 'to', value: string) => {
    onChange('custom', { ...range, [key]: value })
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="lg:w-44">
          <Select
            label="Period"
            value={preset}
            onChange={(event) => selectPreset(event.target.value as RangePreset)}
          >
            {presets.map((option) => (
              <option key={option} value={option}>
                {presetLabels[option]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <Input
            label="From"
            type="date"
            value={range.from}
            max={range.to || todayIsoDate()}
            onChange={(event) => updateDate('from', event.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={range.to}
            min={range.from}
            max={todayIsoDate()}
            onChange={(event) => updateDate('to', event.target.value)}
          />
        </div>

        <div className="flex flex-1 items-center justify-between gap-3 lg:justify-end">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <CalendarRange className="size-3.5" aria-hidden />
            {days > 0 ? `${days} day${days === 1 ? '' : 's'}` : 'Select dates'}
          </p>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}
