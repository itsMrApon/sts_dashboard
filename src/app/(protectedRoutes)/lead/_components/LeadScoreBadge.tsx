import { Badge } from '@/components/ui/badge'

type Props = {
  score: string | null
}

export const LeadScoreBadge = ({ score }: Props) => {
  switch (score) {
    case 'HOT':
      return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-xs">🔥 Hot</Badge>
    case 'WARM':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">☀️ Warm</Badge>
    case 'COLD':
      return <Badge variant="outline" className="text-xs">❄️ Cold</Badge>
    default:
      return null
  }
}
