import { useRef, useEffect, useCallback, useContext } from 'react';
import { BoardDispatch } from '../../store/BoardContext';

export function usePhysicalDragRef({ id, x, y, w, h, zoom, onTransformEnd }) {
    const dispatchEnhanced = useContext(BoardDispatch);
    // Real dispatch function from the enhanced context
    const dispatch = dispatchEnhanced;

    const domRef = useRef(null);
    const physicalState = useRef({ x, y, w, h });
    const interaction = useRef({ active: false, type: null, startX: 0, startY: 0, initialW: 0, initialH: 0 });

    useEffect(() => {
        physicalState.current = { x, y, w, h };
        if (domRef.current) {
            domRef.current.style.transform = `translate(${x}px, ${y}px)`;
            if (w !== undefined) domRef.current.style.width = `${w}px`;
            if (h !== undefined) domRef.current.style.height = `${h}px`;
        }
    }, [x, y, w, h]);

    const startDrag = useCallback((e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_SELECTION', payload: id });
        interaction.current = { 
            active: true, type: 'DRAG', 
            startX: e.clientX, startY: e.clientY, 
            refX: physicalState.current.x, refY: physicalState.current.y 
        };
        e.target.setPointerCapture(e.pointerId);
    }, [dispatch, id]);

    const startResize = useCallback((e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_SELECTION', payload: id });
        interaction.current = { 
            active: true, type: 'RESIZE', 
            startX: e.clientX, startY: e.clientY, 
            initialW: physicalState.current.w, initialH: physicalState.current.h 
        };
        e.target.setPointerCapture(e.pointerId);
    }, [dispatch, id]);

    const onPointerMove = useCallback((e) => {
        if (!interaction.current.active) return;
        const int = interaction.current;
        const dx = (e.clientX - int.startX) / zoom;
        const dy = (e.clientY - int.startY) / zoom;

        if (int.type === 'DRAG') {
            physicalState.current.x = int.refX + dx;
            physicalState.current.y = int.refY + dy;
            if (domRef.current) domRef.current.style.transform = `translate(${physicalState.current.x}px, ${physicalState.current.y}px)`;
        } else if (int.type === 'RESIZE') {
            physicalState.current.w = Math.max(100, int.initialW + dx);
            physicalState.current.h = Math.max(50, int.initialH + dy);
            if (domRef.current) {
                domRef.current.style.width = `${physicalState.current.w}px`;
                domRef.current.style.height = `${physicalState.current.h}px`;
            }
        }
    }, [zoom]);

    const onPointerUp = useCallback((e) => {
        if (interaction.current.active) {
            interaction.current.active = false;
            e.target.releasePointerCapture(e.pointerId);
            onTransformEnd(id, { ...physicalState.current });
        }
    }, [id, onTransformEnd]);

    return { domRef, startDrag, startResize, onPointerMove, onPointerUp };
}
