'use client'
import React, { useState } from 'react'
import { Assistant } from '@vapi-ai/server-sdk/api'
import { useAiAgentStore } from '@/store/useAiAgentstore'
import { Button } from '@/components/ui/button'
import { ArrowRight, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import CreateAssistantModal from './CreateAssistantModal'

type Props = {
  aiAgents: Assistant[] | []
}

const AiAgentSidebar = ({ aiAgents }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { assistant, setAssistant } = useAiAgentStore()

  return (
    <div className="w-[300px] border-r border-border flex flex-col">
      <div className="p-4">
        <Button
          className="w-full flex items-center gap-2 mb-2 hover: cursor-pointer"
        >
          <ArrowRight /> Configure Agent
        </Button>
        <div className="flex flex-col mb-4">
          <div className="p-4 bg-primary/10 hover:bg-primary/20 cursor-pointer">
            Livekit ai
          </div>
          <div className="p-4 hover:bg-primary/20 cursor-pointer">
            Vapi ai
          </div>
          <div className="p-4 hover:bg-primary/20 cursor-pointer">
            Retell ai
          </div>
        </div>
        <Button
          className="w-full flex items-center gap-2 mb-4 hover: cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus /> Create Assistant
        </Button>
        <div className="relavent">
          <Input
            placeholder="Search agents"
            className="bg-neutral-900 border-neutral-700 pl-10"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-natural-400" />
        </div>
      </div>
      <ScrollArea className="mt-4 overflow-auto">
        {aiAgents.map ((aiAssistant) => (
          <div className={`p-4 ${
            aiAssistant?.id === assistant?.id ? 'bg-primary/10': ''
            }hover:bg-primary/20 cursor-pointer`} 
            key={aiAssistant.id}
            onClick={() => setAssistant(aiAssistant)}
            >
            <div className="font-medium">
              {aiAssistant.name}
            </div>
          </div>
        ))}
      </ScrollArea>
      <CreateAssistantModal
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

export default AiAgentSidebar