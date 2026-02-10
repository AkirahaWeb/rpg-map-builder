import { AppState, MapAsset, MapLabel } from '../types';
import { StochasticStamp, Utils } from './utils';

// Helper to load image async
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Crucial for exporting if images come from external URLs
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img); // Resolve anyway to avoid hanging
    img.src = src;
  });
};

export class MapEngine {
  mapCtx: CanvasRenderingContext2D | null = null;
  waterCtx: CanvasRenderingContext2D | null = null;
  textureLayerCtx: CanvasRenderingContext2D | null = null; // New visible layer
  pathCtx: CanvasRenderingContext2D | null = null;
  assetCtx: CanvasRenderingContext2D | null = null;
  textCtx: CanvasRenderingContext2D | null = null;
  
  // Offscreen for terrain mask (Land Shape)
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;

  // Offscreen for texture painting mask (User painted areas)
  textureMaskCanvas: HTMLCanvasElement;
  textureMaskCtx: CanvasRenderingContext2D;
  
  // Current active texture image
  currentTextureImg: HTMLImageElement | null = null;

  // Path State
  pathRemainder: number = 0; // Tracks sub-pixel distance for smooth interpolation

  // River State
  riverState = { 
    currentWidthFactor: 1.0, 
    targetWidthFactor: 1.0, 
    distToNextChange: 0, 
    traveledSinceChange: 0,
    lastX: 0,
    lastY: 0
  };

  assetCache = new Map<string, HTMLImageElement>();

  constructor() {
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d')!;
    
    this.textureMaskCanvas = document.createElement('canvas');
    this.textureMaskCtx = this.textureMaskCanvas.getContext('2d')!;
  }

  init(
    w: number, h: number,
    mapC: HTMLCanvasElement, 
    waterC: HTMLCanvasElement,
    textureC: HTMLCanvasElement,
    pathC: HTMLCanvasElement, 
    assetC: HTMLCanvasElement, 
    textC: HTMLCanvasElement
  ) {
    this.mapCtx = mapC.getContext('2d');
    this.waterCtx = waterC.getContext('2d');
    this.textureLayerCtx = textureC.getContext('2d');
    this.pathCtx = pathC.getContext('2d');
    this.assetCtx = assetC.getContext('2d');
    this.textCtx = textC.getContext('2d');

    const canvases = [mapC, waterC, textureC, pathC, assetC, textC, this.maskCanvas, this.textureMaskCanvas];
    canvases.forEach(c => { c.width = w; c.height = h; });

    // Initial clear
    this.waterCtx?.clearRect(0,0,w,h);
    this.textureLayerCtx?.clearRect(0,0,w,h);
    this.textureMaskCtx?.clearRect(0,0,w,h);
  }

  resize(w: number, h: number) {
      this.maskCanvas.width = w;
      this.maskCanvas.height = h;
      this.textureMaskCanvas.width = w;
      this.textureMaskCanvas.height = h;
      // Note: Resizing clears canvas content. In a real app we'd copy content, 
      // but here we rely on React re-init or snapshot restore.
  }

  async loadAssetImage(src: string): Promise<HTMLImageElement> {
    if (this.assetCache.has(src)) return this.assetCache.get(src)!;
    const img = await loadImage(src);
    this.assetCache.set(src, img);
    return img;
  }

  async setGlobalTexture(src: string | null) {
      if (!src) {
          this.currentTextureImg = null;
          this.renderTextureLayer();
          return;
      }
      this.currentTextureImg = await this.loadAssetImage(src);
      this.renderTextureLayer();
  }

  // --- Drawing Logic ---

