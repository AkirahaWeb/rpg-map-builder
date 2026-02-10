import React, { useRef, memo } from 'react';
import { AppState, MapAsset, MapLabel, TextSettings } from '../types';
import { IconUpload, IconSculpt, IconRiver, IconSea, IconPaint, IconPath, IconAsset, IconText, IconMove } from './Icons';

interface Props {
  state: AppState;
  updateState: (partial: Partial<AppState>) => void;
  onAssetUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddText: (text: string) => void;
  onDeleteAsset: () => void;
  onFlipAsset: () => void;
  onDeleteLabel: () => void;
  onClose: () => void;
  isOpen: boolean;
}

const SettingsDrawer: React.FC<Props> = memo(({ 
  state, updateState, onAssetUpload, onAddText, onDeleteAsset, onFlipAsset, onDeleteLabel, onClose, isOpen 
}) => {
  if (!isOpen) return null;

  const activeAsset = state.selectedAssetId ? state.assets.find(a => a.id === state.selectedAssetId) : null;
  const activeLabel = state.selectedLabelId ? state.labels.find(l => l.id === state.selectedLabelId) : null;
  const textInputRef = useRef<HTMLInputElement>(null);

  const updateAsset = (update: Partial<MapAsset>) => {
      if(!state.selectedAssetId) return;
      const newAssets = state.assets.map(a => a.id === state.selectedAssetId ? { ...a, ...update } : a);
      updateState({ assets: newAssets });
  };

  const updateLabel = (update: Partial<MapLabel>) => {
      if(!state.selectedLabelId) return;
      const newLabels = state.labels.map(l => l.id === state.selectedLabelId ? { ...l, ...update } : l);
      updateState({ labels: newLabels });
  };

  const updateTextSettings = (update: Partial<TextSettings>) => {
      updateState({ textSettings: { ...state.textSettings, ...update } });
      if (activeLabel) updateLabel(update);
  };

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (re) => {
              const res = re.target?.result as string;
              updateState({ 
                  textureLibrary: [...state.textureLibrary, res],
                  activeTexture: res, 
                  isTextureEraser: false
              });
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  const handleOceanTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (re) => {
              const res = re.target?.result as string;
              updateState({ 
                  oceanTextureLibrary: [...state.oceanTextureLibrary, res],
                  oceanTexture: res 
              });
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  const handleAssetLibraryClick = (idx: number) => {
      if (state.assetMode === 'single') {
          updateState({ 
              selectedLibraryAssetIndex: state.selectedLibraryAssetIndex === idx ? null : idx,
              selectedAssetId: null 
          });
      } else {
          const current = state.brushSelectedAssetIndices;
          if (current.includes(idx)) {
              updateState({ brushSelectedAssetIndices: current.filter(i => i !== idx) });
          } else {
              updateState({ brushSelectedAssetIndices: [...current, idx] });
          }
      }
  };

  const getToolIcon = () => {
      switch(state.activeTool) {
          case 'sculpt': return <IconSculpt />;
          case 'river': return <IconRiver />;
          case 'sea': return <IconSea />;
          case 'paint': return <IconPaint />;
          case 'path': return <IconPath />;
          case 'asset': return <IconAsset />;
          case 'text': return <IconText />;
          case 'move': return <IconMove />;
          default: return null;
      }
  };

  return (
    <div className="fixed bottom-[100px] left-1/2 -translate-x-1/2 w-[95%] max-w-[500px] z-40 animate-[slideUp_0.3s_ease-out]">
      <div className="ui-panel p-5 rounded-2xl relative flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
             <div className="flex items-center gap-2 text-blue-400">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                    {getToolIcon()}
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">
                    {state.activeTool === 'sculpt' ? 'Terrain Settings' :
                    state.activeTool === 'river' ? 'River Settings' :
                    state.activeTool === 'sea' ? 'Ocean Settings' :
                    state.activeTool === 'paint' ? 'Paint Settings' :
                    state.activeTool === 'path' ? 'Path Settings' :
                    state.activeTool === 'asset' ? 'Asset Settings' :
                    state.activeTool === 'text' ? 'Text Settings' : 'Move Settings'}
                </span>
             </div>
             
             <div className="flex gap-4 items-center">
               {state.activeTool === 'river' && (
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Organic</span>
                    <Toggle checked={state.isOrganicRiver} onChange={(c) => updateState({ isOrganicRiver: c })} />
                 </div>
               )}
                <button 
                  onClick={onClose}
                  className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
             </div>
        </div>

        {/* SEA TOOL CONTROLS */}
        {state.activeTool === 'sea' && (
            <div className="flex flex-col gap-3">
                <div className="bg-black/20 p-3 rounded-xl space-y-3">
                    <label className="text-[10px] text-gray-400 font-bold uppercase block">Ocean Background</label>
                    <div className="flex gap-3 h-14">
                        <label className="w-14 h-14 bg-white/5 text-cyan-400 border border-dashed border-white/20 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 transition-transform">
                            <IconUpload />
                            <input type="file" accept="image/*" className="hidden" onChange={handleOceanTextureUpload} />
                        </label>

                         <div 
                             onClick={() => updateState({ oceanTexture: null })}
                             className={`
                                w-14 h-14 flex-shrink-0 rounded-xl border-2 flex items-center justify-center active:scale-95 transition-transform
                                ${state.oceanTexture === null ? 'border-cyan-500 bg-cyan-500/10' : 'border-transparent bg-white/5'}
                             `}
                        >
                            <div className="w-6 h-6 rounded-full shadow-lg" style={{ backgroundColor: state.oceanColor }}></div>
                        </div>

                         {state.oceanTextureLibrary.length > 0 && (
                             <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center pl-2 border-l border-white/10">
                                {state.oceanTextureLibrary.map((src, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => updateState({ oceanTexture: src })}
                                        className={`
                                            w-14 h-14 bg-black rounded-xl flex-shrink-0 overflow-hidden border-2 active:scale-95 transition-transform
                                            ${state.oceanTexture === src ? 'border-cyan-500' : 'border-transparent'}
                                        `}
                                    >
                                        <img src={src} className="w-full h-full object-cover pointer-events-none" />
                                    </div>
                                ))}
                             </div>
                         )}
                    </div>
                </div>
                
                <div className="bg-black/20 p-3 rounded-xl space-y-3">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Shallow Water Effect</span>
                        <Toggle checked={state.isShallowWaterEnabled} onChange={(c) => updateState({ isShallowWaterEnabled: c })} />
                     </div>
                     {state.isShallowWaterEnabled && (
                         <div className="flex items-center gap-2">
                             <span className="text-[9px] text-gray-500 font-bold uppercase">Glow Color</span>
                             <input 
                                type="color" 
                                value={state.shallowWaterColor} 
                                onChange={(e) => updateState({ shallowWaterColor: e.target.value })}
                                className="flex-1 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                             />
                        </div>
                     )}
                </div>
            </div>
        )}

        {/* PAINT / TEXTURE CONTROLS */}
        {state.activeTool === 'paint' && (
            <div className="flex flex-col gap-3">
                <div className="bg-black/20 p-3 rounded-xl space-y-3">
                    <label className="text-[10px] text-gray-400 font-bold uppercase block">Ground Texture</label>
                    <div className="flex gap-3 h-14">
                        <label className="w-14 h-14 bg-white/5 text-blue-400 border border-dashed border-white/20 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 transition-transform">
                            <IconUpload />
                            <input type="file" accept="image/*" className="hidden" onChange={handleTextureUpload} />
                        </label>
                        
                        <div 
                             onClick={() => updateState({ activeTexture: null })}
                             className={`
                                w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-xl border-2 active:scale-95 transition-transform
                                ${state.activeTexture === null ? 'border-blue-500 bg-blue-500/10' : 'border-transparent bg-white/5'}
                             `}
                        >
                            <span className="text-[9px] font-bold text-gray-300 uppercase text-center leading-3">Solid<br/>Color</span>
                        </div>

                        <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center">
                            {state.textureLibrary.map((src, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => updateState({ activeTexture: src, isTextureEraser: false })}
                                    className={`
                                        w-14 h-14 bg-black border-2 rounded-xl flex-shrink-0 overflow-hidden active:scale-95 transition-transform
                                        ${state.activeTexture === src ? 'border-blue-500' : 'border-transparent'}
                                    `}
                                >
                                    <img src={src} className="w-full h-full object-cover pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {state.activeTexture && (
                    <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
                         <span className="text-[10px] font-bold text-red-300 uppercase">Texture Eraser</span>
                         <Toggle checked={state.isTextureEraser} onChange={(c) => updateState({ isTextureEraser: c })} />
                    </div>
                )}
            </div>
        )}

        {/* BRUSH CONTROLS (Common) */}
        {(['sculpt', 'river', 'paint', 'path'].includes(state.activeTool)) && (
            <div className="space-y-4">
                {['sculpt', 'river'].includes(state.activeTool) && (
                    <RangeControl 
                        label="Edge Roughness" 
                        value={state.roughness} 
                        onChange={(v) => updateState({ roughness: v })} 
                        display={`${state.roughness}%`} 
                    />
                )}
                
                {/* Path Specific: Spacing and Style */}
                {state.activeTool === 'path' && (
                    <div className="space-y-4">
                        <div className="flex bg-black/40 rounded-xl p-1">
                             <button 
                                onClick={() => updateState({ pathStyle: 'dots' })}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${state.pathStyle === 'dots' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                             >
                                Dotted
                             </button>
                             <button 
                                onClick={() => updateState({ pathStyle: 'dashed' })}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${state.pathStyle === 'dashed' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                             >
                                Dashed
                             </button>
                        </div>

                        <RangeControl 
                            label="Path Spacing" 
                            value={state.pathSpacing * 10} 
                            onChange={(v) => updateState({ pathSpacing: v / 10 })} 
                            display={`${state.pathSpacing}x`} 
                            min={1} max={50}
                        />
                    </div>
                )}
                
                <RangeControl 
                    label="Brush Opacity" 
                    value={state.brushBlur} 
                    onChange={(v) => updateState({ brushBlur: v })} 
                    display={`${state.brushBlur}%`} 
                />
                
                {state.activeTool === 'paint' && (
                    <RangeControl 
                        label="Softness (Blur)" 
                        value={state.blurWidth} 
                        onChange={(v) => updateState({ blurWidth: v })} 
                        display={`${state.blurWidth}%`} 
                        min={1}
                    />
                )}
            </div>
        )}

        {/* ASSET CONTROLS */}
        {state.activeTool === 'asset' && (
            <div className="flex flex-col gap-4">
                <div className="flex bg-black/40 rounded-xl p-1">
                    <button 
                        onClick={() => updateState({ assetMode: 'single' })}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${state.assetMode === 'single' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        Single
                    </button>
                    <button 
                        onClick={() => updateState({ assetMode: 'brush' })}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${state.assetMode === 'brush' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        Brush
                    </button>
                </div>

                <div className="bg-black/20 p-3 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] text-gray-400 font-bold uppercase">Library</label>
                        {state.assetMode === 'brush' && (
                            <span className="text-[9px] text-blue-400 italic">Multi-select</span>
                        )}
                    </div>
                    
                    <div className="flex gap-3 h-16">
                        <label className="w-16 h-16 bg-white/5 text-blue-400 border border-dashed border-white/20 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 transition-transform">
                            <IconUpload />
                            <input type="file" accept="image/png" className="hidden" onChange={onAssetUpload} />
                        </label>
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center">
                            {state.assetLibrary.map((src, idx) => {
                                const isSelected = state.assetMode === 'single' 
                                    ? state.selectedLibraryAssetIndex === idx 
                                    : state.brushSelectedAssetIndices.includes(idx);
                                
                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => handleAssetLibraryClick(idx)}
                                        className={`
                                            w-16 h-16 bg-white/5 border-2 rounded-xl flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden relative active:scale-95 transition-transform
                                            ${isSelected ? 'border-green-500 bg-green-500/10' : 'border-transparent'}
                                        `}
                                    >
                                        <img src={src} className="max-w-[80%] max-h-[80%] object-contain pointer-events-none" />
                                        {state.assetMode === 'brush' && isSelected && (
                                            <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-bl-lg"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {state.assetMode === 'single' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                             <RangeControl 
                                label="Rotation"
                                value={activeAsset ? activeAsset.rotation : 0}
                                min={-180} max={180}
                                onChange={(v) => updateAsset({ rotation: v })}
                                display={`${activeAsset ? activeAsset.rotation : 0}°`}
                             />
                             <RangeControl 
                                label="Scale"
                                value={activeAsset ? activeAsset.scale * 100 : 100}
                                min={10} max={300}
                                onChange={(v) => updateAsset({ scale: v/100 })}
                                display={`${activeAsset ? Math.round(activeAsset.scale * 100) : 100}%`}
                             />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onFlipAsset} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold text-[10px] uppercase hover:bg-white/20">Flip</button>
                            <button onClick={onDeleteAsset} className="flex-1 bg-red-500/20 text-red-300 py-3 rounded-xl font-bold text-[10px] uppercase hover:bg-red-500/30">Delete</button>
                        </div>
                    </div>
                )}

                {state.assetMode === 'brush' && (
                    <div className="space-y-4">
                        <RangeControl 
                             label="Brush Radius"
                             value={state.assetBrushSettings.brushRadius}
                             min={20} max={300}
                             onChange={(v) => updateState({ assetBrushSettings: { ...state.assetBrushSettings, brushRadius: v } })}
                             display={`${state.assetBrushSettings.brushRadius}px`}
                        />
                         <RangeControl 
                             label="Asset Scale"
                             value={state.assetBrushSettings.baseScale}
                             min={10} max={300}
                             onChange={(v) => updateState({ assetBrushSettings: { ...state.assetBrushSettings, baseScale: v } })}
                             display={`${state.assetBrushSettings.baseScale}%`}
                        />
                        <RangeControl 
                             label="Density"
                             value={state.assetBrushSettings.density}
                             min={1} max={10}
                             onChange={(v) => updateState({ assetBrushSettings: { ...state.assetBrushSettings, density: v } })}
                             display={`${state.assetBrushSettings.density}`}
                        />
                        <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl">
                             <span className="text-[10px] font-bold text-gray-400 uppercase">Render on Top</span>
                             <Toggle 
                                checked={state.assetBrushSettings.placeOnTop} 
                                onChange={(c) => updateState({ assetBrushSettings: { ...state.assetBrushSettings, placeOnTop: c } })} 
                             />
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* TEXT CONTROLS */}
        {state.activeTool === 'text' && (
            <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <input 
                        ref={textInputRef}
                        type="text" 
                        placeholder={activeLabel ? activeLabel.text : "City Name..."} 
                        defaultValue={activeLabel ? activeLabel.text : ""}
                        onChange={(e) => { if(activeLabel) updateLabel({ text: e.target.value }) }}
                        className="flex-1 bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:outline-none text-sm focus:border-blue-500"
                    />
                    {!activeLabel && (
                        <button 
                            onClick={() => {
                                if (textInputRef.current?.value) {
                                    onAddText(textInputRef.current.value);
                                    textInputRef.current.value = "";
                                }
                            }}
                            className="bg-blue-600 active:bg-blue-700 text-white px-5 rounded-xl font-bold text-xs"
                        >
                            ADD
                        </button>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <RangeControl 
                        label="Rotation"
                        value={activeLabel ? activeLabel.rotation : state.textSettings.rotation}
                        min={-180} max={180}
                        onChange={(v) => updateTextSettings({ rotation: v })}
                        display={`${activeLabel ? activeLabel.rotation : state.textSettings.rotation}°`}
                     />
                     <RangeControl 
                        label="Curvature"
                        value={activeLabel ? activeLabel.curvature : state.textSettings.curvature}
                        min={-100} max={100}
                        onChange={(v) => updateTextSettings({ curvature: v })}
                        display={`${activeLabel ? activeLabel.curvature : state.textSettings.curvature}`}
                     />
                </div>
                 <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Black Outline</span>
                        <Toggle 
                            checked={activeLabel ? activeLabel.hasOutline : state.textSettings.hasOutline} 
                            onChange={(c) => updateTextSettings({ hasOutline: c })} 
                        />
                    </div>
                    {activeLabel && (
                        <button onClick={onDeleteLabel} className="text-red-300 text-[10px] font-bold uppercase bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg">Delete</button>
                    )}
                 </div>
            </div>
        )}
      </div>
    </div>
  );
});

// UI Components
const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (c: boolean) => void }) => (
    <label className="relative inline-block w-[44px] h-[24px]">
        <input type="checkbox" className="opacity-0 w-0 h-0 peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="absolute cursor-pointer inset-0 bg-slate-700 transition-[.3s] rounded-full peer-checked:bg-blue-500"></span>
        <span className="absolute top-[2px] left-[2px] h-[20px] w-[20px] bg-white rounded-full transition-[.3s] peer-checked:translate-x-[20px] shadow-sm"></span>
    </label>
);

const RangeControl = ({ label, value, onChange, min = 0, max = 100, display }: any) => (
    <div className="w-full">
        <div className="flex justify-between mb-2">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</label>
            <span className="text-[10px] text-blue-400 font-mono font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">{display}</span>
        </div>
        <input 
            type="range" 
            min={min} max={max} 
            value={value} 
            onChange={(e) => onChange(parseInt(e.target.value))} 
            className="w-full h-2 rounded-lg bg-white/10 accent-blue-500"
        />
    </div>
);

export default SettingsDrawer;