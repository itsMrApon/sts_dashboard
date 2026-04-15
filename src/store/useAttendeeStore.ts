import { Attendee } from '@prisma/client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AttendeeStore = {
  attendee: Attendee | null
  /** Product id for which attendee was last registered (so we can skip form on refresh). */
  enteredProductId: string | null
  setAttendee: (attendee: Attendee) => void
  setEnteredProductId: (id: string) => void
  clearAttendee: () => void
}

export const useAttendeeStore = create<AttendeeStore>()(
  persist(
    (set) => ({
      attendee: null,
      enteredProductId: null,
      setAttendee: (attendee: Attendee) => set({ attendee }),
      setEnteredProductId: (id: string) => set({ enteredProductId: id }),
      clearAttendee: () => set({ attendee: null, enteredProductId: null }),
    }),
    {
      name: 'attendee-storage',
    },
  ),
)
