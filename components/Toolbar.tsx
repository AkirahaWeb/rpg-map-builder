import React, { memo } from 'react';
import { AppState, ToolType } from '../types';
import { IconAsset, IconMove, IconPaint, IconPath, IconRiver, IconSculpt, IconSea, IconText } from './Icons';

interface Props {
  activeTool: ToolType;
  onSetTool: (t: ToolType) => void;
}

const Toolbar: React.FC<Props> = memo(({ activeTool, onSetTool }) => {
  const tools: { id: ToolType; icon: React.FC; label: string }[] = [
    { id: 'sculpt', icon: IconSculpt, label: 'Land' },
    { id: 'river', icon: IconRiver, label: 'River' },
    { id: 'sea', icon: IconSea, label: 'Water' },
    { id: 'paint', icon: IconPaint, label: 'Paint' },
    { id: 'path', icon: IconPath, label: 'Path' },
    { id: 'asset', icon: IconAsset, label: 'Asset' },
    { id: 'text', icon: IconText, label: 'Text' },
    { id: 'move', icon: IconMove, label: 'Move' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[500px] z-50">
      <div className="ui-panel px-2 py-3 rounded-2xl flex justify-between items-center shadow-2xl">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide w-full justify-between px-1">
          {tools.map((t) => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSetTool(t.id)}
                className={`
                  flex flex-col items-center justify-center gap-1 w-[56px] h-[56px] rounded-xl flex-shrink-0 transition-all duration-300 relative
                  ${isActive 
                    ? 'bg-blue-600/20 text-blue-400 translate-y-[-4px]' 
                    : 'text-slate-400 hover:bg-white/5 active:scale-95'
                  }
                `}
              >
                <t.icon />
                <span className={`text-[9px] font-bold uppercase tracking-wide transition-colors ${isActive ? 'text-blue-300' : 'text-slate-500'}`}>
                    {t.label}
                </span>
                {isActive && (
                    <div className="absolute bottom-1 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_currentColor]"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default Toolbar;