  applyPaint(x: number, y: number, state: AppState) {
    if (!this.mapCtx || !this.maskCtx || !this.textureMaskCtx) return;

    const opacity = state.brushBlur / 100;
    const radius = state.brushSize;
    // Calculate update radius (includes potential roughness expansion)
    const updateRad = radius * 3;

    if (state.paintMode === 'terrain') {
        // Generate a shared rotation for this stamp to ensure mask and visual layer match exactly
        const syncRotation = Math.random() * Math.PI * 2;

        // Sculpting affects land shape
        this.drawToMask(x, y, radius, state, syncRotation);
        StochasticStamp.drawStamp(this.mapCtx, x, y, radius, state.terrainColor, opacity, state.roughness, state.blurWidth, null, 95, syncRotation);
        
        // Re-render texture because land shape changed (clipping)
        this.renderTextureLayer(x, y, updateRad); 

    } else if (state.paintMode === 'river') {
        let fr = radius;
        if (state.isOrganicRiver) {
            const dist = Math.hypot(x - this.riverState.lastX, y - this.riverState.lastY);
            this.riverState.traveledSinceChange += dist;

            if (this.riverState.traveledSinceChange >= this.riverState.distToNextChange) {
                this.riverState.targetWidthFactor = 0.6 + Math.random() * 0.5;
                this.riverState.distToNextChange = 20 + Math.random() * 40;
                this.riverState.traveledSinceChange = 0;
            }
            this.riverState.currentWidthFactor += (this.riverState.targetWidthFactor - this.riverState.currentWidthFactor) * 0.15;
            fr = radius * this.riverState.currentWidthFactor;
        }
        
        const syncRotation = Math.random() * Math.PI * 2;
        this.eraseFromMask(x, y, fr, state, syncRotation);
        
        this.mapCtx.save();
        this.mapCtx.globalCompositeOperation = 'destination-out';
        StochasticStamp.drawStamp(this.mapCtx, x, y, fr, 'black', 1.0, state.roughness, state.blurWidth, null, 100, syncRotation);
        this.mapCtx.restore();

        // Re-render texture because land shape changed (river cuts through)
        this.renderTextureLayer(x, y, fr * 3);

    } else if (state.paintMode === 'texture') {
        if (state.activeTexture) {
            // Painting into the Texture MASK, not the visible canvas
            this.textureMaskCtx.save();
            if (state.isTextureEraser) {
                this.textureMaskCtx.globalCompositeOperation = 'destination-out';
            } else {
                this.textureMaskCtx.globalCompositeOperation = 'source-over';
            }
            // Draw white into mask to reveal, or erase to hide. 
            // Color doesn't matter, alpha matters.
            StochasticStamp.drawStamp(this.textureMaskCtx, x, y, radius, 'white', opacity, state.roughness, state.blurWidth, 0, state.blurWidth);
            this.textureMaskCtx.restore();
            
            // Immediately render the composition (optimized dirty rect)
            this.renderTextureLayer(x, y, updateRad);
        } else {
            // Legacy Solid Color Mode (if no texture active)
            this.mapCtx.save();
            this.mapCtx.globalCompositeOperation = 'source-atop'; // Only paint on existing land
            StochasticStamp.drawStamp(this.mapCtx, x, y, radius, state.selectedTexture, opacity, state.roughness, state.blurWidth, 0, state.blurWidth);
            this.mapCtx.restore();
        }
    }

    this.riverState.lastX = x;
    this.riverState.lastY = y;
  }

  drawPathSegment(x1: number, y1: number, x2: number, y2: number, state: AppState) {
      if (!this.pathCtx) return;
      const ctx = this.pathCtx;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      
      // Calculate dot spacing based on brush size and user setting
      const spacing = Math.max(1, state.brushSize * state.pathSpacing);
      
      if (dist < 0.5) return;

      // Start from where we left off (remainder from previous frame)
      let currentDist = this.pathRemainder;
      
      ctx.fillStyle = state.pathColor;
      ctx.globalAlpha = state.brushBlur / 100;
      
      // Normalized direction vector
      const nx = dx / dist;
      const ny = dy / dist;
      
      // Calculate rotation angle for dashed lines
      const angle = Math.atan2(dy, dx);

      while (currentDist <= dist) {
          const tx = x1 + nx * currentDist;
          const ty = y1 + ny * currentDist;
          
          if (state.pathStyle === 'dashed') {
              ctx.save();
              ctx.translate(tx, ty);
              ctx.rotate(angle);
              // Dash: Length = brushSize, Thickness = brushSize / 2.5
              const length = state.brushSize;
              const thickness = state.brushSize / 2.5;
              ctx.fillRect(-length / 2, -thickness / 2, length, thickness);
              ctx.restore();
          } else {
              // Dots (Default)
              ctx.beginPath();
              ctx.arc(tx, ty, state.brushSize / 2, 0, Math.PI * 2);
              ctx.fill();
          }
          
          currentDist += spacing;
      }

      // Save the remainder for the next segment to ensure even spacing across frames
      this.pathRemainder = currentDist - dist;
  }

