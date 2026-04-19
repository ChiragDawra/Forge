import { Cpu } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { modelColor, modelLabel } from '@renderer/lib/format'
import type { ModelName } from '@renderer/lib/constants'

interface ModelBadgeProps {
  modelId: ModelName
  showIcon?: boolean
  className?: string
}

export default function ModelBadge({
  modelId,
  showIcon = true,
  className
}: ModelBadgeProps): React.JSX.Element {
  const c = modelColor(modelId)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        c.bg,
        c.text,
        c.border,
        className
      )}
      title={modelId}
    >
      {showIcon && <Cpu className="h-2.5 w-2.5" />}
      {modelLabel(modelId)}
    </span>
  )
}
