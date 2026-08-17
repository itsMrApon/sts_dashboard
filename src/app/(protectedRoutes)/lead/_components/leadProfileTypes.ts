import type { MeetingScoreDetail } from '@/lib/leads/scoreTypes'
import type { ProjectFormSnapshot } from '@/lib/leads/projectFormByEmail'

export type LeadMeetingScore = MeetingScoreDetail

export type LeadProfileMeeting = {
  id: string
  summary: string | null
  recordedAt: string
  fathomUrl: string | null
  score: LeadMeetingScore | null
  scoreHistory?: LeadMeetingScore[]
}

export type LeadProfileData = {
  id: string
  name: string
  email: string
  emailIsSynthetic: boolean
  company: string | null
  notes: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  source?: 'MEETING' | 'BUSINESS'
  selectedAgentId: string | null
  lastAppointmentAt: string | null
  nextFollowUpAt?: string | null
  updatedAt: string
  kind: 'Instant' | 'Calendar' | 'Business'
  status: 'Scored' | 'Needs score' | 'No summary'
  outboundStatus?: 'NEW' | 'ON_PROCESS' | 'DONE'
  research: unknown
  form: ProjectFormSnapshot | null
  activities?: Array<{
    id: string
    type: string
    note: string | null
    scheduledAt: string | null
    meetLink: string | null
    createdAt: string
  }>
  meeting: LeadProfileMeeting | null
  meetings: LeadProfileMeeting[]
}
