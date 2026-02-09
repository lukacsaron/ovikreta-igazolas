import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Canvas-based signature pad with smooth Bézier curves.
 * Works with both mouse and touch (finger) input.
 *
 * Props:
 *  - onSignatureChange(dataUrl | null) — called whenever the drawing changes
 *  - width / height — optional, defaults to container width × 200
 *  - className — extra wrapper classes
 *  - compact — smaller variant for inline use
 */
export default function SignaturePad({ onSignatureChange, className = '', compact = false }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStrokes, setHasStrokes] = useState(false);
    const pointsRef = useRef([]);
    const lastPointRef = useRef(null);

    // Resize canvas to container
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;

            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = (compact ? 140 : 200) * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = (compact ? 140 : 200) + 'px';

            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#3b2d8b';
            ctx.lineWidth = 2.5;
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [compact]);

    const getPos = useCallback((e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top,
        };
    }, []);

    const startStroke = useCallback((e) => {
        e.preventDefault();
        const pos = getPos(e);
        setIsDrawing(true);
        lastPointRef.current = pos;
        pointsRef.current = [pos];
    }, [getPos]);

    const draw = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();

        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        const last = lastPointRef.current;

        // Quadratic Bézier for smooth curves
        const mid = { x: (last.x + pos.x) / 2, y: (last.y + pos.y) / 2 };
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        ctx.stroke();

        lastPointRef.current = pos;
        pointsRef.current.push(pos);
    }, [isDrawing, getPos]);

    const endStroke = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);
        setHasStrokes(true);
        lastPointRef.current = null;

        // Export
        if (onSignatureChange) {
            const dataUrl = canvasRef.current.toDataURL('image/png');
            onSignatureChange(dataUrl);
        }
    }, [isDrawing, onSignatureChange]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        setHasStrokes(false);
        pointsRef.current = [];
        if (onSignatureChange) onSignatureChange(null);
    }, [onSignatureChange]);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Canvas */}
            <div className={`relative rounded-xl overflow-hidden border-2 border-dashed ${isDrawing ? 'border-amber-400' : 'border-gray-200'
                } transition-colors bg-gradient-to-b from-amber-50/30 to-white`}>
                <canvas
                    ref={canvasRef}
                    className="block w-full cursor-crosshair touch-none"
                    onMouseDown={startStroke}
                    onMouseMove={draw}
                    onMouseUp={endStroke}
                    onMouseLeave={endStroke}
                    onTouchStart={startStroke}
                    onTouchMove={draw}
                    onTouchEnd={endStroke}
                />

                {/* Guide line */}
                <div className="absolute bottom-8 left-6 right-6 border-b border-dotted border-gray-300 pointer-events-none" />

                {/* Placeholder text */}
                {!hasStrokes && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-300">
                        <span className="text-3xl mb-1">✍️</span>
                        <span className="text-sm font-medium">
                            {compact ? 'Írja alá itt' : 'Írja alá ujjával vagy egérrel'}
                        </span>
                    </div>
                )}
            </div>

            {/* Controls */}
            {hasStrokes && (
                <button
                    onClick={clearCanvas}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all text-xs flex items-center gap-1"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Törlés
                </button>
            )}
        </div>
    );
}
