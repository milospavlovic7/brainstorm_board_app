import React, { memo, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { BoardDispatch } from '../../../store/BoardContext';
import { usePhysicalDragRef } from '../usePhysicalDragRef';
import { CONFIG } from '../../../services/StorageService';

export const NoteNode = memo(({ data, isSelected, isMultiSelected, mode, zoom, onStartSelectionDrag }) => {
    const dispatch = useContext(BoardDispatch);
    const [showTitle, setShowTitle] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current && inputRef.current.innerHTML !== (data.text || '')) {
            inputRef.current.innerHTML = data.text || '';
        }
    }, [data.text]);

    const commitTransform = useCallback((id, payload) => {
        dispatch({ type: 'UPDATE_NODE', id, payload });
    }, [dispatch]);

    const { domRef, startDrag, startResize, onPointerMove, onPointerUp } = usePhysicalDragRef({
        id: data.id, x: data.x, y: data.y, w: data.w, h: data.h, zoom, onTransformEnd: commitTransform
    });

    const updateText = useCallback((e) => {
        dispatch({ type: 'UPDATE_NODE', id: data.id, payload: { text: e.currentTarget.innerHTML } });
    }, [dispatch, data.id]);

    const handlePaste = useCallback((e) => {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText && pastedText.length < 800) {
            const lines = pastedText.split('\n').length;
            const charsPerLine = Math.floor(data.w / 10);
            let estimatedLines = lines;
            pastedText.split('\n').forEach(line => { estimatedLines += Math.floor(line.length / charsPerLine); });
            commitTransform(data.id, { w: Math.min(500, Math.max(250, data.w)), h: Math.min(700, Math.max(100, (estimatedLines * 24) + 60)) });
        }
    }, [data.w, data.id, commitTransform]);

    const selectElement = useCallback((e) => {
        if (mode === CONFIG.MODES.SELECT) dispatch({ type: 'SET_SELECTION', payload: data.id });
    }, [dispatch, mode, data.id]);

    const handleHeaderPointerDown = useCallback((e) => {
        if (mode !== CONFIG.MODES.SELECT) return;
        // If already selected (single or multi), try group/selection drag first
        if (isSelected && onStartSelectionDrag) {
            onStartSelectionDrag(e, data.id);
            return;
        }
        selectElement(e);
        startDrag(e);
    }, [mode, isSelected, onStartSelectionDrag, data.id, selectElement, startDrag]);

    const hasTitle = data.title && data.title.trim().length > 0;

    return (
        <div
            ref={domRef}
            data-node-id={data.id}
            className={`node-base ${isSelected ? 'is-selected' : ''} ${isMultiSelected ? 'is-multi-selected' : ''}`}
            style={{ zIndex: isSelected ? 'var(--z-content-active)' : 'var(--z-content)', backgroundColor: data.color }}
            onPointerDown={selectElement}
            onPointerEnter={() => setShowTitle(true)}
            onPointerLeave={() => setShowTitle(false)}
        >
            {(showTitle || hasTitle || isSelected) && (
                <input
                    className="note-title-input"
                    style={{ fontFamily: data.font, opacity: (hasTitle || isSelected) ? 1 : 0.5 }}
                    type="text" placeholder="Add title..."
                    value={data.title || ''}
                    onChange={(e) => dispatch({ type: 'UPDATE_NODE', id: data.id, payload: { title: e.target.value } })}
                    onPointerDown={(e) => { selectElement(e); e.stopPropagation(); }}
                />
            )}
            <div
                className="note-header"
                onPointerDown={handleHeaderPointerDown}
                onPointerMove={isSelected && !isMultiSelected ? onPointerMove : undefined}
                onPointerUp={isSelected && !isMultiSelected ? onPointerUp : undefined}
                onPointerCancel={isSelected && !isMultiSelected ? onPointerUp : undefined}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 9h8M8 15h8" /></svg>
            </div>
            <div
                ref={inputRef}
                className="note-input content-editable"
                contentEditable
                suppressContentEditableWarning
                style={{ 
                    fontFamily: data.font, fontSize: `${data.fontSize || 16}px`, 
                    fontWeight: data.fontWeight || 'normal', fontStyle: data.fontStyle || 'normal', 
                    color: data.textColor || '#0f172a',
                    overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', outline: 'none', flex: 1
                }}
                onInput={updateText} onBlur={updateText} onPaste={handlePaste}
                onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                        e.preventDefault();
                        document.execCommand('bold', false, null);
                        updateText({ currentTarget: inputRef.current });
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                        e.preventDefault();
                        document.execCommand('italic', false, null);
                        updateText({ currentTarget: inputRef.current });
                    }
                }}
                onPointerDown={(e) => { selectElement(e); e.stopPropagation(); }}
                onWheel={(e) => e.stopPropagation()}
            />
            {!isMultiSelected && (
                <div
                    className="resize-handle"
                    onPointerDown={mode === CONFIG.MODES.SELECT ? startResize : undefined}
                    onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                />
            )}
        </div>
    );
});
