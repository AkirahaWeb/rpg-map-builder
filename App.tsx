import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, INITIAL_PALETTE, ToolType, PaintMode } from './types';
import { Utils } from './services/utils';
import { MapEngine } from './services/MapEngine';
import HomeScreen from './components/HomeScreen';
import Toolbar from './components/Toolbar';
import SettingsDrawer from './components/SettingsDrawer';
import { IconRedo, IconSave, IconUndo, IconExport } from './components/Icons';

const INITIAL_STATE: AppState = {
  activeTool: 'sculpt',
  paintMode: 'terrain',
  terrainColor: '#edc9af',
  selectedTexture: '#2d5a27', // Legacy Color
  
  // Ocean State
  oceanColor: '#1e3a8a',
  oceanTexture: null,
  oceanTextureLibrary: [],
  
  // Shallow Water
  shallowWaterColor: '#38bdf8',
  isShallowWaterEnabled: true,

  // Texture State
  textureLibrary: [],
  activeTexture: null,
  isTextureEraser: false,

  pathColor: '#ffffff',
  pathSpacing: 2.5, // Default to classic RPG dotted line
  pathStyle: 'dots',

  brushSize: 15,
  brushBlur: 100,
  blurWidth: 50,
  roughness: 40,
  isOrganicRiver: false,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  canvasWidth: 720,
  canvasHeight: 360,
  hsv: { h: 120, s: 70, v: 80 },
  palette: INITIAL_PALETTE,
  textSettings: { size: 15, rotation: 0, curvature: 0, hasOutline: true, color: '#ffffff' },
  
  // Asset State
  assets: [],
  assetMode: 'single',
  assetBrushSettings: { density: 5, sizeVariation: 30, brushRadius: 100, baseScale: 100, placeOnTop: true },
  assetLibrary: [],
  selectedAssetId: null,
  selectedLibraryAssetIndex: null,
  brushSelectedAssetIndices: [],

  labels: [],
  selectedLabelId: null,
};

// Map PaintMode based on ActiveTool
const getPaintMode = (tool: ToolType): PaintMode => {
    switch(tool) {
        case 'sculpt': return 'terrain';
        case 'river': return 'river';
        case 'sea': return 'sea'; // Not strictly painting, but mode helps logic if needed
        case 'paint': return 'texture';
        case 'path': return 'path';
        default: return 'none';
    }
};

