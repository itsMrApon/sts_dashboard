import { create } from 'zustand'
import {
  validateBasicInfo,
  validateAdditionalInfo,
  validateCTA,
  ValidationErrors,
  ValidationResult,
} from '@/lib/type'
import {
  DEFAULT_VARIANT,
  WebinarLinkVariant,
  sanitizeVariants,
} from '@/lib/webinarLinkVariants'

export type WebinarFormState = {
  basicInfo: {
    selectedVariants: WebinarLinkVariant[]
    webinarName?: string
    description?: string
    date?: Date
    time?: string
    timeFormat?: 'AM' | 'PM'
    thumbnail?: string
  }
  cta: {
    ctaLabel?: string 
    tags?: string[] 
    aiAgent?: string 
    priceld?: string
  }
  additionalInfo: {
    lockChat?: boolean 
    couponCode?: string 
    couponEnabled?: boolean
  }
}

type ValidationState = {
  basicInfo: {
    valid: boolean
    errors: ValidationErrors
  }
  cta: {
    valid: boolean
    errors: ValidationErrors
  }
  additionalInfo: {
    valid: boolean
    errors: ValidationErrors
  }
}

type StsStore = {
  isModalOpen: boolean
  isComplete: boolean
  isSubmitting: boolean
  formData: WebinarFormState
  validation: ValidationState

  setModalOpen: (open: boolean) => void
  setComplete: (complete: boolean) => void
  setSubmitting: (submitting: boolean) => void

  updateBasicInfoField: <K extends keyof WebinarFormState['basicInfo']>(
    field: K,
    value: WebinarFormState['basicInfo'] [K]
  ) => void

  updateCTAField: <K extends keyof WebinarFormState['cta']>( 
    field: K,
    value: WebinarFormState['cta'][K]
   ) => void

  setSelectedVariants: (variants: WebinarLinkVariant[]) => void

  updateAdditionalInfoField: <K extends keyof WebinarFormState['additionalInfo']>(
    field: K,
    value: WebinarFormState['additionalInfo'][K]
  ) => void

  addTag: (tag: string) => void
  removeTag: (tag: string) => void

  validateStep: (stepId: keyof WebinarFormState)=> boolean

  getStepValidationErrors: (stepId: keyof WebinarFormState) => ValidationErrors
  
  resetValidation: () => void

  resetForm: () => void

}

const initialState: WebinarFormState = {
  basicInfo: {
    selectedVariants: [DEFAULT_VARIANT],
    webinarName: "",
    description: "",
    date: undefined,
    time: "",
    timeFormat: "AM",
    thumbnail: '',
  },
  cta: {
    ctaLabel: "",
    tags: [],
    aiAgent: "",
    priceld: "",
  },
  additionalInfo: {
    lockChat: false,
    couponCode: "",
    couponEnabled: false,
  },
}

const initialValidation: ValidationState ={
  basicInfo: { valid: false, errors: {}} , 
  cta: { valid: false, errors: {}} ,
  additionalInfo: { valid: true, errors: {}} ,
}

export const useStsStore = create<StsStore>((set, get) => ({
  isModalOpen: false,
  isComplete: false,
  isSubmitting: false,
  formData: initialState,
  validation: initialValidation,

  setModalOpen: (open: boolean) => set({ isModalOpen: open }),
  setComplete: (complete: boolean) => set({ isComplete: complete }),
  setSubmitting: (submitting: boolean) => set({ isSubmitting: submitting }),

  updateBasicInfoField: (field, value) => {
    set((state) => {
        const newBasicInfo = { ...state.formData.basicInfo, [field]: value }
        const validationResult = validateBasicInfo(newBasicInfo)
        return {
          formData: { ...state.formData, basicInfo: newBasicInfo },
          validation: { ...state.validation, basicInfo: validationResult }
        }
      })
    },

    updateCTAField: (field, value) =>{
        set((state) => {
          const newCTA = { ...state.formData.cta, [field]: value }

          const validationResult = validateCTA({
            ...newCTA,
            selectedVariants: state.formData.basicInfo.selectedVariants,
          })
          return {
            formData: { ...state.formData, cta: newCTA },
            validation: { ...state.validation, cta: validationResult },
          }
        })
    },

    setSelectedVariants: (variants) => {
      set((state) => {
        const selectedVariants = sanitizeVariants(variants)
        const nextBasicInfo = { ...state.formData.basicInfo, selectedVariants }
        const basicValidation = validateBasicInfo(nextBasicInfo)
        const ctaValidation = validateCTA({
          ...state.formData.cta,
          selectedVariants,
        })
        return {
          formData: { ...state.formData, basicInfo: nextBasicInfo },
          validation: {
            ...state.validation,
            basicInfo: basicValidation,
            cta: ctaValidation,
          },
        }
      })
    },
    
    updateAdditionalInfoField: (field, value) => {
        set((state) => {
          const newAdditionalInfo = { ...state.formData.additionalInfo, [field]: value, }
          const validationResult = validateAdditionalInfo(newAdditionalInfo)
          return {
            formData: { ...state.formData, additionalInfo: newAdditionalInfo, },
            validation: { ...state.validation, additionalInfo: validationResult, },
          }
        })
    },

    validateStep: (stepId: keyof WebinarFormState) => {
      const { formData } = get()

      // Default: steps without validation (e.g. "type") are always valid
      let validationResult: ValidationResult = { valid: true, errors: {} }

      switch (stepId) {
        case 'basicInfo':
          validationResult = validateBasicInfo(formData.basicInfo)
          break
        case 'cta':
          validationResult = validateCTA({
            ...formData.cta,
            selectedVariants: formData.basicInfo.selectedVariants,
          })
          break
        case 'additionalInfo':
          validationResult = validateAdditionalInfo(formData.additionalInfo)
          break
        default:
          // keep default valid: true
          break
      }

      set((state) => ({
        validation: { ...state.validation, [stepId]: validationResult },
      }))

      return validationResult.valid
    },

    getStepValidationErrors: (stepId: keyof WebinarFormState) => {
      return get().validation[stepId].errors
    },

    resetValidation: () => {
      set({
        validation: initialValidation
      })
    },
    
    resetForm: () => 
      set({
        isComplete: false,
        isSubmitting: false,
        formData: initialState,
        validation: initialValidation,
      }),
      addTag: (tag: string) => set((state) => {
        const newTags = [...(state.formData.cta.tags || []), tag]
        const newCTA = { ...state.formData.cta, tags: newTags }
        return {
          formData: { ...state.formData, cta: newCTA },
        }
      }),
      removeTag: (tagToRemove: string) => set((state) => {
        const newTags = (state.formData.cta.tags || []).filter((tag) => tag !== tagToRemove)
        const newCTA = { ...state.formData.cta, tags: newTags }
        return {
          formData: { ...state.formData, cta: newCTA },
        }
      }),
}))
