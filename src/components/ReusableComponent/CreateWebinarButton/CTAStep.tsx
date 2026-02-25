import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem,  
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useStsStore } from '@/store/useStsStore';
import { X, Search } from 'lucide-react';
import React, { useState } from 'react'
import { CtaTypeEnum } from '@prisma/client'
import Stripe from 'stripe';
import { Assistant } from '@vapi-ai/server-sdk/api'

type Props = {
  stripeProducts: Stripe.Product[] | []
  assistants: Assistant[] | []
}

const CTAStep = ({stripeProducts, assistants}: Props) => {

  const {
    formData, updateCTAField, addTag, removeTag, getStepValidationErrors,
  } = useStsStore();

  const [tagInput, setTagInput] = useState('')

  const { ctaLabel, tags, aiAgent, priceld, ctaType } = formData.cta

  const errors = getStepValidationErrors('cta')

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      addTag(tagInput.trim())
      setTagInput('')
    }
  }

  const handleSelectCTAType = (value: string) => {
    updateCTAField('ctaType', value as CtaTypeEnum)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateCTAField(name as keyof typeof formData.cta, value)
  }

  const handleProductChange = (value: string) => {
    updateCTAField('priceld', value)
  }
  const handleAgentChange = (value: string) => {
    updateCTAField('aiAgent', value)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label
          htmlFor="ctaLabel"
          className={errors.ctaLabel ? 'text-red-400' : ''}
        >
          CTA Label <span className="text-red-400">*</span>
        </Label>
        <Input
          id="ctaLabel"
          name="ctaLabel"
          value={ctaLabel || ''}
          onChange={handleChange}
          placeholder="Let's get started!"
          className={cn(
            '!bg-background/50 border border-input',
            errors.ctaLabel && 'border-red-400 focus-visible:ring-red-400'
          )}
        />
        {errors.ctaLabel && <p className="text-sm text-red-400">{errors.ctaLabel}</p>}
      </div>
      <div className="space-y-6">
        <Label htmlFor="tags">Tags</Label>
        <input  
          id="tags"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder="Enter tags and press Enter"
          className='!bg-background/50 border border-input'
        />

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag: string, index: number) => (
              <div
                key={index} 
                className="flex items-center gap-1 bg-gray-800 text-white px-3 py-1 rounded-md"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className='h-3 w-3'/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2 w-full">
        <Label>CTA Type</Label>
        <Tabs
          defaultValue={CtaTypeEnum.BOOK_A_CALL}
          className="w-full"
        >
          <TabsList className="w-full bg-transparent">
            <TabsTrigger 
              value={CtaTypeEnum.BOOK_A_CALL}
              className="w-1/2 data-[state=active]:!bg-background/50"
              onClick={()=>handleSelectCTAType(CtaTypeEnum.BOOK_A_CALL)}
            >
              Book a Call
            </TabsTrigger>
            <TabsTrigger 
              value={CtaTypeEnum.BUY_NOW}
              className="w-1/2"
              onClick={()=>handleSelectCTAType(CtaTypeEnum.BUY_NOW)}
            >
              Order Now
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {ctaType === CtaTypeEnum.BOOK_A_CALL && (
        <div className="space-y-2">
          <Label>Attach an AI Agent</Label>
          <div className="relative">
            <div className="md-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500"/>
                <Input
                  placeholder="Search agents"
                  className="pl-9 !bg-background/50 border border-input"
                />
              </div>
            </div>
            <Select
              value={aiAgent || undefined}
              onValueChange={handleAgentChange}
            >
              <SelectTrigger className="w-full !bg-background/50 border border-input">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-input max-h-48">
                {assistants?.length > 0 ? (
                  assistants.map((assistant) => (
                    <SelectItem 
                      key={assistant.id} 
                      value={assistant.id}
                      className="!bg-background/50 hover:!bg-white/10"
                    >
                      {assistant.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-agents" disabled>
                    No agents found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {ctaType === CtaTypeEnum.BUY_NOW && (
      <div className="space-y-2">
        <Label>Stripe Products</Label>
        <div className="relative">
          <div className="mb-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500"/>
              <Input
                placeholder="Search products"
                className="pl-9 !bg-background/50 border border-input"
              />
            </div>
          </div>
          <Select
            value={priceld || undefined}
            onValueChange={handleProductChange}
          >
            <SelectTrigger className="w-full !bg-background/50 border border-input">
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent className="bg-background border border-input max-h-48">
              {stripeProducts?.length > 0 ? (
                stripeProducts.map((product) => (
                  <SelectItem 
                    key={product.id} 
                    value={product?.default_price?.toString() || ''}
                    className="!bg-background/50 hover:!bg-white/10"
                  >
                    {product.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem 
                  value="no-products" 
                  disabled
                >
                  Create a new product
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      )}
    </div>
  )
}

export default CTAStep