const App: React.FC = () => {
  const [isHome, setIsHome] = useState(true);
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [mapName, setMapName] = useState("My World");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  
  // Cursor Visibility State
  const [cursorVisible, setCursorVisible] = useState(false);
  const cursorTimeoutRef = useRef<number | null>(null);

  // Canvas Refs
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const waterCanvasRef = useRef<HTMLCanvasElement>(null);
  const textureCanvasRef = useRef<HTMLCanvasElement>(null); // New Layer
  const pathCanvasRef = useRef<HTMLCanvasElement>(null);
  const assetCanvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Logic Engine Ref (Persistent but non-reactive)
  const engineRef = useRef(new MapEngine());
  
  // Interaction Refs
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const assetBrushDistance = useRef(0);
  const rafRef = useRef<number | null>(null);
  
  // Pinch Zoom Refs
  const activePointers = useRef(new Map<number, {x: number, y: number}>());
  const pinchStartDist = useRef<number>(0);
  const pinchStartZoom = useRef<number>(1);
  const pinchStartOffset = useRef<{x: number, y: number}>({x: 0, y: 0});
  const pinchStartCenter = useRef<{x: number, y: number}>({x: 0, y: 0});

  // History Stacks
  const undoStack = useRef<any[]>([]);
  const redoStack = useRef<any[]>([]);

  // --- Initialization ---

  const handleCreate = useCallback((name: string, w: number, h: number) => {
      setMapName(name);
      setState(s => ({ ...s, canvasWidth: w, canvasHeight: h, offsetX: (window.innerWidth - w)/2, offsetY: (window.innerHeight - h)/2 }));
      setIsHome(false);
      // Wait for DOM
      setTimeout(() => {
          if (mapCanvasRef.current && waterCanvasRef.current && textureCanvasRef.current && pathCanvasRef.current && assetCanvasRef.current && textCanvasRef.current) {
              engineRef.current.init(w, h, mapCanvasRef.current, waterCanvasRef.current, textureCanvasRef.current, pathCanvasRef.current, assetCanvasRef.current, textCanvasRef.current);
          }
      }, 100);
  }, []);

  const handleLoad = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target?.result as string);
            setMapName(data.meta.name);
            setState({
                ...INITIAL_STATE,
                ...data.state,
                activeTool: 'sculpt', // Reset tool
                offsetX: (window.innerWidth - data.meta.width)/2,
                offsetY: (window.innerHeight - data.meta.height)/2
            });
            setIsHome(false);
            setTimeout(() => {
                 if (mapCanvasRef.current && waterCanvasRef.current && textureCanvasRef.current && pathCanvasRef.current && assetCanvasRef.current && textCanvasRef.current) {
                    engineRef.current.init(data.meta.width, data.meta.height, mapCanvasRef.current, waterCanvasRef.current, textureCanvasRef.current, pathCanvasRef.current, assetCanvasRef.current, textCanvasRef.current);
                    
                    // Set texture image before loading mask
                    engineRef.current.setGlobalTexture(data.state.activeTexture).then(() => {
                         engineRef.current.loadSnapshot(data.layers, data.meta.width, data.meta.height);
                    });
                    
                    engineRef.current.drawAssets(data.state.assets, null, 'asset');
                    engineRef.current.drawLabels(data.state.labels, null, 'text');
                 }
            }, 100);
        } catch(err) {
            console.error("Failed to load map", err);
            alert("Error loading map.");
        }
    };
    reader.readAsText(file);
  }, []);

  const saveHistory = useCallback(() => {
    redoStack.current = [];
    const snap = engineRef.current.getSnapshot();
    if (!snap) return;
    undoStack.current.push({
        layers: snap,
        assets: JSON.parse(JSON.stringify(state.assets)),
        labels: JSON.parse(JSON.stringify(state.labels))
    });
    if (undoStack.current.length > 20) undoStack.current.shift();
  }, [state.assets, state.labels]);

  const handleUndo = useCallback(() => {
      if (undoStack.current.length === 0) return;
      // Current state to Redo
      const snap = engineRef.current.getSnapshot();
      if(snap) {
        redoStack.current.push({
            layers: snap,
            assets: JSON.parse(JSON.stringify(state.assets)),
            labels: JSON.parse(JSON.stringify(state.labels))
        });
      }
      
      const prev = undoStack.current.pop();
      applyHistoryState(prev);
  }, [state.assets, state.labels, state.canvasWidth, state.canvasHeight]);

  const handleRedo = useCallback(() => {
      if (redoStack.current.length === 0) return;
      const snap = engineRef.current.getSnapshot();
      if(snap) {
          undoStack.current.push({
              layers: snap,
              assets: JSON.parse(JSON.stringify(state.assets)),
              labels: JSON.parse(JSON.stringify(state.labels))
          });
      }

      const next = redoStack.current.pop();
      applyHistoryState(next);
  }, [state.assets, state.labels, state.canvasWidth, state.canvasHeight]);

  const applyHistoryState = (hist: any) => {
      setState(s => ({ ...s, assets: hist.assets, labels: hist.labels }));
      engineRef.current.loadSnapshot(hist.layers, state.canvasWidth, state.canvasHeight);
      setTimeout(() => {
        engineRef.current.drawAssets(hist.assets, state.selectedAssetId, state.activeTool);
        engineRef.current.drawLabels(hist.labels, state.selectedLabelId, state.activeTool);
      }, 50);
  };

  const handleSaveFile = useCallback(() => {
      const snap = engineRef.current.getSnapshot();
      if(!snap) return;
      const data = {
          meta: { version: 3, width: state.canvasWidth, height: state.canvasHeight, name: mapName },
          state: state,
          layers: snap
      };
      const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }, [state, mapName]);
  
  const handleExportImage = useCallback(() => {
      engineRef.current.exportImage(mapName, state.oceanColor, state.oceanTexture);
  }, [state.oceanColor, state.oceanTexture, mapName]);

  // --- Helpers ---

  const showCursorBriefly = useCallback(() => {
    setCursorVisible(true);
    if (cursorTimeoutRef.current) {
        window.clearTimeout(cursorTimeoutRef.current);
    }
    cursorTimeoutRef.current = window.setTimeout(() => {
        setCursorVisible(false);
    }, 1500); // Hide after 1.5s
  }, []);

  const updateBrushSize = (newSize: number) => {
      setState(s => ({ ...s, brushSize: newSize }));
      showCursorBriefly();
  };

  const updateHsv = (partial: Partial<{h: number, s: number, v: number}>) => {
       setState(s => {
           const newHsv = { ...s.hsv, ...partial };
           const ns = { ...s, hsv: newHsv };
           const hex = Utils.hsvToHex(newHsv.h, newHsv.s, newHsv.v);
           if (s.paintMode === 'texture') ns.selectedTexture = hex;
           if (s.paintMode === 'path') ns.pathColor = hex;
           if (s.activeTool === 'text') {
               ns.textSettings = { ...s.textSettings, color: hex };
               if (s.selectedLabelId) {
                   ns.labels = s.labels.map(l => l.id === s.selectedLabelId ? { ...l, color: hex } : l);
               }
           }
           return ns;
       });
  };

  // --- Asset Brush Logic ---

  const paintAssets = (cx: number, cy: number, distanceTraveled: number) => {
      const { density, brushRadius, sizeVariation, baseScale, placeOnTop } = state.assetBrushSettings;
      const indices = state.brushSelectedAssetIndices;
      
      if (indices.length === 0) return;

      // Threshold to paint: Place one batch every ~20px moved, adjusted by density
      // Higher density = lower threshold
      const threshold = 50 / density;
      
      if (distanceTraveled < threshold) return;
      
      // How many to place in this step?
      const count = Math.ceil(density / 2); 

      const newAssets: any[] = [];
      
      for(let i=0; i<count; i++) {
          // Random index from selection
          const randIdx = indices[Math.floor(Math.random() * indices.length)];
          const src = state.assetLibrary[randIdx];
          
          // Random offset in circle
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * brushRadius; // Uniform distribution
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;

          // Random scale variation
          const base = (baseScale || 100) / 100;
          const varFactor = (Math.random() * 2 - 1) * (sizeVariation / 100); // -0.3 to +0.3
          const scale = base * (1 + varFactor);

          newAssets.push({
               id: Date.now() + i + Math.random(), // slight hack for unique IDs in batch
               src, x, y, 
               rotation: 0, 
               scale: Math.max(0.1, scale), 
               flipX: Math.random() > 0.5, 
               w: 0, h: 0 // Will load later, engine handles this gracefully usually
          });
      }

      // Pre-load images to get dims, then update state
      Promise.all(newAssets.map(async (a) => {
           const img = await engineRef.current.loadAssetImage(a.src);
           return { ...a, w: img.width, h: img.height };
      })).then(loadedAssets => {
           setState(s => ({ 
               ...s, 
               assets: placeOnTop 
                   ? [...s.assets, ...loadedAssets] // Append (Front)
                   : [...loadedAssets, ...s.assets] // Prepend (Back)
            }));
      });
      
      return true; // Painted
  };

  // --- Interaction ---

  const getCanvasPoint = (clientX: number, clientY: number) => {
      if (!mapCanvasRef.current) return { x: 0, y: 0 };
      const rect = mapCanvasRef.current.getBoundingClientRect();
      return {
          x: (clientX - rect.left) / state.zoom,
          y: (clientY - rect.top) / state.zoom
      };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      // Track pointer for multi-touch/pinch
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Handle Pinch Start
      if (state.activeTool === 'move' && activePointers.current.size === 2) {
          const points = Array.from(activePointers.current.values()) as {x: number, y: number}[];
          const p1 = points[0];
          const p2 = points[1];
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;

          pinchStartDist.current = dist;
          pinchStartZoom.current = state.zoom;
          pinchStartOffset.current = { x: state.offsetX, y: state.offsetY };
          pinchStartCenter.current = { x: cx, y: cy };
          
          isPanning.current = false; // Disable single finger pan during pinch
          isDrawing.current = false;
          return;
      }

      // Single Pointer Move/Pan
      if (state.activeTool === 'move' || (!e.isPrimary && e.pointerType === 'touch')) {
          if (activePointers.current.size === 1) {
            isPanning.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };
          }
          return;
      }
      
      // Drawing Logic (Block if multi-touch)
      if (activePointers.current.size > 1) {
          isDrawing.current = false;
          return;
      }

      const p = getCanvasPoint(e.clientX, e.clientY);
      lastPos.current = { x: p.x, y: p.y }; // Store logic coordinate for drawing
      
      // Selection Logic
      if (state.activeTool === 'asset') {
          // If Brush Mode, start painting
          if (state.assetMode === 'brush') {
              saveHistory();
              isDrawing.current = true;
              assetBrushDistance.current = 1000; // Force first paint
              if (paintAssets(p.x, p.y, 1000)) assetBrushDistance.current = 0;
              return;
          }

          // Single Mode Selection
          // Check asset intersection (reverse iterate)
          const found = [...state.assets].reverse().find(a => {
              const halfW = (a.w * a.scale)/2;
              const halfH = (a.h * a.scale)/2;
              return p.x >= a.x - halfW && p.x <= a.x + halfW && p.y >= a.y - halfH && p.y <= a.y + halfH;
          });
          
          if (found) {
              setState(s => ({ ...s, selectedAssetId: found.id, selectedLibraryAssetIndex: null }));
          } else if (state.selectedLibraryAssetIndex !== null) {
              // Place New Asset
              saveHistory();
              const src = state.assetLibrary[state.selectedLibraryAssetIndex];
              engineRef.current.loadAssetImage(src).then(img => {
                  const newAsset = { id: Date.now(), src, x: p.x, y: p.y, rotation: 0, scale: 1.0, flipX: false, w: img.width, h: img.height };
                  setState(s => ({ ...s, assets: [...s.assets, newAsset], selectedAssetId: newAsset.id }));
              });
          } else {
              setState(s => ({ ...s, selectedAssetId: null }));
          }
          return;
      }

      if (state.activeTool === 'text') {
           const found = state.labels.find(l => Math.hypot(l.x - p.x, l.y - p.y) < (l.size * 3));
           setState(s => ({ ...s, selectedLabelId: found ? found.id : null }));
           return;
      }

      // Drawing
      saveHistory();
      isDrawing.current = true;
      if (state.activeTool !== 'text' && state.activeTool !== 'asset') {
          if (state.activeTool === 'path') {
              // For path, we need to reset the remainder when starting a new stroke (optional, but good practice)
              engineRef.current.pathRemainder = 0;
          }
          engineRef.current.applyPaint(p.x, p.y, state);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      // Always track raw pointer positions
      if (activePointers.current.has(e.pointerId)) {
          activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Throttled Logic Loop via RequestAnimationFrame
      if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
              rafRef.current = null;
              processPointerMove(e.clientX, e.clientY);
          });
      }
  };

  const processPointerMove = (clientX: number, clientY: number) => {
      // Pinch Zoom Logic
      if (state.activeTool === 'move' && activePointers.current.size === 2 && pinchStartDist.current > 0) {
           const points = Array.from(activePointers.current.values()) as {x: number, y: number}[];
           const p1 = points[0];
           const p2 = points[1];
           const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
           const cx = (p1.x + p2.x) / 2;
           const cy = (p1.y + p2.y) / 2;
           
           const scale = dist / pinchStartDist.current;
           const newZoom = Math.min(5, Math.max(0.1, pinchStartZoom.current * scale));

           // Calculate new offset to zoom towards center
           const wx = (pinchStartCenter.current.x - pinchStartOffset.current.x) / pinchStartZoom.current;
           const wy = (pinchStartCenter.current.y - pinchStartOffset.current.y) / pinchStartZoom.current;
           
           const newOx = cx - wx * newZoom;
           const newOy = cy - wy * newZoom;

           setState(s => ({ ...s, zoom: newZoom, offsetX: newOx, offsetY: newOy }));
           return;
      }

      if (isPanning.current && activePointers.current.size === 1) {
          const dx = clientX - lastPos.current.x;
          const dy = clientY - lastPos.current.y;
          setState(s => ({ ...s, offsetX: s.offsetX + dx, offsetY: s.offsetY + dy }));
          lastPos.current = { x: clientX, y: clientY };
          return;
      }

      if (isDrawing.current) {
          const p = getCanvasPoint(clientX, clientY);
          const dist = Math.hypot(p.x - lastPos.current.x, p.y - lastPos.current.y);

          if (state.activeTool === 'asset' && state.assetMode === 'brush') {
              assetBrushDistance.current += dist;
              if (paintAssets(p.x, p.y, assetBrushDistance.current)) {
                  assetBrushDistance.current = 0;
              }
          } 
          else if (state.activeTool === 'path') {
              engineRef.current.drawPathSegment(lastPos.current.x, lastPos.current.y, p.x, p.y, state);
          } else if (state.activeTool !== 'asset') {
              engineRef.current.applyPaint(p.x, p.y, state);
          }
          lastPos.current = { x: p.x, y: p.y };
      } 

      // Dragging items
      if (state.activeTool === 'asset' && state.assetMode === 'single' && state.selectedAssetId && (activePointers.current.size === 1)) {
          const p = getCanvasPoint(clientX, clientY);
          const newAssets = state.assets.map(a => a.id === state.selectedAssetId ? { ...a, x: p.x, y: p.y } : a);
          setState(s => ({ ...s, assets: newAssets })); 
      }
      
      if (state.activeTool === 'text' && state.selectedLabelId && (activePointers.current.size === 1)) {
          const p = getCanvasPoint(clientX, clientY);
          setState(s => ({ ...s, labels: s.labels.map(l => l.id === s.selectedLabelId ? { ...l, x: p.x, y: p.y } : l) })); 
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      activePointers.current.delete(e.pointerId);
      
      if (activePointers.current.size < 2) {
          pinchStartDist.current = 0;
          isPanning.current = false;
      }

      if (activePointers.current.size === 0) {
          if (isDrawing.current) {
              // Trigger water update when drawing finishes
              if (state.activeTool === 'sculpt' || state.activeTool === 'river') {
                  engineRef.current.updateShallowWater(state.shallowWaterColor, state.isShallowWaterEnabled);
              }
              if (state.activeTool === 'path') {
                   engineRef.current.pathRemainder = 0;
              }
          }
          isDrawing.current = false;
          isPanning.current = false;
      }
  };

  // Sync Global Texture Change
  useEffect(() => {
     engineRef.current.setGlobalTexture(state.activeTexture);
  }, [state.activeTexture]);

  // Sync Shallow Water Changes
  useEffect(() => {
    // Only update the canvas glow if initialized
    if (engineRef.current) {
        engineRef.current.updateShallowWater(state.shallowWaterColor, state.isShallowWaterEnabled);
    }
  }, [state.shallowWaterColor, state.isShallowWaterEnabled]);

  // Sync Draw calls for Assets/Text when state changes
  useEffect(() => {
      if (engineRef.current && !isHome) {
          engineRef.current.drawAssets(state.assets, state.selectedAssetId, state.activeTool);
      }
  }, [state.assets, state.selectedAssetId, state.activeTool, isHome]);

  useEffect(() => {
      if (engineRef.current && !isHome) {
          engineRef.current.drawLabels(state.labels, state.selectedLabelId, state.activeTool);
      }
  }, [state.labels, state.selectedLabelId, state.activeTool, isHome]);

  // Helper for Setting Tool
  const setTool = useCallback((t: ToolType) => {
      setState(s => {
          if (s.activeTool === t && t !== 'move') {
              setIsDrawerOpen(prev => !prev);
              return s;
          } else {
              // Reset interaction state on tool switch
              setIsDrawerOpen(true);
              return { 
                  ...s, 
                  activeTool: t, 
                  paintMode: getPaintMode(t), 
                  selectedAssetId: null, 
                  selectedLabelId: null,
                  selectedLibraryAssetIndex: null
              };
          }
      });
  }, []);
  
  // Stable update function for Drawer
  const updateState = useCallback((partial: Partial<AppState>) => {
      setState(s => ({ ...s, ...partial }));
  }, []);

  // Stable handlers for Drawer
  const handleAssetUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (re) => {
              const res = re.target?.result as string;
              setState(s => ({ 
                  ...s, 
                  assetLibrary: [...s.assetLibrary, res],
                  selectedLibraryAssetIndex: s.assetLibrary.length // Select new one
              }));
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  }, []);

  const handleAddText = useCallback((txt: string) => {
      const id = Date.now();
      setState(s => {
          const newLabel = {
              id, text: txt, x: s.canvasWidth/2, y: s.canvasHeight/2,
              rotation: s.textSettings.rotation,
              curvature: s.textSettings.curvature,
              size: s.brushSize,
              color: s.textSettings.color,
              hasOutline: s.textSettings.hasOutline
          };
          return { ...s, labels: [...s.labels, newLabel], selectedLabelId: id };
      });
  }, []);

  const handleDeleteAsset = useCallback(() => {
      setState(s => ({ ...s, assets: s.assets.filter(a => a.id !== s.selectedAssetId), selectedAssetId: null }));
  }, []);

  const handleFlipAsset = useCallback(() => {
      setState(s => {
          if(s.selectedAssetId) {
             return { ...s, assets: s.assets.map(a => a.id === s.selectedAssetId ? { ...a, flipX: !a.flipX } : a) };
          }
          return s;
      });
  }, []);

  const handleDeleteLabel = useCallback(() => {
      setState(s => ({ ...s, labels: s.labels.filter(l => l.id !== s.selectedLabelId), selectedLabelId: null }));
  }, []);


  if (isHome) return <HomeScreen onCreate={handleCreate} onLoad={handleLoad} />;

  // Cursor Calculation
  let cursorSize = state.brushSize * 2 * state.zoom;
  if (state.activeTool === 'asset' && state.assetMode === 'brush') {
      cursorSize = state.assetBrushSettings.brushRadius * 2 * state.zoom;
  }
  
  return (
    <div className="relative w-full h-full bg-[#0f172a] overflow-hidden select-none">
      
      {/* CANVAS STACK */}
      <div 
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: state.activeTool === 'move' ? 'grab' : 'crosshair' }}
      >
        <div 
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})` }}
        >
            {/* Water Background Layer (Deep Ocean) */}
            <div 
                className="absolute top-0 left-0 -z-10" 
                style={{ 
                    width: state.canvasWidth, 
                    height: state.canvasHeight, 
                    backgroundColor: state.oceanColor,
                    backgroundImage: state.oceanTexture ? `url(${state.oceanTexture})` : 'none',
                    backgroundRepeat: 'repeat',
                    backgroundSize: 'auto'
                }} 
            />
            
            {/* Shallow Water Layer (Glow) */}
            <canvas ref={waterCanvasRef} className="z-10 absolute top-0 left-0" />

            {/* Solid Land Color */}
            <canvas ref={mapCanvasRef} className="z-20 relative" />

            {/* Texture Layer (Masked on top of Land) */}
            <canvas ref={textureCanvasRef} className="z-20 absolute top-0 left-0" />

            {/* Paths, Assets, Text */}
            <canvas ref={pathCanvasRef} className="z-30 pointer-events-none absolute top-0 left-0" />
            <canvas ref={assetCanvasRef} className="z-40 pointer-events-none !rendering-auto absolute top-0 left-0" style={{ imageRendering: 'auto' }} />
            <canvas ref={textCanvasRef} className="z-50 pointer-events-none !rendering-auto absolute top-0 left-0" style={{ imageRendering: 'auto' }} />
        </div>
      </div>

      {/* VIRTUAL CURSOR */}
      {!['text', 'move'].includes(state.activeTool) && !(state.activeTool === 'asset' && state.assetMode === 'single') && (
           <div 
             className="fixed pointer-events-none z-[100] border border-white/80 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-opacity duration-300"
             style={{
                 width: cursorSize,
                 height: cursorSize,
                 left: '50%', 
                 top: '50%',
                 transform: 'translate(-50%, -50%)',
                 opacity: cursorVisible ? 1 : 0
             }}
           >
              <div className="w-1 h-1 bg-white/80 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
           </div>
      )}

      {/* UI LAYERS */}
      
      {/* Top Right Action Bar (Save/Undo/Redo/Export) */}
      <div className="fixed top-4 right-4 z-50 flex bg-black/60 backdrop-blur-md rounded-full border border-white/10 p-1 shadow-lg">
         <button onClick={handleUndo} className="p-2.5 hover:bg-white/10 rounded-full text-white active:scale-90 transition-transform"><IconUndo /></button>
         <button onClick={handleRedo} className="p-2.5 hover:bg-white/10 rounded-full text-white active:scale-90 transition-transform"><IconRedo /></button>
         <div className="w-px h-6 bg-white/20 self-center mx-1"></div>
         <button onClick={handleExportImage} className="p-2.5 hover:bg-white/10 rounded-full text-blue-400 active:scale-90 transition-transform" title="Export Image"><IconExport /></button>
         <button onClick={handleSaveFile} className="p-2.5 hover:bg-white/10 rounded-full text-green-400 active:scale-90 transition-transform" title="Save Project"><IconSave /></button>
      </div>

      {/* Right Slider - Size Control */}
      {['sculpt', 'river', 'paint', 'path'].includes(state.activeTool) && (
        <div className="fixed right-2 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 group">
             <div className="ui-panel py-4 px-2 rounded-full flex flex-col items-center gap-2">
                 <button className="w-8 h-8 rounded-full bg-white/10 text-white font-bold flex items-center justify-center active:bg-white/20" onClick={() => updateBrushSize(Math.min(250, state.brushSize+1))}>+</button>
                 
                 <div className="relative h-[180px] w-8 flex justify-center">
                    <input 
                        type="range" 
                        min="5" max="250" 
                        value={state.brushSize} 
                        onChange={(e) => updateBrushSize(parseInt(e.target.value))}
                        className="vertical-slider"
                        style={{ writingMode: 'bt-lr' as any, WebkitAppearance: 'slider-vertical' }}
                    />
                    {/* Visual Track */}
                    <div className="slider-track h-full w-1.5 bg-gray-600 rounded-full overflow-hidden absolute pointer-events-none">
                        <div 
                            className="absolute bottom-0 left-0 w-full bg-blue-500 transition-all duration-75"
                            style={{ height: `${(state.brushSize / 250) * 100}%` }}
                        ></div>
                    </div>
                 </div>

                 <button className="w-8 h-8 rounded-full bg-white/10 text-white font-bold flex items-center justify-center active:bg-white/20" onClick={() => updateBrushSize(Math.max(5, state.brushSize-1))}>-</button>
             </div>
             <div className="bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap">
                 Size: {state.brushSize}px
             </div>
        </div>
      )}

      {/* Left Picker - Color Control */}
      {['paint', 'path', 'text'].includes(state.activeTool) && !state.activeTexture && (
          <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
               <div 
                 className="w-12 h-12 rounded-2xl border-2 border-white/50 cursor-pointer shadow-2xl active:scale-95 transition-transform"
                 style={{ backgroundColor: Utils.hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v) }}
                 onClick={() => setColorPopoverOpen(!colorPopoverOpen)}
               />
               
               {colorPopoverOpen && (
                  <div className="absolute left-[60px] top-1/2 -translate-y-1/2 w-[260px] p-4 rounded-2xl ui-panel shadow-2xl animate-[slideRight_0.2s_ease-out]">
                      
                      {/* Palette Section */}
                      <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Palette</span>
                              <button 
                                onClick={() => {
                                    const hex = Utils.hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v);
                                    if(!state.palette.includes(hex)) setState(s => ({ ...s, palette: [...s.palette, hex]}));
                                }}
                                className="bg-white/10 hover:bg-white/20 text-white p-1 rounded-md active:scale-95"
                                title="Save Color"
                              >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              </button>
                          </div>
                          <div className="grid grid-cols-5 gap-2 max-h-[100px] overflow-y-auto scrollbar-hide">
                              {state.palette.map(c => (
                                  <button 
                                    key={c} 
                                    className={`w-8 h-8 rounded-lg border-2 transition-transform ${c === Utils.hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v) ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => {
                                        const hsv = Utils.hexToHsv(c);
                                        updateHsv(hsv);
                                    }}
                                  />
                              ))}
                          </div>
                      </div>

                      <div className="w-full h-px bg-white/10 my-3"></div>

                      {/* Sliders Section */}
                      <div className="space-y-3">
                           {/* Hue */}
                           <div>
                               <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase mb-1">
                                   <span>Hue</span>
                                   <span>{state.hsv.h}°</span>
                               </div>
                               <input type="range" min="0" max="360" value={state.hsv.h} onChange={(e) => {
                                   const v = parseInt(e.target.value);
                                   updateHsv({ h: v });
                               }} className="w-full h-3 rounded-full appearance-none cursor-pointer bg-[linear-gradient(to_right,#f00_0%,#ff0_17%,#0f0_33%,#0ff_50%,#00f_67%,#f0f_83%,#f00_100%)]" />
                           </div>

                           {/* Saturation */}
                           <div>
                               <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase mb-1">
                                   <span>Saturation</span>
                                   <span>{state.hsv.s}%</span>
                               </div>
                               <input type="range" min="0" max="100" value={state.hsv.s} onChange={(e) => {
                                   const v = parseInt(e.target.value);
                                   updateHsv({ s: v });
                               }} className="w-full h-3 rounded-full appearance-none cursor-pointer" 
                                  style={{ background: `linear-gradient(to right, #808080, ${Utils.hsvToHex(state.hsv.h, 100, state.hsv.v)})` }}
                               />
                           </div>

                           {/* Value */}
                           <div>
                               <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase mb-1">
                                   <span>Value</span>
                                   <span>{state.hsv.v}%</span>
                               </div>
                               <input type="range" min="0" max="100" value={state.hsv.v} onChange={(e) => {
                                   const v = parseInt(e.target.value);
                                   updateHsv({ v: v });
                               }} className="w-full h-3 rounded-full appearance-none cursor-pointer" 
                                  style={{ background: `linear-gradient(to right, #000000, ${Utils.hsvToHex(state.hsv.h, state.hsv.s, 100)})` }}
                               />
                           </div>
                      </div>
                  </div>
               )}
          </div>
      )}

      {/* Drawers & Toolbar */}
      <SettingsDrawer 
        state={state} 
        updateState={updateState} 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onAssetUpload={handleAssetUpload}
        onAddText={handleAddText}
        onDeleteAsset={handleDeleteAsset}
        onFlipAsset={handleFlipAsset}
        onDeleteLabel={handleDeleteLabel}
      />

      <Toolbar activeTool={state.activeTool} onSetTool={setTool} />

    </div>
  );
};

export default App;