  drawToMask(x: number, y: number, radius: number, state: AppState, rotation: number) {
      StochasticStamp.drawStamp(this.maskCtx, x, y, radius, 'black', 1, state.roughness, state.blurWidth, null, 95, rotation);
  }

  eraseFromMask(x: number, y: number, radius: number, state: AppState, rotation: number) {
      this.maskCtx.save();
      this.maskCtx.globalCompositeOperation = 'destination-out';
      StochasticStamp.drawStamp(this.maskCtx, x, y, radius, 'black', 1, state.roughness, state.blurWidth, null, 100, rotation);
      this.maskCtx.restore();
  }

  // --- Renderers ---

  updateShallowWater(shallowColor: string, isEnabled: boolean) {
    if (!this.waterCtx) return;
    const w = this.waterCtx.canvas.width;
    const h = this.waterCtx.canvas.height;
    
    this.waterCtx.clearRect(0, 0, w, h);

    if (!isEnabled) return;

    this.waterCtx.save();
    
    const OFFSET = 20000;
    this.waterCtx.shadowOffsetX = OFFSET;
    this.waterCtx.shadowOffsetY = 0;
    
    // PART 1: Solid Extension (The Shelf)
    this.waterCtx.shadowColor = Utils.hexToRgba(shallowColor, 1.0);
    this.waterCtx.shadowBlur = 35; 
    
    this.waterCtx.drawImage(this.maskCanvas, -OFFSET, 0);
    this.waterCtx.drawImage(this.maskCanvas, -OFFSET, 0);
    this.waterCtx.drawImage(this.maskCanvas, -OFFSET, 0);

    // PART 2: The Fade (Transition to deep ocean)
    // We use the same color but lower opacity for the fade out
    this.waterCtx.shadowColor = Utils.hexToRgba(shallowColor, 0.4); 
    this.waterCtx.shadowBlur = 80; 
    this.waterCtx.drawImage(this.maskCanvas, -OFFSET, 0);
    
    this.waterCtx.restore();
  }

