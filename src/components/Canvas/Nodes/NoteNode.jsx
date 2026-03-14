import React, { memo, useContext, useCallback, useState } from 'react';
import { BoardDispatch } from '../../../store/BoardContext';
import { usePhysicalDragRef } from '../usePhysicalDragRef';
import { CONFIG } from '../../../services/StorageService';

export const NoteNode = memo(({ data, isSelected, mode, zoom }) => {
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;
    const [showTitle, setShowTitle] = useState(false);

    const commitTransform = useCallback((id, payload) => {
        dispatch({ type: 'UPDATE_NODE', id, payload });
    }, [dispatch]);

    const { domRef, startDrag, startResize, onPointerMove, onPointerUp } = usePhysicalDragRef({
        id: data.id, x: data.x, y: data.y, w: data.w, h: data.h, zoom, onTransformEnd: commitTransform
    });

    const updateText = useCallback((e) => {
        dispatch({ type: 'UPDATE_NODE', id: data.id, payload: { text: e.target.value } });
    }, [dispatch, data.id]);

    const handlePaste = useCallback((e) => {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText && pastedText.length < 800) {
            const lines = pastedText.split('\n').length;
            const charsPerLine = Math.floor(data.w / 10);
            let estimatedLines = lines;
            pastedText.split('\n').forEach(line => {
                estimatedLines += Math.floor(line.length / charsPerLine);
            });
            const newH = Math.min(700, Math.max(100, (estimatedLines * 24) + 60));
            const newW = Math.min(500, Math.max(250, data.w));
            commitTransform(data.id, { w: newW, h: newH });
        }
    }, [data.w, data.id, commitTransform]);

    const selectElement = useCallback((e) => {
        if (mode === CONFIG.MODES.SELECT) {
            dispatch({ type: 'SET_SELECTION', payload: data.id });
        }
    }, [dispatch, mode, data.id]);

    const hasTitle = data.title && data.title.trim().length > 0;

    return (
        <div 
            ref={domRef}
            className={`node-base ${isSelected ? 'is-selected' : ''}`}
            style={{ 
                zIndex: isSelected ? 'var(--z-content-active)' : 'var(--z-content)',
                backgroundColor: data.color
            }}
            onPointerDown={selectElement}
            onPointerEnter={() => setShowTitle(true)}
            onPointerLeave={() => setShowTitle(false)}
        >
            {/* Hoverable title area above the note */}
            {(showTitle || hasTitle || isSelected) && (
                <input
                    className="note-title-input"
                    style={{ 
                        fontFamily: data.font,
                        opacity: (hasTitle || isSelected) ? 1 : 0.5
                    }}
                    type="text"
                    placeholder="Add title..."
                    value={data.title || ''}
                    onChange={(e) => dispatch({ type: 'UPDATE_NODE', id: data.id, payload: { title: e.target.value }})}
                    onPointerDown={(e) => { selectElement(e); e.stopPropagation(); }}
                />
            )}
            <div 
                className="note-header"
                onPointerDown={mode === CONFIG.MODES.SELECT ? startDrag : undefined}
                onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9h8M8 15h8"/></svg>
            </div>
            <textarea 
                className="note-input"
                style={{ 
                    fontFamily: data.font, 
                    fontSize: `${data.fontSize || 16}px`,
                    fontWeight: data.fontWeight || 'normal',
                    fontStyle: data.fontStyle || 'normal',
                    color: data.textColor || '#0f172a'
                }}
                value={data.text}
                onChange={updateText}
                onPaste={handlePaste}
                onPointerDown={(e) => { selectElement(e); e.stopPropagation(); }}
                onWheel={(e) => e.stopPropagation()}
            />
            <div 
                className="resize-handle"
                onPointerDown={mode === CONFIG.MODES.SELECT ? startResize : undefined}
                onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
            />
        </div>
    );
});

