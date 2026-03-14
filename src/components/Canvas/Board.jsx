import React, { useContext, useRef, useCallback, useState, useEffect } from 'react';
import { BoardContext, BoardDispatch } from '../../store/BoardContext';
import { CONFIG, generateId } from '../../services/StorageService';
import { NoteNode } from './Nodes/NoteNode';
import { ImageNode, TextNode } from './Nodes/MediaNodes';
import { SvgPathElement } from './Paths/SvgLayer';

export function Board() {
    const state = useContext(BoardContext);
    const { viewport, mode, paths, nodes, selectionId, brush, isDarkTheme, showGrid } = state;
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;
    
    const boardRef = useRef();
    const interactState = useRef({ isPanning: false, isDrawing: false, lastX: 0, lastY: 0 });
    const [localActivePath, setLocalActivePath] = useState(null);

    // Global Paste Listener for Images and Nodes 
    useEffect(() => {
        const handleGlobalPaste = (e) => {
            // If we are actively editing inside an input/textarea, ignore global paste
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const img = new Image();
                        img.onload = () => {
                            let w = img.width, h = img.height;
                            if (w > 500) { h = h * (500 / w); w = 500; }
                            
                            // Paste at center of viewport
                            const vX = (-viewport.x + window.innerWidth / 2) / viewport.zoom - w/2;
                            const vY = (-viewport.y + window.innerHeight / 2) / viewport.zoom - h/2;

                            dispatch({ type: 'ADD_NODE', payload: { 
                                type: 'image', id: generateId(), src: ev.target.result, x: vX, y: vY, w, h 
                            }});
                        };
                        img.src = ev.target.result;
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        };
        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
    }, [dispatch, viewport]);

    // Wheel Handler
    useEffect(() => {
        const el = boardRef.current;
        if (!el) return;
        
        const onWheel = (e) => {
            if (e.target.tagName && e.target.tagName.toLowerCase() === 'textarea') return;
            e.preventDefault();
            
            if (e.ctrlKey || e.metaKey) {
                // Zoom by exactly 10% blocks (0.1) depending on wheel direction
                let zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
                const newZoom = Math.min(Math.max(0.1, viewport.zoom + zoomDelta), 5);
                
                const pointX = (e.clientX - viewport.x) / viewport.zoom;
                const pointY = (e.clientY - viewport.y) / viewport.zoom;
                dispatch({ type: 'SET_VIEWPORT', payload: { zoom: newZoom, x: e.clientX - pointX * newZoom, y: e.clientY - pointY * newZoom }});
            } else {
                dispatch({ type: 'SET_VIEWPORT', payload: { ...viewport, x: viewport.x - e.deltaX, y: viewport.y - e.deltaY }});
            }
        };
        
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [viewport, dispatch]);

    const resolvePoint = useCallback((cx, cy) => {
        return { x: (cx - viewport.x) / viewport.zoom, y: (cy - viewport.y) / viewport.zoom };
    }, [viewport]);

    const onPointerDown = useCallback((e) => {
        if (e.target.closest('.ui-layer-ignore')) return;

        if ((mode === CONFIG.MODES.SELECT || mode === CONFIG.MODES.TEXT) && e.target === boardRef.current) {
            dispatch({ type: 'SET_SELECTION', payload: null });
        }

        if (e.button === 1 || (e.button === 0 && mode === CONFIG.MODES.SELECT && (e.target === boardRef.current || e.target.closest('svg')))) {
            interactState.current = { isPanning: true, isDrawing: false, lastX: e.clientX, lastY: e.clientY };
            e.target.setPointerCapture(e.pointerId);
        } else if (e.button === 0 && mode === CONFIG.MODES.DRAW) {
            interactState.current = { isPanning: false, isDrawing: true, lastX: 0, lastY: 0 };
            setLocalActivePath({ id: generateId(), color: brush.color, size: brush.size, points: [[e.clientX, e.clientY]] });
            e.target.setPointerCapture(e.pointerId);
        } else if (e.button === 0 && mode === CONFIG.MODES.TEXT && e.target === boardRef.current) {
            // Create a new text node wherever the user clicks, if they click the bare board
            const pt = resolvePoint(e.clientX, e.clientY);
            dispatch({ type: 'ADD_NODE', payload: {
                type: 'text', id: generateId(), 
                x: pt.x, y: pt.y - 16, w: 250, h: 40, 
                text: '', color: CONFIG.COLORS_TEXT[0], 
                font: CONFIG.FONTS[0], fontSize: 32
            }});
        }
    }, [mode, brush, dispatch, resolvePoint]);

    const onPointerMove = useCallback((e) => {
        const s = interactState.current;
        if (s.isPanning) {
            dispatch({ type: 'SET_VIEWPORT', payload: { ...viewport, x: viewport.x + (e.clientX - s.lastX), y: viewport.y + (e.clientY - s.lastY) }});
            s.lastX = e.clientX; s.lastY = e.clientY;
        } else if (s.isDrawing) {
            setLocalActivePath(prev => prev ? { ...prev, points: [...prev.points, [e.clientX, e.clientY]] } : null);
        }
    }, [viewport, dispatch, resolvePoint]);

    const onPointerUp = useCallback((e) => {
        const s = interactState.current;
        if (s.isPanning) {
            s.isPanning = false;
            e.target.releasePointerCapture(e.pointerId);
        } else if (s.isDrawing) {
            s.isDrawing = false;
            e.target.releasePointerCapture(e.pointerId);
            if (localActivePath && localActivePath.points.length > 2) {
                // translate raw screen pixels to viewport coordinates right before saving to redux
                const finalPath = {
                    ...localActivePath,
                    points: localActivePath.points.map(pt => resolvePoint(pt[0], pt[1]))
                };
                dispatch({ type: 'ADD_PATH', payload: finalPath });
            }
            setLocalActivePath(null);
        }
    }, [localActivePath, dispatch, resolvePoint]);

    // Resolve dots styling purely via CSS Variables
    const styleBg = showGrid ? 'radial-gradient(var(--color-grid) 1.5px, transparent 1.5px)' : 'none';

    return (
        <div 
            ref={boardRef} 
            className={`canvas-container ${isDarkTheme ? 'dark-theme' : ''}`}
            style={{ 
                backgroundPosition: viewport.x + "px " + viewport.y + "px", 
                backgroundSize: (30 * viewport.zoom) + "px " + (30 * viewport.zoom) + "px",
                backgroundImage: styleBg
            }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
            <div 
                className="viewport-layer"
                style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
            >
                {/* SVG Drawing Layer */}
                <svg className="svg-layer">
                    {paths.map(p => <SvgPathElement key={p.id} path={p} mode={mode} />)}
                    {localActivePath && (
                        <SvgPathElement 
                            path={{...localActivePath, points: localActivePath.points.map(pt => resolvePoint(pt[0], pt[1])) }} 
                            mode={CONFIG.MODES.DRAW} 
                        />
                    )}
                </svg>

                {/* Nodes Layer */}
                {nodes.map(node => {
                    if (node.type === 'note') return <NoteNode key={node.id} data={node} mode={mode} zoom={viewport.zoom} isSelected={selectionId === node.id} />;
                    if (node.type === 'image') return <ImageNode key={node.id} data={node} mode={mode} zoom={viewport.zoom} isSelected={selectionId === node.id} />;
                    if (node.type === 'text') return <TextNode key={node.id} data={node} mode={mode} zoom={viewport.zoom} isSelected={selectionId === node.id} />;
                    return null;
                })}
            </div>
        </div>
    );
}
