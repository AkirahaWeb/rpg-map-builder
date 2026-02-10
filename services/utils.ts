import { HSV } from '../types';

export const Utils = {
  hsvToHex(h: number, s: number, v: number): string {
    h /= 360; s /= 100; v /= 100;
    let r = 0, g = 0, b = 0; 
    let i = Math.floor(h * 6); 
    let f = h * 6 - i; 
    let p = v * (1 - s); 
    let q = v * (1 - f * s); 
    let t = v * (1 - (1 - f) * s);
    
    switch (i % 6) { 
      case 0: r = v; g = t; b = p; break; 
      case 1: r = q; g = v; b = p; break; 
      case 2: r = p; g = v; b = t; break; 
      case 3: r = p; g = q; b = v; break; 
      case 4: r = t; g = p; b = v; break; 
      case 5: r = v; g = p; b = q; break; 
    }
    
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  hexToHsv(hex: string): HSV {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;
    
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
  },

  hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // Make a color lighter (higher value/brightness)
  lightenColor(hex: string, amount: number): string {
      const hsv = this.hexToHsv(hex);
      // Increase Value, decrease Saturation slightly for "glow" effect
      hsv.v = Math.min(100, hsv.v + amount);
      hsv.s = Math.max(0, hsv.s - amount / 2);
      return this.hsvToHex(hsv.h, hsv.s, hsv.v);
  }
};

export const StochasticStamp = {
  offCanvas: null as HTMLCanvasElement | null,
  offCtx: null as CanvasRenderingContext2D | null,
  tintCanvas: null as HTMLCanvasElement | null,
  tintCtx: null as CanvasRenderingContext2D | null,
  lastSize: 0,
  lastRoughness: -1,
  lastBlurWidth: -1,

  generate(size: number, roughnessPercent: number, blurWidthPercent: number, roughOverride: number | null = null, blurOverride: number | null = null) {
      if (!this.offCanvas) { 
          this.offCanvas = document.createElement('canvas'); 
          this.offCtx = this.offCanvas.getContext('2d'); 
      }
      
      const finalBlurWidth = blurOverride !== null ? blurOverride : blurWidthPercent;
      const finalRoughness = roughOverride !== null ? roughOverride : roughnessPercent;
      
      // We only skip regeneration if parameters match.
      if (size === this.lastSize && finalRoughness === this.lastRoughness && finalBlurWidth === this.lastBlurWidth) return;
      
      const canvasSize = Math.ceil((size * 1.5 + size) * 2);
      this.offCanvas.width = canvasSize; 
      this.offCanvas.height = canvasSize;
      
      const ctx = this.offCtx!; 
      const center = canvasSize / 2; 
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      
      if (finalRoughness > 0) {
          const roughness = (finalRoughness / 100) * size * 1.5; 
          const points = 40; 
          ctx.beginPath(); 
          let lastR = size;
          for (let i = 0; i <= points; i++) { 
              const angle = (i / points) * Math.PI * 2; 
              if (i % 3 === 0) lastR = size + (Math.random() - 0.5) * roughness; 
              const px = center + Math.cos(angle) * lastR; 
              const py = center + Math.sin(angle) * lastR; 
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); 
          }
          ctx.closePath();
          
          if (finalBlurWidth < 95) { 
              // Create a gradient that covers the shape
              const grad = ctx.createRadialGradient(center, center, 0, center, center, size + roughness/2); 
              grad.addColorStop(0, "rgba(255, 255, 255, 1)"); 
              grad.addColorStop(1, "rgba(255, 255, 255, 0)"); 
              ctx.fillStyle = grad; 
          } else { 
              ctx.fillStyle = "white"; 
          }
          ctx.fill();
      } else {
          // Circle Mode (Roughness 0)
          if (finalBlurWidth < 95) {
              const grad = ctx.createRadialGradient(center, center, 0, center, center, size); 
              grad.addColorStop(0, "rgba(255, 255, 255, 1)"); 
              grad.addColorStop(1, "rgba(255, 255, 255, 0)"); 
              ctx.fillStyle = grad; 
          } else {
              ctx.fillStyle = "white";
          }
          ctx.beginPath(); 
          ctx.arc(center, center, size, 0, Math.PI * 2); 
          ctx.fill();
      }
      
      this.lastSize = size; 
      this.lastRoughness = finalRoughness; 
      this.lastBlurWidth = finalBlurWidth;
  },

  drawStamp(
      ctx: CanvasRenderingContext2D, 
      x: number, 
      y: number, 
      size: number, 
      color: string, 
      opacity: number, 
      globalRoughness: number, 
      globalBlurWidth: number, 
      roughOverride: number | null = null, 
      blurOverride: number | null = null,
      rotation: number | null = null 
  ) {
      this.generate(size, globalRoughness, globalBlurWidth, roughOverride, blurOverride);
      
      if(!this.offCanvas || !this.offCtx) return;

      // Init or resize tint buffer
      if (!this.tintCanvas) {
          this.tintCanvas = document.createElement('canvas');
          this.tintCtx = this.tintCanvas.getContext('2d');
      }
      if (this.tintCanvas.width !== this.offCanvas.width || this.tintCanvas.height !== this.offCanvas.height) {
          this.tintCanvas.width = this.offCanvas.width;
          this.tintCanvas.height = this.offCanvas.height;
      }
      
      const tCtx = this.tintCtx!;
      tCtx.clearRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);

      ctx.save(); 
      ctx.translate(x, y); 
      // Use provided rotation or random if null
      ctx.rotate(rotation !== null ? rotation : Math.random() * Math.PI * 2); 
      ctx.globalAlpha = opacity;
      
      // FIX: Ensure we are in source-over before filling color
      tCtx.globalCompositeOperation = 'source-over';
      tCtx.fillStyle = color; 
      tCtx.fillRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
      
      // Then mask with destination-in
      tCtx.globalCompositeOperation = 'destination-in'; 
      tCtx.drawImage(this.offCanvas, 0, 0);
      
      const half = this.tintCanvas.width / 2; 
      ctx.drawImage(this.tintCanvas, -half, -half); 
      ctx.restore();
  }
};