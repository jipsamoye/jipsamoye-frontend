'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Modal from '@/components/common/Modal';

interface CoverImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
  initialImage?: string | null;
}

const ASPECT_RATIO = 4;
const MIN_CROP_WIDTH = 80;
const HANDLE_SIZE = 10;

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

export default function CoverImageEditor({ isOpen, onClose, onSave, saving, initialImage }: CoverImageEditorProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [contW, setContW] = useState(0);
  const [contH, setContH] = useState(0);
  const [scale, setScale] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, cx: 0, cy: 0, cw: 0, ch: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialImage && isOpen) setImageSrc(initialImage);
  }, [initialImage, isOpen]);

  const initImage = useCallback((img: HTMLImageElement) => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) { setTimeout(() => initImage(img), 50); return; }
    const h = img.height * (w / img.width);
    setContW(w);
    setContH(h);
    setScale(1);

    const cropW = w;
    const cropH = cropW / ASPECT_RATIO;
    setCrop({ x: 0, y: Math.max(0, (h - cropH) / 2), w: cropW, h: cropH });
  }, []);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      requestAnimationFrame(() => initImage(img));
    };
    img.src = imageSrc;
  }, [imageSrc, initImage]);

  // scale 바뀌면 크롭 clamp
  useEffect(() => {
    if (!contW) return;
    setCrop(prev => clampCrop(prev));
  }, [scale, contW, contH]);

  function clampCrop(c: { x: number; y: number; w: number; h: number }) {
    let { x, y, w, h } = c;
    w = Math.max(MIN_CROP_WIDTH, Math.min(w, contW));
    h = w / ASPECT_RATIO;
    if (h > contH) { h = contH; w = h * ASPECT_RATIO; }
    x = Math.max(0, Math.min(x, contW - w));
    y = Math.max(0, Math.min(y, contH - h));
    return { x, y, w, h };
  }

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = getPointerPos(e);
    setDragMode(mode);
    setDragStart({ mx: pos.x, my: pos.y, cx: crop.x, cy: crop.y, cw: crop.w, ch: crop.h });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragMode) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    const dx = pos.x - dragStart.mx;
    const dy = pos.y - dragStart.my;

    if (dragMode === 'move') {
      setCrop(clampCrop({ x: dragStart.cx + dx, y: dragStart.cy + dy, w: dragStart.cw, h: dragStart.ch }));
    } else if (dragMode === 'se') {
      const nw = Math.max(MIN_CROP_WIDTH, dragStart.cw + dx);
      setCrop(clampCrop({ x: dragStart.cx, y: dragStart.cy, w: nw, h: nw / ASPECT_RATIO }));
    } else if (dragMode === 'sw') {
      const nw = Math.max(MIN_CROP_WIDTH, dragStart.cw - dx);
      setCrop(clampCrop({ x: dragStart.cx + (dragStart.cw - nw), y: dragStart.cy, w: nw, h: nw / ASPECT_RATIO }));
    } else if (dragMode === 'ne') {
      const nw = Math.max(MIN_CROP_WIDTH, dragStart.cw + dx);
      const nh = nw / ASPECT_RATIO;
      setCrop(clampCrop({ x: dragStart.cx, y: dragStart.cy + (dragStart.ch - nh), w: nw, h: nh }));
    } else if (dragMode === 'nw') {
      const nw = Math.max(MIN_CROP_WIDTH, dragStart.cw - dx);
      const nh = nw / ASPECT_RATIO;
      setCrop(clampCrop({ x: dragStart.cx + (dragStart.cw - nw), y: dragStart.cy + (dragStart.ch - nh), w: nw, h: nh }));
    }
  };

  const handlePointerUp = () => setDragMode(null);

  const handleSave = () => {
    if (!imageEl || !contW) return;
    const baseScale = contW / imageEl.width;

    // 크롭 좌표(컨테이너 기준) → 원본 이미지 좌표
    // 줌 시 이미지가 transform:scale로 확대 → 중앙 기준으로 확대됨
    // 컨테이너의 (x, y) 좌표가 원본 이미지의 어디에 해당하는지 계산
    const visibleW = contW / scale;
    const visibleH = contH / scale;
    const offsetX = (contW - visibleW) / 2;
    const offsetY = (contH - visibleH) / 2;

    const sx = (offsetX + crop.x) / (baseScale * scale);
    const sy = (offsetY + crop.y) / (baseScale * scale);
    const sw = crop.w / (baseScale * scale);
    const sh = crop.h / (baseScale * scale);

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imageEl, sx, sy, sw, sh, 0, 0, 1200, 300);
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, 'image/webp', 0.8);
  };

  const handleClose = () => {
    setImageSrc(null);
    setImageEl(null);
    setScale(1);
    setContH(0);
    setContW(0);
    setCrop({ x: 0, y: 0, w: 0, h: 0 });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="커버 이미지 수정">
      <div className="flex flex-col gap-4">
        {!imageSrc ? (
          <div className="aspect-[4/3] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 transition-colors">
            <div className="text-3xl mb-2">+</div>
            <p className="text-sm text-gray-500">이미지를 선택해주세요</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="relative select-none rounded-xl overflow-hidden"
            style={{ height: contH || 'auto' }}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            {/* 이미지: CSS transform으로 확대, 컨테이너 고정 */}
            <img
              src={imageSrc}
              alt="편집 중"
              className="w-full h-full absolute top-0 left-0"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
              draggable={false}
            />

            {/* 어두운 오버레이 */}
            <div className="absolute left-0 right-0 top-0 bg-black/50 pointer-events-none" style={{ height: crop.y }} />
            <div className="absolute left-0 right-0 bg-black/50 pointer-events-none" style={{ top: crop.y + crop.h, bottom: 0 }} />
            <div className="absolute bg-black/50 pointer-events-none" style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }} />
            <div className="absolute bg-black/50 pointer-events-none" style={{ top: crop.y, height: crop.h, left: crop.x + crop.w, right: 0 }} />

            {/* 크롭 영역 */}
            <div
              className="absolute border-2 border-dashed border-white cursor-move"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
              onMouseDown={(e) => handlePointerDown(e, 'move')}
              onTouchStart={(e) => handlePointerDown(e, 'move')}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <div
                  key={corner}
                  className="absolute bg-white border border-gray-400"
                  style={{
                    width: HANDLE_SIZE, height: HANDLE_SIZE,
                    ...(corner.includes('n') ? { top: -HANDLE_SIZE / 2 } : { bottom: -HANDLE_SIZE / 2 }),
                    ...(corner.includes('w') ? { left: -HANDLE_SIZE / 2 } : { right: -HANDLE_SIZE / 2 }),
                    cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                  onMouseDown={(e) => handlePointerDown(e, corner)}
                  onTouchStart={(e) => handlePointerDown(e, corner)}
                />
              ))}
            </div>
          </div>
        )}

        {imageSrc && imageEl && (
          <>
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM13.5 10.5h-6" />
              </svg>
              <input
                type="range" min="1" max="3" step="0.01" value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="flex-1 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-gray-900"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
              </svg>
            </div>

            <button
              onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : '변경 내용 저장'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
