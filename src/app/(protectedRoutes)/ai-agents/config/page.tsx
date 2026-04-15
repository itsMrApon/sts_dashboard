import React from 'react'
import GlobalCredentialsConfig from '../_components/GlobalCredentialsConfig'

const ConfigAgentPage = () => {
  const initialDefaultLlmModel =
    process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL?.trim() ||
    process.env.NEXT_PUBLIC_LLM_CHOICE?.trim() ||
    process.env.LLM_CHOICE?.trim() ||
    'gemini-2.5-flash'

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <GlobalCredentialsConfig initialDefaultLlmModel={initialDefaultLlmModel} />
    </div>
  )
}

export default ConfigAgentPage
