import React, { useContext, useCallback } from 'react';
import { BoardContext, BoardDispatch } from '../../store/BoardContext';
import { CONFIG, generateId, StorageService } from '../../services/StorageService';
import { 
    MousePointer2, Edit2, Eraser, StickyNote, Type, Image as ImageIcon,
    Undo2, Redo2, Download, Upload, Moon, Sun, Grid3x3
} from 'lucide-react';

export function MainMenu() {
    const state = useContext(BoardContext);
    const { mode, viewport, isDarkTheme, showGrid } = state;
    const dispatchEnhanced = useContext(BoardDispatch);
    const dispatch = dispatchEnhanced;

    const setMode = (m) => dispatch({ type: 'SET_MODE', payload: m });

    const addNote = useCallback(() => {
        const w = 260, h = 220;
        const saved = StorageService.loadNoteDefaults();
        const noteData = { 
            type: 'note', id: generateId(), 
            x: (-viewport.x + window.innerWidth / 2) / viewport.zoom - w/2, 
            y: (-viewport.y + window.innerHeight / 2) / viewport.zoom - h/2, 
            w, h, text: '', 
            color: saved?.color || CONFIG.COLORS_NOTE[0], 
            font: saved?.font || CONFIG.FONTS[0],
            fontSize: saved?.fontSize || 16,
            fontWeight: saved?.fontWeight || 'normal',
            fontStyle: saved?.fontStyle || 'normal',
            textColor: saved?.textColor || '#0f172a'
        };
        dispatch({ type: 'ADD_NODE', payload: noteData });
    }, [viewport, dispatch]);

    const addText = useCallback(() => {
        dispatch({ type: 'SET_MODE', payload: CONFIG.MODES.TEXT });
        // The actual text node creation handles on click over the board
    }, [dispatch]);

    const addImage = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > 500) { h = h * (500 / w); w = 500; }
                dispatch({ type: 'ADD_NODE', payload: { 
                    type: 'image', id: generateId(), src: ev.target.result,
                    x: (-viewport.x + window.innerWidth / 2) / viewport.zoom - w/2, 
                    y: (-viewport.y + window.innerHeight / 2) / viewport.zoom - h/2, 
                    w, h 
                }});
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = null;
    }, [viewport, dispatch]);

    const handleExport = () => {
        StorageService.exportProject(state);
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const parsed = await StorageService.importProject(file);
            // Quick validation
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) {
                dispatch({ type: 'HYDRATE', payload: parsed });
            } else {
                alert("Invalid project file.");
            }
        } catch(err) {
            alert("Failed to let project file.");
        }
        e.target.value = null;
    };

    return (
        <div className="glass-panel main-menu ui-layer-ignore">
            <div className="menu-group">
                <button title="Select / Pan (V)" className={`btn-icon ${mode === CONFIG.MODES.SELECT ? 'is-active' : ''}`} onClick={() => setMode(CONFIG.MODES.SELECT)}><MousePointer2 size={20} /></button>
                <button title="Draw (B)" className={`btn-icon ${mode === CONFIG.MODES.DRAW ? 'is-active' : ''}`} onClick={() => setMode(CONFIG.MODES.DRAW)}><Edit2 size={20} /></button>
                <button title="Text (T)" className={`btn-icon ${mode === CONFIG.MODES.TEXT ? 'is-active' : ''}`} onClick={addText}><Type size={20} /></button>
                <button title="Erase (E)" className={`btn-icon ${mode === CONFIG.MODES.ERASE ? 'is-active' : ''}`} onClick={() => setMode(CONFIG.MODES.ERASE)}><Eraser size={20} /></button>
            </div>
            
            <div className="divider-h" />
            
            <div className="menu-group">
                <button title="Add Sticky Note" className="btn-icon" onClick={addNote}><StickyNote size={20} /></button>
                <label title="Add Image" className="btn-icon">
                    <ImageIcon size={20} />
                    <input type="file" hidden accept="image/*" onChange={addImage} />
                </label>
            </div>

            <div className="divider-h" />

            <div className="menu-group">
                <button title="Undo (Ctrl+Z)" className="btn-icon" disabled={!dispatchEnhanced.canUndo} onClick={dispatchEnhanced.undo}><Undo2 size={20} /></button>
                <button title="Redo (Ctrl+Y)" className="btn-icon" disabled={!dispatchEnhanced.canRedo} onClick={dispatchEnhanced.redo}><Redo2 size={20} /></button>
            </div>

            <div className="divider-h" />

            <div className="menu-group">
                <button title="Toggle Theme" className="btn-icon" onClick={() => dispatch({ type: 'SET_THEME', payload: { isDarkTheme: !isDarkTheme }})}>
                    {isDarkTheme ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button title="Toggle Grid" className={`btn-icon ${showGrid ? 'is-active' : ''}`} onClick={() => dispatch({ type: 'SET_THEME', payload: { showGrid: !showGrid }})}>
                    <Grid3x3 size={20} />
                </button>
            </div>

            <div className="divider-h" />

            <div className="menu-group">
                <button title="Save Project to File" className="btn-icon" onClick={handleExport}><Download size={20} /></button>
                <label title="Load Project from File" className="btn-icon">
                    <Upload size={20} />
                    <input type="file" hidden accept=".json" onChange={handleImport} />
                </label>
            </div>
        </div>
    );
}
