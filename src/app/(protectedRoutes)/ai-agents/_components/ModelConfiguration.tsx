'use client'
import { updateAssistant } from '@/actions/vapi'
import { updateLiveKitAgent } from '@/actions/livekitAgent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAiAgentStore } from '@/store/useAiAgentstore'
import type { Assistant } from '@vapi-ai/server-sdk/api'
import { Info, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'

const ModelConfiguration = () => {
  const { assistant: selectedAssistant, livekitAgent, source } = useAiAgentStore()
  const assistant = selectedAssistant as Assistant | null
  const [firstMessage, setFirstMessage] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [llmProvider, setLlmProvider] = useState('google')
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL)
  const [voiceProvider, setVoiceProvider] = useState('deepgram')
  const [voiceModel, setVoiceModel] = useState('aura-asteria-en')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      if (source === 'vapi' && assistant) {
        const res = await updateAssistant(assistant.id as string, firstMessage, systemPrompt)
        if (!res.success) {
          throw new Error(res.message)
        }
        toast.success('Assistant updated successfully.')
      } else if (source === 'livekit' && livekitAgent) {
        const res = await updateLiveKitAgent(livekitAgent.id, {
          firstMessage,
          systemPrompt,
          llmProvider,
          llmModel,
          voiceProvider,
          voiceModel,
        })
        if (!res.success) {
          throw new Error(res.error || 'Failed to update LiveKit agent.')
        }
        toast.success('LiveKit agent updated successfully.')
      }
    } catch (error) {
      console.error('Error updating model configuration:', error)
      toast.error('Failed to update configuration. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (source === 'vapi' && assistant) {
      setFirstMessage(assistant.firstMessage || '')
      setSystemPrompt(assistant.model?.messages?.[0]?.content || '')
    } else if (source === 'livekit' && livekitAgent) {
      setFirstMessage(livekitAgent.firstMessage || '')
      setSystemPrompt(livekitAgent.systemPrompt || '')
      setLlmProvider(livekitAgent.llmProvider || 'google')
      setLlmModel(livekitAgent.llmModel || DEFAULT_LLM_MODEL)
      setVoiceProvider(livekitAgent.voiceProvider || 'deepgram')
      setVoiceModel(livekitAgent.voiceModel || 'aura-asteria-en')
    }
  }, [assistant, livekitAgent, source])

  if (source === 'vapi' && !assistant) {
    return (
      <div className="flex justify-center items-center h-[500px] w-full">
        <div className=" bg-neutral-900 rounded-xl p-6 w-full">
          <p className="text-primary/80 text-center">
            No assistant selected. Please select an assistant to configure the model settings.
          </p>
        </div>
      </div>
    )
  }

  if (source === 'livekit' && !livekitAgent) {
    return (
      <div className="flex justify-center items-center h-[500px] w-full">
        <div className=" bg-neutral-900 rounded-xl p-6 w-full">
          <p className="text-primary/80 text-center">
            LiveKit agent configuration is not available.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900 rounded-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Model</h2>
        <Button
          onClick={handleSave}
          disabled={loading}
        >
          {loading? (
            <>
              <Loader2 className="animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
      <p className="text-neutral-400 mb-6" >
        Configure the behavior of the assistant.
      </p>
      <div className="mb-6" >
        <div className="flex items-center mb-2">
          <label className="font-medium">First Message</label>
          <Info className="h-4 w-4 text-neutral-500 ml-2" />
        </div>
        <Input
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          className="bg-primary/10 border-input"
        />
      </div>

      <div className="mb-6" >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <label className="font-medium">System Prompt</label>
            <Info className="h-4 w-4 text-neutral-500 ml-2" />
          </div>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="bg-primary/10 border-input h-[220px] md:h-[260px] lg:h-[300px] resize-y"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">LLM Provider</label>
          <Select
            value={source === 'livekit' ? llmProvider : assistant?.model?.provider || ''}
            onValueChange={(v) => setLlmProvider(v)}
            disabled={source !== 'livekit'}
          >
            <SelectTrigger className="bg-primary/10 border-input">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="google">Google Gemini</SelectItem>
              <SelectItem value="openai" disabled>
                OpenAI (Phase 2)
              </SelectItem>
              <SelectItem value="anthropic" disabled>
                Claude (Phase 2)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">LLM Model</label>
          <Input
            value={source === 'livekit' ? llmModel : assistant?.model?.model || ''}
            onChange={(e) => setLlmModel(e.target.value)}
            className="bg-primary/10 border-input"
            disabled={source !== 'livekit'}
          />
        </div>
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">Voice Provider</label>
          <Select
            value={voiceProvider}
            onValueChange={(v) => setVoiceProvider(v)}
            disabled={source !== 'livekit'}
          >
            <SelectTrigger className="bg-primary/10 border-input">
              <SelectValue placeholder="Select voice provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepgram">Deepgram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-neutral-300 mb-2 block">Voice Model</label>
          <Input
            value={voiceModel}
            onChange={(e) => setVoiceModel(e.target.value)}
            className="bg-primary/10 border-input"
            disabled={source !== 'livekit'}
          />
        </div>
      </div>
    </div>
  )
}

export default ModelConfiguration