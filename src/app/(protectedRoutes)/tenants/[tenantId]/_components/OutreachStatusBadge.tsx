import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

type Props = {
  status: string
}

export const OutreachStatusBadge = ({ status }: Props) => {
  switch (status) {
    case 'SENT':
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
          <Check className="w-3 h-3 mr-1" />
          Sent
        </Badge>
      )
    case 'FAILED':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">Failed</Badge>
    case 'SKIPPED':
      return <Badge variant="outline" className="text-xs opacity-50">—</Badge>
    default:
      return <Badge variant="outline" className="text-xs">Pending</Badge>
  }
}
