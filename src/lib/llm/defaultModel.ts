const hardDefault = 'gemini-2.5-flash'

function pickDefaultModel(): string {
  const env =
    process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL?.trim() ||
    process.env.LLM_CHOICE?.trim() ||
    ''
  return env || hardDefault
}

export const DEFAULT_LLM_MODEL = pickDefaultModel()