  // Optimized to support dirty-rect updates
  renderTextureLayer(dirtyX?: number, dirtyY?: number, dirtyR?: number) {
      if (!this.textureLayerCtx || !this.currentTextureImg) {
          // If no texture active, clear everything (or dirty rect)
          if (this.textureLayerCtx) {
              if (dirtyX !== undefined && dirtyY !== undefined && dirtyR !== undefined) {
                  const r = dirtyR;
                  const left = Math.floor(dirtyX - r);
                  const top = Math.floor(dirtyY - r);
                  const size = Math.ceil(r * 2);
                  this.textureLayerCtx.clearRect(left, top, size, size);
              } else {
                  this.textureLayerCtx.clearRect(0, 0, this.textureLayerCtx.canvas.width, this.textureLayerCtx.canvas.height);
              }
          }
          return;
      }

      const ctx = this.textureLayerCtx;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      
      let drawX = 0, drawY = 0, drawW = w, drawH = h;
      
      // Calculate dirty rect if provided
      if (dirtyX !== undefined && dirtyY !== undefined && dirtyR !== undefined) {
          const r = dirtyR;
          // Dirty Box
          const left = Math.floor(dirtyX - r);
          const top = Math.floor(dirtyY - r);
          const size = Math.ceil(r * 2);
          
          // Intersection with Canvas Bounds
          const startX = Math.max(0, left);
          const startY = Math.max(0, top);
          const endX = Math.min(w, left + size);
          const endY = Math.min(h, top + size);
          
          if (endX <= startX || endY <= startY) return; // Completely off screen

          drawX = startX;
          drawY = startY;
          drawW = endX - startX;
          drawH = endY - startY;
      }

      ctx.save();
      
      // 1. Clear Area
      ctx.clearRect(drawX, drawY, drawW, drawH);

      // 2. Fill Pattern
      const pattern = ctx.createPattern(this.currentTextureImg, 'repeat');
      if (pattern) {
          ctx.fillStyle = pattern;
          // The pattern matrix is relative to origin (0,0) by default, so we can fill any rect
          // and it will align seamlessly.
          ctx.fillRect(drawX, drawY, drawW, drawH);
      }

      // 3. Apply User Mask (Sliced Draw)
      ctx.globalCompositeOperation = 'destination-in';
      // We must draw the corresponding slice of the mask
      ctx.drawImage(this.textureMaskCanvas, drawX, drawY, drawW, drawH, drawX, drawY, drawW, drawH);

      // 4. Apply Land Mask (Sliced Draw)
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.maskCanvas, drawX, drawY, drawW, drawH, drawX, drawY, drawW, drawH);

