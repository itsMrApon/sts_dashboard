import { Attendee, User, Webinar } from "@prisma/client"

export type ValidationErrors = Record<string, string>


export type ValidationResult = {
  valid: boolean
  errors: ValidationErrors
} 

export const validateBasicInfo = (data:
 { 
  webinarName?: string 
  description?: string 
  date?: Date 
  time?: string 
  timeFormat?: 'AM' | 'PM'
}): ValidationResult => {
  const errors: ValidationErrors = {}

  if (!data.webinarName?.trim ()) {
    errors.webinarName = "Webinar name is required"
  }
  if (!data.description?.trim ()) {
    errors.description = "Description is required"
  }
  if (!data.date) {
    errors.date = "Date is required"
  }
  if (!data.time?.trim()) {
    errors.time = 'Time is required'
  }else {
    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]$/
     if (!timeRegex.test(data.time)) {
       errors.time = 'Time must be in format HH:MM (e.g., 10:30)'
      }
    }
    return { 
      valid: Object.keys(errors).length === 0, 
      errors 
    }
  
} 

export const validateCTA = (data: {
  ctaLabel?: string 
  tags?: string[] 
  ctaType: string
  aiAgent?: string
}): ValidationResult => {
  const errors: ValidationErrors = {}

  if (!data.ctaLabel?.trim()) {
    errors.ctaLabel = 'CTA label is required'
  }
  if (!data.ctaType) {
    errors.ctaType = 'Please select a CTA type'
  }
  return {
    errors,
    valid: Object.keys(errors).length === 0,
  }
}

export const validateAdditionalInfo = (data: {
  lockChat?: boolean 
  couponCode?: string 
  couponEnabled?: boolean
}): ValidationResult => {
  const errors: ValidationErrors = {}

  if (data.couponEnabled && !data.couponCode?.trim()) {
    errors.couponCode = 'Coupon code is required when enabled'
  }
  return {
    errors,
    valid: Object.keys(errors).length === 0,
  }
}

export type AttendanceData = {
  count: number
  users: Attendee[]
}

export type WebinarWithPresenter = Webinar & {
  presenter: User
}

export type StreamCallRecording = {
  filename: string 
  url: string 
  start_time: Date 
  end_time: Date 
  session_id: string
}