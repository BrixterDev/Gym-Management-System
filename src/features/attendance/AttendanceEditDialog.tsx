import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import type { AttendanceDirectoryRow } from '@/types/database'
import {
  attendanceErrorMessage,
  deleteAttendance,
  updateAttendance,
} from './attendanceApi'

function toLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function AttendanceEditDialog({
  open,
  onClose,
  row,
}: {
  open: boolean
  onClose: () => void
  row: AttendanceDirectoryRow | null
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')
  const [stillInGym, setStillInGym] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open || !row) return
    setTimeIn(toLocalInput(row.time_in))
    setTimeOut(toLocalInput(row.time_out))
    setStillInGym(!row.time_out)
    setFormError(null)
    setConfirmDelete(false)
  }, [open, row])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-stats'] })
    queryClient.invalidateQueries({ queryKey: ['my-attendance'] })
    queryClient.invalidateQueries({ queryKey: ['my-open-session'] })
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error('No attendance record selected')
      if (!timeIn) throw new Error('Time in is required')
      if (!stillInGym && !timeOut) {
        throw new Error('Enter a time out or mark the member as still in the gym')
      }
      const timeInIso = new Date(timeIn).toISOString()
      const timeOutIso = stillInGym ? null : timeOut ? new Date(timeOut).toISOString() : null
      return updateAttendance(row.id, timeInIso, timeOutIso)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Attendance updated')
      onClose()
    },
    onError: (error) => setFormError(attendanceErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error('No attendance record selected')
      return deleteAttendance(row.id)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Attendance record deleted')
      onClose()
    },
    onError: (error) => setFormError(attendanceErrorMessage(error)),
  })

  const pending = updateMutation.isPending || deleteMutation.isPending

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose()
      }}
      title="Correct attendance"
      description={
        row
          ? `${row.display_name ?? 'Unnamed member'} · ${row.member_code ?? row.email}`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="attendance-edit-form"
            loading={updateMutation.isPending}
            disabled={deleteMutation.isPending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        id="attendance-edit-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          setFormError(null)
          updateMutation.mutate()
        }}
      >
        {formError && <Alert tone="error">{formError}</Alert>}

        <Input
          label="Time in"
          type="datetime-local"
          value={timeIn}
          onChange={(event) => setTimeIn(event.target.value)}
          required
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={stillInGym}
            onChange={(event) => setStillInGym(event.target.checked)}
            className="size-4 rounded border-slate-300"
          />
          Still in the gym (no time out yet)
        </label>

        {!stillInGym && (
          <Input
            label="Time out"
            type="datetime-local"
            value={timeOut}
            onChange={(event) => setTimeOut(event.target.value)}
          />
        )}

        <p className="text-xs leading-relaxed text-slate-500">
          Times are entered in your local time and stored as absolute timestamps. Corrections are
          audited with your admin account.
        </p>

        <div className="border-t border-slate-100 pt-4">
          {confirmDelete ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm font-medium text-rose-900">Delete this attendance record?</p>
              <p className="mt-1 text-xs text-rose-700">
                This cannot be undone. The deletion is written to the audit log.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteMutation.mutate()}
                  loading={deleteMutation.isPending}
                >
                  Delete record
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteMutation.isPending}
                >
                  Keep record
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete record
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
