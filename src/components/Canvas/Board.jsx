import React, { useContext, useRef, useCallback, useState, useEffect } from 'react';
import { BoardContext, BoardDispatch } from '../../store/BoardContext';
import { CONFIG, generateId } from '../../services/StorageService';
import { NoteNode } from './Nodes/NoteNode';
import { ImageNode, TextNode } from './Nodes/MediaNodes';
import { SvgPathElement } from './Paths/SvgLayer';

export function Board() {
    const state = useContext(BoardContext);
    const { viewport, mode, paths, nodes, selectionIds, brush, isDarkTheme, showGrid } = state;
    const dispatch = useContext(BoardDispatch);

    const boardRef = useRef();
    const interactState = useRef({
        isPanning: false, isDrawing: false, isBoxSelecting: false, isGroupMoving: false,
        lastX: 0, lastY: 0,
        accDx: 0, accDy: 0,
        nodeSnapshots: {},
        pathSnapshots: {},
    });

    const [localActivePath, setLocalActivePath] = useState(null);
    const [selectionRect, setSelectionRect] = useState(null);

    // Stable refs — avoid stale closures in pointer handlers
    const nodesRef = useRef(nodes);
    const pathsRef = useRef(paths);
    const selectionIdsRef = useRef(selectionIds);
    const viewportRef = useRef(viewport);
    const localActivePathRef = useRef(localActivePath);
    const selectionRectRef = useRef(selectionRect);

    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { pathsRef.current = paths; }, [paths]);
    useEffect(() => { selectionIdsRef.current = selectionIds; }, [selectionIds]);
    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { localActivePathRef.current = localActivePath; }, [localActivePath]);
    useEffect(() => { selectionRectRef.current = selectionRect; }, [selectionRect]);

    // ── Global Paste ──────────────────────────────────────────────────────────
    useEffect(() => {
        const handleGlobalPaste = (e) => {
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
                            const vp = viewportRef.current;
                            const vX = (-vp.x + window.innerWidth / 2) / vp.zoom - w / 2;
                            const vY = (-vp.y + window.innerHeight / 2) / vp.zoom - h / 2;
                            dispatch({ type: 'ADD_NODE', payload: { type: 'image', id: generateId(), src: ev.target.result, x: vX, y: vY, w, h } });
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
    }, [dispatch]);

    // ── Wheel zoom/pan ────────────────────────────────────────────────────────
    useEffect(() => {
        const el = boardRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (e.target.tagName && e.target.tagName.toLowerCase() === 'textarea') return;
            e.preventDefault();
            const vp = viewportRef.current;
            if (e.ctrlKey || e.metaKey) {
                const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
                const newZoom = Math.min(Math.max(0.1, vp.zoom + zoomDelta), 5);
                const pointX = (e.clientX - vp.x) / vp.zoom;
                const pointY = (e.clientY - vp.y) / vp.zoom;
                dispatch({ type: 'SET_VIEWPORT', payload: { zoom: newZoom, x: e.clientX - pointX * newZoom, y: e.clientY - pointY * newZoom } });
            } else {
                dispatch({ type: 'SET_VIEWPORT', payload: { ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY } });
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [dispatch]);

    // ── resolvePoint: screen → board coords ───────────────────────────────────
    const resolvePoint = useCallback((cx, cy) => {
        const vp = viewportRef.current;
        return { x: (cx - vp.x) / vp.zoom, y: (cy - vp.y) / vp.zoom };
    }, []);

    // ── applyBoxSelection: select all nodes/paths inside rect (board coords) ─
    const applyBoxSelection = useCallback((boardRect) => {
        const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
        const selectedIds = [];

        nodesRef.current.forEach(node => {
            const nb = { x1: node.x, y1: node.y, x2: node.x + (node.w || 200), y2: node.y + (node.h || 100) };
            if (overlap(nb, boardRect)) selectedIds.push(node.id);
        });
        pathsRef.current.forEach(path => {
            if (!path.points.length) return;
            let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
            path.points.forEach(pt => {
                // Handle both [x,y] arrays and legacy {x,y} objects
                const px = Array.isArray(pt) ? pt[0] : pt.x;
                const py = Array.isArray(pt) ? pt[1] : pt.y;
                if (px < x1) x1 = px;
                if (py < y1) y1 = py;
                if (px > x2) x2 = px;
                if (py > y2) y2 = py;
            });
            if (overlap({ x1, y1, x2, y2 }, boardRect)) selectedIds.push(path.id);
        });
        dispatch({ type: 'SET_MULTI_SELECTION', payload: selectedIds });
    }, [dispatch]);

    // ── startSelectionDrag: called by child nodes/paths ───────────────────────
    // triggerId: the item the user grabbed — Board handles selection + drag atomically
    const startSelectionDrag = useCallback((e, triggerId = null) => {
        e.stopPropagation();

        let ids = selectionIdsRef.current ? [...selectionIdsRef.current] : [];
        if (triggerId && !ids.includes(triggerId)) {
            // Item not yet selected — select only it
            ids = [triggerId];
            dispatch({ type: 'SET_SELECTION', payload: triggerId });
        } else if (ids.length === 0) {
            return false;
        }

        const nodeSnaps = {};
        const pathSnaps = {};
        ids.forEach(id => {
            const n = nodesRef.current.find(n => n.id === id);
            if (n) nodeSnaps[id] = { x: n.x, y: n.y };
            const p = pathsRef.current.find(p => p.id === id);
            if (p) pathSnaps[id] = true;
        });

        interactState.current = {
            ...interactState.current,
            isPanning: false, isDrawing: false, isBoxSelecting: false, isGroupMoving: true,
            lastX: e.clientX, lastY: e.clientY,
            accDx: 0, accDy: 0,
            nodeSnapshots: nodeSnaps,
            pathSnapshots: pathSnaps,
        };

        boardRef.current.setPointerCapture(e.pointerId);
        return true;
    }, [dispatch]);

    // ── Pointer handlers ──────────────────────────────────────────────────────
    const onPointerDown = useCallback((e) => {
        if (e.target.closest('.ui-layer-ignore')) return;

        // Ctrl + left drag → box selection
        if (e.button === 0 && mode === CONFIG.MODES.SELECT && e.ctrlKey) {
            interactState.current = {
                ...interactState.current,
                isPanning: false, isDrawing: false, isBoxSelecting: true, isGroupMoving: false,
                lastX: e.clientX, lastY: e.clientY
            };
            setSelectionRect({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
            boardRef.current.setPointerCapture(e.pointerId);
            return;
        }

        if ((mode === CONFIG.MODES.SELECT || mode === CONFIG.MODES.TEXT) && e.target === boardRef.current) {
            dispatch({ type: 'SET_SELECTION', payload: null });
        }

        if (e.button === 1 || (e.button === 0 && mode === CONFIG.MODES.SELECT && (e.target === boardRef.current || e.target.closest('svg')))) {
            interactState.current = { ...interactState.current, isPanning: true, isDrawing: false, isBoxSelecting: false, isGroupMoving: false, lastX: e.clientX, lastY: e.clientY };
            e.target.setPointerCapture(e.pointerId);
        } else if (e.button === 0 && mode === CONFIG.MODES.DRAW) {
            interactState.current = { ...interactState.current, isPanning: false, isDrawing: true, isBoxSelecting: false, isGroupMoving: false };
            setLocalActivePath({ id: generateId(), color: brush.color, size: brush.size, points: [[e.clientX, e.clientY]] });
            e.target.setPointerCapture(e.pointerId);
        } else if (e.button === 0 && mode === CONFIG.MODES.TEXT && e.target === boardRef.current) {
            const pt = resolvePoint(e.clientX, e.clientY);
            dispatch({ type: 'ADD_NODE', payload: { type: 'text', id: generateId(), x: pt.x, y: pt.y - 16, w: 250, h: 40, text: '', color: CONFIG.COLORS_TEXT[0], font: CONFIG.FONTS[0], fontSize: 32 } });
        }
    }, [mode, brush, dispatch, resolvePoint]);

    const onPointerMove = useCallback((e) => {
        const s = interactState.current;
        const vp = viewportRef.current;

        if (s.isPanning) {
            dispatch({ type: 'SET_VIEWPORT', payload: { ...vp, x: vp.x + (e.clientX - s.lastX), y: vp.y + (e.clientY - s.lastY) } });
            s.lastX = e.clientX;
            s.lastY = e.clientY;
        } else if (s.isDrawing) {
            setLocalActivePath(prev => prev ? { ...prev, points: [...prev.points, [e.clientX, e.clientY]] } : null);
        } else if (s.isBoxSelecting) {
            setSelectionRect(prev => prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null);
        } else if (s.isGroupMoving) {
            // DOM-only mutations — zero Redux calls during drag for max performance
            const rawDx = (e.clientX - s.lastX) / vp.zoom;
            const rawDy = (e.clientY - s.lastY) / vp.zoom;
            s.lastX = e.clientX;
            s.lastY = e.clientY;
            s.accDx += rawDx;
            s.accDy += rawDy;

            Object.keys(s.nodeSnapshots).forEach(id => {
                const snap = s.nodeSnapshots[id];
                const el = boardRef.current.querySelector(`[data-node-id="${id}"]`);
                if (el) el.style.transform = `translate(${snap.x + s.accDx}px, ${snap.y + s.accDy}px)`;
            });
            Object.keys(s.pathSnapshots).forEach(id => {
                const el = boardRef.current.querySelector(`[data-path-id="${id}"]`);
                if (el) el.setAttribute('transform', `translate(${s.accDx}, ${s.accDy})`);
            });
        }
    }, [dispatch]);

    const onPointerUp = useCallback((e) => {
        const s = interactState.current;

        if (s.isPanning) {
            s.isPanning = false;
            try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}

        } else if (s.isDrawing) {
            s.isDrawing = false;
            try { e.target.releasePointerCapture(e.pointerId); } catch (_) {}
            // Read current localActivePath from ref — safe, no stale closure
            const lap = localActivePathRef.current;
            setLocalActivePath(null);
            if (lap && lap.points.length > 2) {
                const vp = viewportRef.current;
                const finalPath = {
                    ...lap,
                    // Convert screen pixels → board coords, store as [x,y] arrays
                    points: lap.points.map(pt => [(pt[0] - vp.x) / vp.zoom, (pt[1] - vp.y) / vp.zoom])
                };
                dispatch({ type: 'ADD_PATH', payload: finalPath });
            }

        } else if (s.isBoxSelecting) {
            s.isBoxSelecting = false;
            try { boardRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
            // Read from ref — never stale
            const rect = selectionRectRef.current;
            setSelectionRect(null);
            if (rect) {
                const vp = viewportRef.current;
                const rx1 = Math.min(rect.x1, rect.x2), ry1 = Math.min(rect.y1, rect.y2);
                const rx2 = Math.max(rect.x1, rect.x2), ry2 = Math.max(rect.y1, rect.y2);
                applyBoxSelection({
                    x1: (rx1 - vp.x) / vp.zoom, y1: (ry1 - vp.y) / vp.zoom,
                    x2: (rx2 - vp.x) / vp.zoom, y2: (ry2 - vp.y) / vp.zoom,
                });
            }

        } else if (s.isGroupMoving) {
            s.isGroupMoving = false;
            try { boardRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
            // Reset SVG transforms BEFORE Redux updates path points (React will re-render with correct points)
            Object.keys(s.pathSnapshots).forEach(id => {
                const el = boardRef.current ? boardRef.current.querySelector(`[data-path-id="${id}"]`) : null;
                if (el) el.setAttribute('transform', '');
            });
            if (Math.abs(s.accDx) > 0.5 || Math.abs(s.accDy) > 0.5) {
                dispatch({ type: 'MOVE_SELECTION', payload: { dx: s.accDx, dy: s.accDy } });
            }
        }
    }, [dispatch, applyBoxSelection]);

    // ── Background grid ───────────────────────────────────────────────────────
    const styleBg = showGrid ? 'radial-gradient(var(--color-grid) 1.5px, transparent 1.5px)' : 'none';

    const selRectStyle = selectionRect ? {
        left: Math.min(selectionRect.x1, selectionRect.x2),
        top: Math.min(selectionRect.y1, selectionRect.y2),
        width: Math.abs(selectionRect.x2 - selectionRect.x1),
        height: Math.abs(selectionRect.y2 - selectionRect.y1),
    } : null;

    return (
        <div
            ref={boardRef}
            className={`canvas-container ${isDarkTheme ? 'dark-theme' : ''}`}
            style={{
                backgroundPosition: viewport.x + "px " + viewport.y + "px",
                backgroundSize: (30 * viewport.zoom) + "px " + (30 * viewport.zoom) + "px",
                backgroundImage: styleBg,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <div
                className="viewport-layer"
                style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
            >
                {/* SVG Drawing Layer */}
                <svg className="svg-layer">
                    {paths.map(p => (
                        <SvgPathElement
                            key={p.id} path={p} mode={mode}
                            isSelected={selectionIds.includes(p.id)}
                            onStartSelectionDrag={startSelectionDrag}
                        />
                    ))}
                    {localActivePath && (
                        <SvgPathElement
                            path={{
                                ...localActivePath,
                                // Convert screen pixels → board coords for live preview
                                points: localActivePath.points.map(pt => {
                                    const vp = viewportRef.current;
                                    return [(pt[0] - vp.x) / vp.zoom, (pt[1] - vp.y) / vp.zoom];
                                })
                            }}
                            mode={CONFIG.MODES.DRAW}
                            isSelected={false}
                        />
                    )}
                </svg>

                {/* Nodes Layer */}
                {nodes.map(node => {
                    const isSel = selectionIds.includes(node.id);
                    const isMulti = selectionIds.length > 1 && isSel;
                    const props = { key: node.id, data: node, mode, zoom: viewport.zoom, isSelected: isSel, isMultiSelected: isMulti, onStartSelectionDrag: startSelectionDrag };
                    if (node.type === 'note') return <NoteNode {...props} />;
                    if (node.type === 'image') return <ImageNode {...props} />;
                    if (node.type === 'text') return <TextNode {...props} />;
                    return null;
                })}
            </div>

            {/* Ctrl+drag selection rectangle */}
            {selRectStyle && <div className="selection-rect" style={selRectStyle} />}
        </div>
    );
}
