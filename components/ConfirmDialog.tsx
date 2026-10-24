'use client'

import type { ReactNode } from 'react'
import Sheet from './Sheet'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  icon?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'default',
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <Sheet onClose={onCancel} title={title} size="sm" z="z-[70]">
      {icon && (
        <div
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            tone === 'danger' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-600'
          }`}
        >
          {icon}
        </div>
      )}
      {description && <p className="leading-relaxed text-ink-500">{description}</p>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-1 ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  )
}
