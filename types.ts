export type ToolType = 'sculpt' | 'river' | 'sea' | 'paint' | 'path' | 'asset' | 'text' | 'move';
export type PaintMode = 'terrain' | 'river' | 'sea' | 'texture' | 'path' | 'none';
export type AssetMode = 'single' | 'brush';

export interface HSV {
  h: number;
  s: number;
  v: number;
}

export interface MapAsset {
  id: number;
  src: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  flipX: boolean;
  w: number;
  h: number;
}

export interface MapLabel {
  id: number;
  text: string;
  x: number;
  y: number;
  rotation: number;
  curvature: number;
  size: number;
  color: string;
  hasOutline: boolean;
}

export interface TextSettings {
  size: number;
  rotation: number;
  curvature: number;
  hasOutline: boolean;
  color: string;
}

export interface AssetBrushSettings {
    density: number; // 1 to 100
    sizeVariation: number; // 0 to 100% variance
    brushRadius: number;
    baseScale: number; // 10 to 300%
    placeOnTop: boolean; // True = append (front), False = prepend (back)
}

export interface AppState {
  activeTool: ToolType;
  paintMode: PaintMode;
  terrainColor: string;
  
  // Ocean State
  oceanColor: string;
  oceanTexture: string | null;
  oceanTextureLibrary: string[];
  
  // Shallow Water State
  shallowWaterColor: string;
  isShallowWaterEnabled: boolean;

  // Texture State
  textureLibrary: string[]; // List of uploaded texture URLs/Base64
  activeTexture: string | null; // Currently active global texture
  isTextureEraser: boolean; // If true, brush hides texture

  selectedTexture: string; // Legacy/Unused for this new system but kept for type safety if needed
  
  pathColor: string;
  pathSpacing: number; // New: Controls dot spacing (0.1 = solid, 2.0 = dotted)
  pathStyle: 'dots' | 'dashed'; // New: Style of path

  brushSize: number;
  brushBlur: number;
  blurWidth: number;
  roughness: number;
  isOrganicRiver: boolean;
  zoom: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
  hsv: HSV;
  palette: string[];
  textSettings: TextSettings;
  
  // Asset State
  assets: MapAsset[];
  assetMode: AssetMode;
  assetBrushSettings: AssetBrushSettings;
  assetLibrary: string[];
  selectedAssetId: number | null; // ID of placed asset on map
  selectedLibraryAssetIndex: number | null; // For Single Mode
  brushSelectedAssetIndices: number[]; // For Brush Mode (Multi-select)

  labels: MapLabel[];
  selectedLabelId: number | null;
}

export const INITIAL_PALETTE = [
  '#2d5a27', '#708090', '#a5f3fc', '#e9c46a', '#5D4037', 
  '#ffffff', '#000000', '#facc15', '#ef4444', '#8b5cf6'
];