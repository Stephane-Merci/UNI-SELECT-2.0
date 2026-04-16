import { UnfilledPosition } from '../types';

interface UnfilledPositionCardProps {
    unfilledPosition: UnfilledPosition;
    onDelete?: () => void;
}

export default function UnfilledPositionCard({
    unfilledPosition,
    onDelete
}: UnfilledPositionCardProps) {
    return (
        <div
            data-id={unfilledPosition.id}
            className="rounded-md px-1 py-0.5 border-2 border-black bg-gradient-to-b from-gray-200 to-gray-300 text-[10px] font-black leading-tight w-[110px] max-w-full min-w-0 overflow-hidden group shadow-[0_3px_0_0_rgba(0,0,0,0.85)]"
        >
            <div className="flex items-center justify-between gap-1 text-black">
                <div className="flex items-center gap-1 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate font-black">Poste à combler</span>
                </div>
                {onDelete && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="hidden group-hover:block p-0.5 text-gray-400 hover:text-red-500 rounded"
                        title="Supprimer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
