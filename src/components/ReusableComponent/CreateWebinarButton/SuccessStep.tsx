import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy, ExternalLink, Link, PlusCircle } from 'lucide-react'
import React, { useState } from 'react'

type Props = {
  projectLink: string
  onCreateNew: () => void
}

const SuccessStep = ({ projectLink, onCreateNew }: Props) => {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(projectLink)
    setCopied(true)
    setTimeout(() => {setCopied(false)}, 2000)
  }


  return (
    <div className="relative text-center space-y-6 py-8 px-6">
      <div className="flex items-center justify-center">
        <div className=" bg-green-500 rounded-full p-2">
          <Check className="h-6 w-6 text-primary" />
        </div>
      </div>
      <h2 className="text-2xlfont-bold">Your project is live now </h2>
      <p className="text-foreground">You can share the link</p>
      <div className="flex mt-4 max-w-md mx-auto">
        <Input
          value={projectLink}
          readOnly
          className="bg-muted border-input rounded-r-none"
        />
        <Button
          onClick={handleCopyLink}
          variant="outline"
          className="rounded-l-none border-1-0 border-gray-800"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="mt-4 flex justify-center">
        <Link
          href={projectLink}
          target="_blank"
        >
          <Button 
            variant="outline" 
            className="border-muted text-primary hover:bg-input"
          >  
            <ExternalLink className="mr-2 h-4 w-4" />
            Preview Project
          </Button>
        </Link>
        {onCreateNew && (
          <div className="">
            <Button
              onClick={onCreateNew}
              variant="outline"
              className=" border-gray-700 text-white hover: bg-gray-800"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Another Project
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SuccessStep