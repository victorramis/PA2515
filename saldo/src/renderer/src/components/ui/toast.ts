import { toast as sonner } from 'sonner'
import { useStore } from '@/store'

/** Bekräftelse med ”Ångra” i 8 s (samma som ⌘Z). */
export function toastUndo(message: string) {
  sonner(message, {
    duration: 8000,
    action: {
      label: 'Ångra',
      onClick: () => {
        useStore.getState().undo()
      }
    }
  })
}

export function toastOk(message: string) {
  sonner(message, { duration: 4000 })
}

export function toastError(message: string) {
  sonner.error(message, { duration: 6000 })
}
