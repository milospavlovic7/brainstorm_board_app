import React, { memo, useContext, useCallback, useRef, useEffect } from 'react';
import { BoardDispatch } from '../../../store/BoardContext';
import { usePhysicalDragRef } from '../usePhysicalDragRef';
import { CONFIG } from '../../../services/StorageService';

export const ImageNode = memo(({ data, isSelected, mode, zoom }) => {
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;

    const commitTransform = useCallback((id, payload) => {
        dispatch({ type: 'UPDATE_NODE', id, payload });
    }, [dispatch]);

    const { domRef, startDrag, startResize, onPointerMove, onPointerUp } = usePhysicalDragRef({
        id: data.id, x: data.x, y: data.y, w: data.w, h: data.h, zoom, onTransformEnd: commitTransform
    });

    const selectElement = useCallback((e) => {
        if (mode === CONFIG.MODES.SELECT) {
            dispatch({ type: 'SET_SELECTION', payload: data.id });
        }
    }, [dispatch, mode, data.id]);

    return (
        <div 
            ref={domRef}
            className={`node-base image-node ${isSelected ? 'is-selected' : ''}`}
            style={{ zIndex: isSelected ? 'var(--z-content-active)' : 'var(--z-content)' }}
            onPointerDown={selectElement}
        >
            <img src={data.src} className="image-content" alt="Board content" />
            <div 
                className="image-drag-overlay"
                onPointerDown={mode === CONFIG.MODES.SELECT ? startDrag : undefined}
                onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            />
            <div 
                className="resize-handle"
                onPointerDown={mode === CONFIG.MODES.SELECT ? startResize : undefined}
                onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            />
        </div>
    );
});

export const TextNode = memo(({ data, isSelected, mode, zoom }) => {
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;
    
    // Auto-resize the textarea vertically as user types
    const textRef = useRef(null);
    useEffect(() => {
        if (textRef.current) {
            textRef.current.style.height = 'auto'; // reset height to grab scrollHeight
            textRef.current.style.height = `${textRef.current.scrollHeight}px`;
        }
    }, [data.text, data.w]); // re-calculate when text or width changes

    const commitTransform = useCallback((id, payload) => {
        dispatch({ type: 'UPDATE_NODE', id, payload });
    }, [dispatch]);

    const { domRef, startDrag, startResize, onPointerMove, onPointerUp } = usePhysicalDragRef({
        id: data.id, x: data.x, y: data.y, w: data.w, h: data.h, zoom, onTransformEnd: commitTransform
    });

    const updateText = useCallback((e) => {
        dispatch({ type: 'UPDATE_NODE', id: data.id, payload: { text: e.target.value } });
    }, [dispatch, data.id]);

    const selectElement = useCallback((e) => {
        if (mode === CONFIG.MODES.SELECT || mode === CONFIG.MODES.TEXT) {
            dispatch({ type: 'SET_SELECTION', payload: data.id });
        }
    }, [dispatch, mode, data.id]);

    return (
        <div 
            ref={domRef}
            className={`node-base text-node ${isSelected ? 'is-selected' : ''}`}
            style={{ 
                zIndex: isSelected ? 'var(--z-content-active)' : 'var(--z-content)',
                background: 'transparent',
                boxShadow: 'none',
                minHeight: '40px'
            }}
            onPointerDown={selectElement}
        >
            <textarea 
                ref={textRef}
                className="text-input"
                style={{ 
                    fontFamily: data.font, 
                    color: data.color, 
                    fontSize: `${data.fontSize || 32}px`,
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    outline: isSelected ? '2px dashed var(--color-primary)' : 'none',
                    resize: 'none',
                    padding: '8px',
                    width: '100%',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    cursor: mode === CONFIG.MODES.SELECT ? 'grab' : 'text'
                }}
                value={data.text}
                onChange={updateText}
                placeholder="Type here..."
                onPointerDown={(e) => { 
                    selectElement(e); 
                    if (mode === CONFIG.MODES.SELECT && !e.target.matches(':focus')) {
                        startDrag(e); 
                    } else if (mode === CONFIG.MODES.TEXT) {
                        e.stopPropagation(); // Allow text cursor placement
                    }
                }}
                onPointerMove={onPointerMove} 
                onPointerUp={onPointerUp} 
                onPointerCancel={onPointerUp}
                onWheel={(e) => e.stopPropagation()} 
            />
            {isSelected && mode === CONFIG.MODES.SELECT && (
                <div 
                    className="resize-handle text-resize"
                    onPointerDown={startResize}
                    onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                />
            )}
        </div>
    );
});
