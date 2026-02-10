import React, { useState } from 'react';
import { IconUpload } from './Icons';

interface Props {
  onCreate: (name: string, w: number, h: number) => void;
  onLoad: (file: File) => void;
}

const HomeScreen: React.FC<Props> = ({ onCreate, onLoad }) => {
  const [name, setName] = useState("My World");
  const [size, setSize] = useState<{w: number, h: number}>({ w: 720, h: 360 });

  return (
    <div className="fixed inset-0 z-[100] bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#0f172a_100%)] flex flex-col items-center justify-center p-6 animate-[fadeIn_0.5s]">
      
      <div className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-300 tracking-tighter uppercase drop-shadow-sm mb-2">World Builder</h1>
          <p className="text-slate-400 text-sm font-light tracking-widest uppercase">Create amazing RPG maps</p>
      </div>

      <div className="ui-panel p-6 rounded-[32px] w-full max-w-sm border border-white/5 backdrop-blur-xl shadow-2xl">
        <div className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-[10px] text-blue-400 font-bold uppercase tracking-wider ml-2">World Name</label>
            <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black/30 text-white p-4 rounded-2xl border border-white/10 focus:outline-none focus:border-blue-500 text-center font-bold text-lg placeholder-white/20"
                placeholder="Ex: Middle Earth"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-2">Map Size</label>
            <div className="grid grid-cols-3 gap-2">
                {[
                    { l: 'Small', w: 512, h: 512 },
                    { l: 'Medium', w: 720, h: 360 },
                    { l: 'Large', w: 1024, h: 1024 }
                ].map((opt) => (
                    <button 
                        key={opt.l}
                        onClick={() => setSize({ w: opt.w, h: opt.h })}
                        className={`py-3 rounded-xl border text-[11px] font-bold transition-all ${
                            size.w === opt.w && size.h === opt.h
                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30' 
                            : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'
                        }`}
                    >
                        {opt.l}
                    </button>
                ))}
            </div>
            {/* Custom Manual Inputs */}
            <div className="flex gap-2 mt-2">
                 <div className="flex-1 bg-black/20 rounded-xl p-2 flex flex-col items-center">
                    <label className="text-[9px] text-gray-500 font-bold uppercase mb-1">Width</label>
                    <input 
                        type="number" 
                        value={size.w} 
                        onChange={(e) => setSize(s => ({ ...s, w: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-transparent text-center text-white font-mono text-sm focus:outline-none"
                    />
                 </div>
                 <div className="flex-1 bg-black/20 rounded-xl p-2 flex flex-col items-center">
                    <label className="text-[9px] text-gray-500 font-bold uppercase mb-1">Height</label>
                    <input 
                        type="number" 
                        value={size.h} 
                        onChange={(e) => setSize(s => ({ ...s, h: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-transparent text-center text-white font-mono text-sm focus:outline-none"
                    />
                 </div>
            </div>
          </div>

          <button 
            onClick={() => onCreate(name, size.w, size.h)}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
          >
            CREATE NEW MAP
          </button>

          <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center"><span className="bg-[#131b2c] px-2 text-[10px] text-gray-500 uppercase font-bold">Or</span></div>
          </div>

           <label className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-white/5">
                <IconUpload />
                <span className="text-xs uppercase tracking-wide">Load .JSON File</span>
                <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files && onLoad(e.target.files[0])} />
           </label>

        </div>
      </div>
      
      <p className="mt-8 text-[10px] text-slate-600 font-mono">v3.0.0 Mobile Edition</p>
    </div>
  );
};

export default HomeScreen;