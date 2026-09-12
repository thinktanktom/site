import { Sparkles } from 'lucide-react'

export default function AiNotesNotice() {
  return (
    <div className="flex items-start gap-2.5 border border-border rounded-sm bg-surface/30 px-4 py-3 mb-10">
      <Sparkles size={14} className="text-muted mt-0.5 shrink-0" />
      <p className="font-sans text-xs text-muted leading-relaxed">
        Written up from notes taken during an agentic AI workflow, kept here for future
        reference.
      </p>
    </div>
  )
}
