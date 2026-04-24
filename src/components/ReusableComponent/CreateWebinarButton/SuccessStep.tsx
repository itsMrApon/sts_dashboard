import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy, ExternalLink, PlusCircle } from 'lucide-react'
import React, { useState } from 'react'

type Props = {
  links: Array<{ label: string; url: string }>
  onCreateNew: () => void
}

const SuccessStep = ({ links, onCreateNew }: Props) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => {setCopiedUrl(null)}, 2000)
  }


  return (
    <div className="relative text-center space-y-6 py-8 px-6">
      <div className="flex items-center justify-center">
        <div className=" bg-green-500 rounded-full p-2">
          <Check className="h-6 w-6 text-primary" />
        </div>
      </div>
      <h2 className="text-2xlfont-bold">Your project is live now </h2>
      <p className="text-foreground">Share one or more links based on your selected options.</p>
      <div className="mt-4 max-w-2xl mx-auto space-y-3">
        {links.map((item) => (
          <div key={item.url} className="space-y-2">
            <p className="text-xs text-muted-foreground text-left">{item.label}</p>
            <div className="flex">
              <Input
                value={item.url}
                readOnly
                className="bg-muted border-input rounded-r-none"
              />
              <Button
                onClick={() => handleCopyLink(item.url)}
                variant="outline"
                className="rounded-l-none border-1-0 border-gray-800"
                aria-label={`Copy ${item.label}`}
              >
                {copiedUrl === item.url ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <a href={item.url} target="_blank" rel="noreferrer">
                <Button
                  variant="outline"
                  className="ml-2 border-muted text-primary hover:bg-input"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
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