import { Attendee, User, Webinar } from "@prisma/client"
import {
  WebinarLinkVariant,
  hasBookCallVariant,
  hasBuyNowVariant,
  hasProjectVariant,
  sanitizeVariants,
} from './webinarLinkVariants'

export type ValidationErrors = Record<string, string>


export type ValidationResult = {
  valid: boolean
  errors: ValidationErrors
} 

export const validateBasicInfo = (data: {
  selectedVariants?: WebinarLinkVariant[]
  webinarName?: string
  description?: string
  date?: Date
  time?: string
  timeFormat?: 'AM' | 'PM'
  thumbnail?: string
}): ValidationResult => {
  const errors: ValidationErrors = {}
  const selectedVariants = sanitizeVariants(data.selectedVariants)

  if (!data.webinarName?.trim ()) {
    errors.webinarName = "Webinar name is required"
  }
  if (!data.description?.trim ()) {
    errors.description = "Description is required"
  }
  if (!selectedVariants.length) {
    errors.selectedVariants = 'Select at least one link option'
  }

  if (hasProjectVariant(selectedVariants)) {
    if (!data.date) {
      errors.date = 'Date is required'
    }
    if (!data.time?.trim()) {
      errors.time = 'Time is required'
    } else {
      const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]$/
      if (!timeRegex.test(data.time)) {
        errors.time = 'Time must be in format HH:MM (e.g., 10:30)'
      }
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
  selectedVariants?: WebinarLinkVariant[]
  aiAgent?: string
  priceld?: string
}): ValidationResult => {
  const errors: ValidationErrors = {}
  const selectedVariants = sanitizeVariants(data.selectedVariants)
  const needsBookCall = hasBookCallVariant(selectedVariants)
  const needsCheckout = hasBuyNowVariant(selectedVariants) || needsBookCall

  if (!data.ctaLabel?.trim()) {
    errors.ctaLabel = 'CTA label is required'
  }
  if (needsBookCall && !data.aiAgent?.trim()) {
    errors.aiAgent = 'AI agent is required for Book a Call links'
  }
  if (needsCheckout && !data.priceld?.trim()) {
    errors.priceld = 'Stripe product is required for selected links'
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