      ctx.restore();
  }

  // --- Assets & Labels ---

  // OPTIMIZATION: Removed async/await for cached assets to prevent flicker during drag
  async drawAssets(assets: MapAsset[], selectedId: number | null, activeTool: string) {
      if (!this.assetCtx) return;
      const ctx = this.assetCtx;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (const a of assets) {
          let img = this.assetCache.get(a.src);
          
          // If not in cache, load it (async) then trigger redraw (handled by state update or next loop)
          if (!img) {
             img = await this.loadAssetImage(a.src);
          }

          if (img) {
              ctx.save();
              ctx.translate(a.x, a.y);
              ctx.rotate(a.rotation * Math.PI / 180);
              ctx.scale(a.flipX ? -a.scale : a.scale, a.scale);
              ctx.drawImage(img, -a.w/2, -a.h/2);
    
              if (selectedId === a.id && activeTool === 'asset') {
                const strokeW = 2 / a.scale;
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = strokeW;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(-a.w/2 - 5, -a.h/2 - 5, a.w + 10, a.h + 10);
              }
              ctx.restore();
          }
      }
  }

  drawLabels(labels: MapLabel[], selectedId: number | null, activeTool: string) {
      if (!this.textCtx) return;
      const ctx = this.textCtx;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      labels.forEach(l => {
          ctx.save();
          const fontSize = l.size;
          ctx.font = `bold ${fontSize}px "Trebuchet MS", Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (selectedId === l.id && activeTool === 'text') {
              ctx.save();
              ctx.translate(l.x, l.y);
              ctx.rotate(l.rotation * Math.PI / 180);
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 1;
              const tw = ctx.measureText(l.text).width + 10;
              ctx.strokeRect(-tw/2, -fontSize/2, tw, fontSize);
              ctx.restore();
          }

          if (!l.curvature || l.curvature === 0) {
              ctx.translate(l.x, l.y);
              ctx.rotate(l.rotation * Math.PI / 180);
              if (l.hasOutline) {
                  ctx.strokeStyle = 'black';
                  ctx.lineWidth = fontSize / 4;
                  ctx.lineJoin = 'round';
                  ctx.strokeText(l.text, 0, 0);
              }
              ctx.fillStyle = l.color;
              ctx.fillText(l.text, 0, 0);
          } else {
              const radius = 1000 / (l.curvature / 10);
              ctx.translate(l.x, l.y);
              ctx.rotate(l.rotation * Math.PI / 180);
              ctx.translate(0, radius);

              const characters = l.text.split('');
              const totalWidth = ctx.measureText(l.text).width;
              const anglePerPixel = 1 / radius;
              let currentAngle = -(totalWidth / 2) * anglePerPixel;

              characters.forEach(char => {
                  const charWidth = ctx.measureText(char).width;
                  ctx.save();
                  ctx.rotate(currentAngle + (charWidth / 2) * anglePerPixel);
                  ctx.translate(0, -radius);
                  
                  if (l.hasOutline) {
                      ctx.strokeStyle = 'black';
                      ctx.lineWidth = fontSize / 4;
                      ctx.lineJoin = 'round';
                      ctx.strokeText(char, 0, 0);
                  }
                  ctx.fillStyle = l.color;
                  ctx.fillText(char, 0, 0);
                  ctx.restore();
                  currentAngle += charWidth * anglePerPixel;
              });
          }
          ctx.restore();
      });
  }

  // --- Snapshot / History ---

  getSnapshot() {
      if(!this.mapCtx) return null;
      return {
          map: this.mapCtx.canvas.toDataURL(),
          mask: this.maskCanvas.toDataURL(),
          textureMask: this.textureMaskCanvas.toDataURL(), // Save Texture Mask
          path: this.pathCtx!.canvas.toDataURL(),
      };
  }

  loadSnapshot(snap: {map: string, mask: string, textureMask?: string, path: string}, w: number, h: number) {
      const loadLayer = (src: string, ctx: CanvasRenderingContext2D, cb?: () => void) => {
          const img = new Image();
          img.onload = () => {
              ctx.clearRect(0,0, w, h);
              ctx.drawImage(img,0,0);
              if (cb) cb();
          };
          img.src = src;
      };

      if(this.mapCtx) loadLayer(snap.map, this.mapCtx);
      if(this.pathCtx) loadLayer(snap.path, this.pathCtx);
      
      // Load masks and trigger updates
      loadLayer(snap.mask, this.maskCtx, () => {
          // Note: we can't trigger shallow water here easily without state, 
          // but App.tsx will trigger it via useEffect after load
          this.renderTextureLayer();
      });

      if (snap.textureMask) {
          loadLayer(snap.textureMask, this.textureMaskCtx, () => {
              this.renderTextureLayer();
          });
      } else {
          this.textureMaskCtx.clearRect(0,0,w,h);
      }
  }

  // --- EXPORT FUNCTION ---
  async exportImage(filename: string, oceanColor: string, oceanTextureSrc: string | null) {
      if (!this.mapCtx) return;
      const w = this.mapCtx.canvas.width;
      const h = this.mapCtx.canvas.height;
      
      // Create temporary composite canvas
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Draw Background (Ocean)
      ctx.fillStyle = oceanColor;
      ctx.fillRect(0, 0, w, h);

      if (oceanTextureSrc) {
          const img = await this.loadAssetImage(oceanTextureSrc);
          if (img) {
              const pattern = ctx.createPattern(img, 'repeat');
              if (pattern) {
                  ctx.fillStyle = pattern;
                  ctx.fillRect(0, 0, w, h);
              }
          }
      }

      // 2. Draw Layers in Order
      if (this.waterCtx) ctx.drawImage(this.waterCtx.canvas, 0, 0);
      if (this.mapCtx) ctx.drawImage(this.mapCtx.canvas, 0, 0);
      if (this.textureLayerCtx) ctx.drawImage(this.textureLayerCtx.canvas, 0, 0);
      if (this.pathCtx) ctx.drawImage(this.pathCtx.canvas, 0, 0);
      if (this.assetCtx) ctx.drawImage(this.assetCtx.canvas, 0, 0);
      if (this.textCtx) ctx.drawImage(this.textCtx.canvas, 0, 0);

      // 3. Trigger Download
      const url = offCanvas.toDataURL('image/jpeg', 0.95);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename.replace(/\s+/g, '_')}_export.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  }
}