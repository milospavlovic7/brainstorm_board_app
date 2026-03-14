import React, { useContext, useMemo, useState, useCallback } from 'react';
import { BoardContext, BoardDispatch } from '../../store/BoardContext';
import { CONFIG, StorageService } from '../../services/StorageService';
import { Trash2, Save } from 'lucide-react';

export function PropertiesBar() {
    const { mode, selectionId, nodes, brush } = useContext(BoardContext);
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;
    const [savedFeedback, setSavedFeedback] = useState(false);

    const selectedNode = useMemo(() => nodes.find(n => n.id === selectionId), [nodes, selectionId]);

    const handleColorClick = (c) => {
        if (selectedNode) dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { color: c }});
        else if (mode === CONFIG.MODES.DRAW) dispatch({ type: 'SET_BRUSH', payload: { color: c }});
    };

    const handleDelete = () => {
        if (selectionId) dispatch({ type: 'DELETE_NODE', id: selectionId });
    };

    const handleSaveDefaults = useCallback(() => {
        if (!selectedNode || selectedNode.type !== 'note') return;
        const defaults = {
            color: selectedNode.color || CONFIG.COLORS_NOTE[0],
            font: selectedNode.font || CONFIG.FONTS[0],
            fontSize: selectedNode.fontSize || 16,
            fontWeight: selectedNode.fontWeight || 'normal',
            fontStyle: selectedNode.fontStyle || 'normal',
            textColor: selectedNode.textColor || '#0f172a'
        };
        StorageService.saveNoteDefaults(defaults);
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 1500);
    }, [selectedNode]);

    // Render logic depends on combination of Mode + Selection
    let innerContent = null;

    if (mode === CONFIG.MODES.SELECT || mode === CONFIG.MODES.TEXT) {
        if (!selectedNode) return null; // Nothing to show if nothing selected in select mode

        if (selectedNode.type === 'note') {
            innerContent = (
                <>
                    {CONFIG.COLORS_NOTE.map(c => (
                        <button 
                            key={c} title="Note Color"
                            className={`color-swatch ${selectedNode.color === c ? 'is-active' : ''}`} 
                            style={{ backgroundColor: c }}
                            onClick={() => handleColorClick(c)}
                        />
                    ))}
                    <input 
                        type="color" title="Custom Note Color" value={selectedNode.color || '#ffffff'}
                        onChange={e => handleColorClick(e.target.value)}
                        className="color-picker-input"
                        style={{ marginLeft: 4 }}
                    />
                    <div className="divider-v" />
                    <select 
                        className="select-ui" title="Font Family"
                        value={selectedNode.font || CONFIG.FONTS[0]}
                        onChange={(e) => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { font: e.target.value }})}
                    >
                        {CONFIG.FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select 
                        className="select-ui" title="Font Size"
                        value={selectedNode.fontSize || 16}
                        onChange={(e) => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { fontSize: parseInt(e.target.value) }})}
                        style={{ marginLeft: 4 }}
                    >
                        {[12, 14, 16, 18, 20, 24, 32, 48].map(s => <option key={s} value={s}>{s}px</option>)}
                    </select>
                    <div className="divider-v" />
                    <button 
                        className={`btn-icon ${selectedNode.fontWeight === 'bold' ? 'is-active' : ''}`} title="Bold"
                        onClick={() => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { fontWeight: selectedNode.fontWeight === 'bold' ? 'normal' : 'bold' }})}
                    >
                        <strong style={{ fontFamily: 'serif', fontSize: 16 }}>B</strong>
                    </button>
                    <button 
                        className={`btn-icon ${selectedNode.fontStyle === 'italic' ? 'is-active' : ''}`} title="Italic"
                        onClick={() => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { fontStyle: selectedNode.fontStyle === 'italic' ? 'normal' : 'italic' }})}
                    >
                        <em style={{ fontFamily: 'serif', fontSize: 16 }}>I</em>
                    </button>
                    <div className="divider-v" />
                    <span className="prop-label">Text</span>
                    <input 
                        type="color" title="Note Text Color" value={selectedNode.textColor || '#0f172a'}
                        onChange={e => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { textColor: e.target.value }})}
                        className="color-picker-input"
                    />
                    <div className="divider-v" />
                    <button 
                        className={`btn-icon btn-save-default ${savedFeedback ? 'is-saved' : ''}`}
                        title="Save current settings as default for new notes"
                        onClick={handleSaveDefaults}
                    >
                        {savedFeedback ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                            <Save size={16} />
                        )}
                    </button>
                    <button className="btn-icon is-danger" title="Delete Note" onClick={handleDelete}><Trash2 size={16} /></button>
                </>
            );
        } else if (selectedNode.type === 'image') {
            innerContent = (
                <button className="btn-icon is-danger" title="Delete Image" onClick={handleDelete}><Trash2 size={18} /> Delete Image</button>
            );
        } else if (selectedNode.type === 'text') {
            innerContent = (
                <>
                    {CONFIG.COLORS_TEXT.map(c => (
                        <button 
                            key={c} title="Text Color"
                            className={`color-swatch ${selectedNode.color === c ? 'is-active' : ''}`} 
                            style={{ backgroundColor: c }}
                            onClick={() => handleColorClick(c)}
                        />
                    ))}
                    <div className="divider-v" />
                    <select 
                        className="select-ui" title="Font Family"
                        value={selectedNode.font || CONFIG.FONTS[0]}
                        onChange={(e) => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { font: e.target.value }})}
                    >
                        {CONFIG.FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select 
                        className="select-ui" title="Font Size"
                        value={selectedNode.fontSize || 32}
                        onChange={(e) => dispatch({ type: 'UPDATE_NODE', id: selectionId, payload: { fontSize: parseInt(e.target.value) }})}
                    >
                        {[16, 24, 32, 48, 64, 96, 128].map(s => <option key={s} value={s}>{s}px</option>)}
                    </select>
                    <div className="divider-v" />
                    <button className="btn-icon is-danger" title="Delete Text" onClick={handleDelete}><Trash2 size={18} /></button>
                </>
            );
        }
    } else if (mode === CONFIG.MODES.DRAW) {
        innerContent = (
            <>
                {CONFIG.COLORS_BRUSH.map(c => (
                    <button 
                        key={c} title="Brush Color"
                        className={`color-swatch ${brush.color === c ? 'is-active' : ''}`} 
                        style={{ backgroundColor: c }}
                        onClick={() => handleColorClick(c)}
                    />
                ))}
                <input 
                    type="color" title="Custom Brush Color" value={brush.color}
                    onChange={e => dispatch({ type: 'SET_BRUSH', payload: { color: e.target.value }})}
                    className="color-picker-input"
                />
                <div className="divider-v" />
                <div className="brush-slider-group">
                    <span className="slider-label">{brush.size}px</span>
                    <input 
                        type="range" min="2" max="60" value={brush.size} title="Brush Size"
                        onChange={e => dispatch({ type: 'SET_BRUSH', payload: { size: parseInt(e.target.value, 10) }})} 
                        className="range-ui"
                    />
                </div>
            </>
        );
    } else {
        return null;
    }

    return (
        <div className="glass-panel properties-bar ui-layer-ignore">
            {innerContent}
        </div>
    );
}

export function ZoomControl() {
    const { viewport } = useContext(BoardContext);
    const dispatch = useContext(BoardDispatch);

    const zoomIn = () => dispatch({ type: 'SET_VIEWPORT', payload: { ...viewport, zoom: Math.min(5, viewport.zoom + 0.1) } });
    const zoomOut = () => dispatch({ type: 'SET_VIEWPORT', payload: { ...viewport, zoom: Math.max(0.1, viewport.zoom - 0.1) } });
    const resetZoom = () => dispatch({ type: 'SET_VIEWPORT', payload: { x: 0, y: 0, zoom: 1 } });

    return (
        <div className="glass-panel zoom-control ui-layer-ignore">
            <button className="btn-icon btn-small" onClick={zoomOut}>-</button>
            <span className="zoom-text" onClick={resetZoom} title="Reset view">
                {Math.round(viewport.zoom * 100)}%
            </span>
            <button className="btn-icon btn-small" onClick={zoomIn}>+</button>
        </div>
    );
}
