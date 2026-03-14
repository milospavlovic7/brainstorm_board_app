import React, { memo, useContext, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { BoardDispatch } from '../../../store/BoardContext';
import { CONFIG } from '../../../services/StorageService';

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

export const SvgPathElement = memo(({ path, mode, isSelected, onStartSelectionDrag }) => {
    const dispatch = useContext(BoardDispatch);

    const handlePointerDown = useCallback((e) => {
        if (mode === CONFIG.MODES.ERASE) {
            dispatch({ type: 'DELETE_PATH', id: path.id });
            return;
        }
        if (mode === CONFIG.MODES.SELECT) {
            e.stopPropagation();
            // Pass path.id so Board can select + start drag atomically
            if (onStartSelectionDrag) onStartSelectionDrag(e, path.id);
        }
    }, [mode, dispatch, path.id, onStartSelectionDrag]);

    const handlePointerEnter = useCallback((e) => {
        if (mode === CONFIG.MODES.ERASE && e.buttons === 1) {
            dispatch({ type: 'DELETE_PATH', id: path.id });
        }
    }, [mode, dispatch, path.id]);

    const strokeObj = getStroke(path.points, { size: path.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5, simulatePressure: true });
    const dString = getSvgPathFromStroke(strokeObj);

    return (
        <path
            data-path-id={path.id}
            className={[
                'path-stroke',
                mode === CONFIG.MODES.ERASE ? 'path-eraser-mode' : '',
                mode === CONFIG.MODES.SELECT ? 'path-selectable' : '',
                isSelected ? 'path-selected' : '',
            ].filter(Boolean).join(' ')}
            d={dString}
            fill={path.color}
            pointerEvents={mode === CONFIG.MODES.ERASE || mode === CONFIG.MODES.SELECT ? 'fill' : 'none'}
            onPointerDown={handlePointerDown}
            onPointerEnter={handlePointerEnter}
        />
    );
});
