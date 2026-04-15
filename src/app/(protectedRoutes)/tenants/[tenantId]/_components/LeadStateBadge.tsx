import { Badge } from '@/components/ui/badge'

type Props = {
  state: string
}

export const LeadStateBadge = ({ state }: Props) => {
  switch (state) {
    case 'OUTREACHED':
      return <Badge variant="outline" className="text-xs">Outreached</Badge>
    case 'OPENED':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">Opened</Badge>
    case 'CLICKED_LINK':
      return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-xs">Clicked</Badge>
    case 'JOINED_ROOM':
      return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">Joined Room</Badge>
    case 'CONVERTED':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">Converted</Badge>
    case 'LOST':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">Lost</Badge>
    default:
      return <Badge variant="outline" className="text-xs">{state}</Badge>
  }
}
