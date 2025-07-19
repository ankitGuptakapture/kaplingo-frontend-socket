interface VoicebotLogProps {
  log: string[];
}

export function VoicebotLog({ log }: VoicebotLogProps) {
  return (
    <div className="w-full bg-gray-50 rounded-xl p-4 h-40 overflow-y-auto text-xs text-gray-700 border border-gray-200">
      <div className="mb-2 font-semibold text-gray-500">Voicebot Log</div>
      <ul className="space-y-1">
        {log.map((entry, idx) => (
          <li key={idx} className="break-words">{entry}</li>
        ))}
      </ul>
    </div>
  );
} 