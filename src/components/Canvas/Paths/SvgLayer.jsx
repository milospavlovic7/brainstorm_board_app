import React, { memo, useContext, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { BoardDispatch } from '../../../store/BoardContext';
import { CONFIG } from '../../../services/StorageService';

// Helper to convert getStroke array to SVG path
function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return '';

    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
}

export const SvgPathElement = memo(({ path, mode }) => {
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;

    const handleErase = useCallback((e) => {
        if (mode === CONFIG.MODES.ERASE && (e.type === 'pointerdown' || e.buttons === 1)) {
            dispatch({ type: 'DELETE_PATH', id: path.id });
        }
    }, [mode, dispatch, path.id]);

    // Use perfect-freehand to generate a beautiful tapered stroke
    const strokeObj = getStroke(path.points, {
        size: path.size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: true
    });
    const dString = getSvgPathFromStroke(strokeObj);

    return (
        <path 
            className={`path-stroke ${mode === CONFIG.MODES.ERASE ? 'path-eraser-mode' : ''}`}
            d={dString} 
            fill={path.color} 
            pointerEvents={mode === CONFIG.MODES.ERASE ? "fill" : "none"}
            onPointerDown={handleErase} 
            onPointerEnter={handleErase}
        />
    );
});
