'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAiAgentStore } from '@/store/useAiAgentstore'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'
import type { Assistant } from '@vapi-ai/server-sdk/api'
import { Button } from '@/components/ui/button'
import { Settings2, Plus, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import CreateAssistantModal from './CreateAssistantModal'
import { deleteAssistant } from '@/actions/vapi'
import { deleteLiveKitAgent } from '@/actions/livekitAgent'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

type VapiAssistant = { id: string; name: string }

type Props = {
  aiAgents: VapiAssistant[]
  livekitAgents: LiveKitUiAgentConfig[]
}

const AiAgentSidebar = ({ aiAgents, livekitAgents }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    source: 'vapi' | 'livekit'
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const {
    assistant,
    setAssistant,
    setSource,
    setLivekitAgent,
    livekitAgent,
    source,
    clearAiAssistant,
  } = useAiAgentStore()
  const router = useRouter()

  const filteredLivekitAgents = livekitAgents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )
  const filteredVapiAgents = aiAgents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  const openDeleteDialog = (
    target: { id: string; name: string },
    targetSource: 'vapi' | 'livekit',
  ) => {
    setDeleteTarget({ ...target, source: targetSource })
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res =
        deleteTarget.source === 'livekit'
          ? await deleteLiveKitAgent(deleteTarget.id)
          : await deleteAssistant(deleteTarget.id)
      if (!res.success) {
        throw new Error(
          (res as { error?: string; message?: string }).error ||
            (res as { error?: string; message?: string }).message ||
            'Failed to delete agent',
        )
      }

      if (
        (deleteTarget.source === 'livekit' && livekitAgent?.id === deleteTarget.id) ||
        (deleteTarget.source === 'vapi' && (assistant as VapiAssistant | null)?.id === deleteTarget.id)
      ) {
        clearAiAssistant()
      }

      toast.success('Agent deleted successfully.')
      setIsDeleteDialogOpen(false)
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error('Failed to delete agent. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-r border-border">
      <div className="shrink-0 p-4">
        <Button
          className="w-full flex items-center gap-2 mb-2 cursor-pointer"
          onClick={() => router.push('/ai-agents/config')}
        >
          <Settings2 /> Config Agent
        </Button>
        <Button
          className="w-full flex items-center gap-2 mb-4 cursor-pointer"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus /> Create Assistant
        </Button>
        <div className="relative">
          <Input
            placeholder="Search agents"
            className="bg-neutral-900 border-neutral-700 pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden px-2 pb-4">
        {filteredLivekitAgents.map((agent) => (
          <div
            className={`group p-3 rounded-lg cursor-pointer mb-2 border transition-colors ${
              source === 'livekit' && livekitAgent?.id === agent.id
                ? 'bg-primary/20 border-primary/40'
                : 'bg-primary/10 border-transparent hover:bg-primary/20 hover:border-primary/30'
            }`}
            key={`livekit-${agent.id}`}
            onClick={() => {
              setSource('livekit')
              setLivekitAgent(agent)
            }}
          >
            <div className="font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary/80 shrink-0">
                  LiveKit
                </span>
                <span className="truncate">{agent.name}</span>
              </div>
              <button
                type="button"
                aria-label={`Delete ${agent.name}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  openDeleteDialog(agent, 'livekit')
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {filteredVapiAgents.map((aiAssistant) => (
          <div
            className={`group p-3 rounded-lg cursor-pointer mb-2 border transition-colors ${
              source === 'vapi' && (assistant as VapiAssistant)?.id === aiAssistant.id
                ? 'bg-primary/20 border-primary/40'
                : 'bg-primary/10 border-transparent hover:bg-primary/20 hover:border-primary/30'
            }`}
            key={`vapi-${aiAssistant.id}`}
            onClick={() => {
              setSource('vapi')
              setAssistant(aiAssistant as Assistant)
            }}
          >
            <div className="font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary/80 shrink-0">
                  Vapi
                </span>
                <span className="truncate">{aiAssistant.name}</span>
              </div>
              <button
                type="button"
                aria-label={`Delete ${aiAssistant.name}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  openDeleteDialog(aiAssistant, 'vapi')
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </ScrollArea>
      <CreateAssistantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteConfirm()
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AiAgentSidebar
