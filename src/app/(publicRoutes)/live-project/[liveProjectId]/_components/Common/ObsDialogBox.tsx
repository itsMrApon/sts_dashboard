import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { Copy } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

type Props = {
  open?:boolean
  onOpenChange?:(open: boolean)=> void
  rtmpURL:string
  streamKey:string
}

const ObsDialogBox = ({open, onOpenChange, rtmpURL, streamKey}: Props) => {

const copyToClipboard = async (text: string, label: string)=> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    toast.error('Failed to copy to clipboard')
  }
}


  return (
<Dialog
  open={open}
  onOpenChange={onOpenChange}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Observe Stream Credential</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">RTMP URL</label>
        <div className="flex">
          <Input
            value={rtmpURL} 
            className="flex-1"
            readOnly
          />
          <Button 
            variant="outline" 
            size="icon"
            className="ml-2"
            onClick={() => copyToClipboard (rtmpURL, 'RTMP URL' )}
          >
            <Copy size={16} />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Stream Key</label>
        <div className="flex">
          <Input
            value={streamKey}
            className="flex-1"
            readOnly
            type="password"
          />
          <Button 
            variant="outline" 
            size="icon"
            className="ml-2"
            onClick={() => copyToClipboard (streamKey, 'Stream Key' )}
          >
            <Copy size={16} />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          This is the stream key for your OBS browser source.
        </p>
      </div>
    </div>
  </DialogContent>
</Dialog>
  )
}

export default ObsDialogBox