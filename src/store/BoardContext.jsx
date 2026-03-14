import React, { createContext, useContext, useReducer, useEffect, useState, useCallback } from 'react';
import { CONFIG, StorageService } from '../services/StorageService';

export const BoardContext = createContext();
export const BoardDispatch = createContext();

const initialBoardState = {
    nodes: [],       // Array of { type: 'note'|'image'|'text', id, x, y, w, h, ...data }
    paths: [],       // Array of { id, color, size, points }
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: CONFIG.MODES.SELECT,
    brush: { color: CONFIG.COLORS_BRUSH[0], size: 4 },
    selectionId: null,
    isDarkTheme: false,
    showGrid: true,
};

// Undo/Redo Wrapper structure: { past: [], present: State, future: [] }
const initialUndoableState = {
    past: [],
    present: initialBoardState,
    future: []
};

// Which actions should trigger a save to the history stack
const isUndoableAction = (type) => {
    return ['ADD_NODE', 'UPDATE_NODE', 'DELETE_NODE', 'ADD_PATH', 'DELETE_PATH', 'SET_THEME'].includes(type);
};

function boardReducer(state, action) {
    if (action.type === 'HYDRATE') {
        return {
            past: [],
            present: { ...initialBoardState, ...action.payload },
            future: []
        };
    }

    if (action.type === 'UNDO') {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        return {
            past: newPast,
            present: previous,
            future: [state.present, ...state.future]
        };
    }

    if (action.type === 'REDO') {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        return {
            past: [...state.past, state.present],
            present: next,
            future: newFuture
        };
    }

    // Process normal actions on the 'present' state
    const present = state.present;
    let newPresent = present;

    switch (action.type) {
        case 'SET_MODE':
            newPresent = { ...present, mode: action.payload, selectionId: null };
            break;
        case 'SET_VIEWPORT':
            newPresent = { ...present, viewport: action.payload };
            break;
        case 'SET_SELECTION':
            newPresent = { ...present, selectionId: action.payload };
            break;
        case 'SET_BRUSH':
            newPresent = { ...present, brush: { ...present.brush, ...action.payload } };
            break;
        case 'SET_THEME':
            newPresent = { ...present, ...action.payload }; // e.g., { isDarkTheme: true } or { showGrid: false }
            break;
        
        // Nodes
        case 'ADD_NODE':
            newPresent = { ...present, nodes: [...present.nodes, action.payload], selectionId: action.payload.id, mode: CONFIG.MODES.SELECT };
            break;
        case 'UPDATE_NODE':
            newPresent = { ...present, nodes: present.nodes.map(n => n.id === action.id ? { ...n, ...action.payload } : n) };
            break;
        case 'DELETE_NODE':
            newPresent = { ...present, nodes: present.nodes.filter(n => n.id !== action.id), selectionId: present.selectionId === action.id ? null : present.selectionId };
            break;
        
        // Paths
        case 'ADD_PATH':
            newPresent = { ...present, paths: [...present.paths, action.payload] };
            break;
        case 'DELETE_PATH':
            newPresent = { ...present, paths: present.paths.filter(p => p.id !== action.id) };
            break;
            
        default:
            return state;
    }

    // If state didn't change identity, return as is
    if (newPresent === present) return state;

    // If it's an undoable action, push current present to past before updating
    if (isUndoableAction(action.type)) {
        // Cap history at 50 to save memory
        const newPast = [...state.past, present];
        if (newPast.length > 50) newPast.shift();
        
        return {
            past: newPast,
            present: newPresent,
            future: [] // Any new action clears the redo stack
        };
    }

    // Non-undoable action (like selection, viewport change), just update present
    return {
        ...state,
        present: newPresent
    };
}

export function BoardProvider({ children }) {
    const [state, dispatch] = useReducer(boardReducer, initialUndoableState);
    const [isHydrated, setIsHydrated] = useState(false);

    // Initial Hydration from DB
    useEffect(() => {
        let mounted = true;
        StorageService.loadState('workspace').then(saved => {
            if (mounted) {
                if (saved) {
                    dispatch({ type: 'HYDRATE', payload: saved });
                }
                setIsHydrated(true);
            }
        });
        return () => { mounted = false; };
    }, []);

    // Autosave latest layout
    useEffect(() => {
        if (!isHydrated) return;
        const timer = setTimeout(() => {
            // We only save the 'present' state to DB
            StorageService.saveState('workspace', state.present);
        }, 1500);
        return () => clearTimeout(timer);
    }, [state.present, isHydrated]);
    
    // Keyboard shortcuts for Undo/Redo and Delete
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Check if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    dispatch({ type: 'REDO' });
                } else {
                    dispatch({ type: 'UNDO' });
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                dispatch({ type: 'REDO' });
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                // Delete the currently selected node if any
                const currentSelection = state.present.selectionId;
                if (currentSelection) {
                    dispatch({ type: 'DELETE_NODE', id: currentSelection });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.present.selectionId]);

    if (!isHydrated) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', color: '#64748b', fontSize: '18px', fontFamily: 'Inter, sans-serif' }}>
                Initializing Workspace...
            </div>
        );
    }

    // Extra helpers to pass down via dispatch context
    const dispatchEnhanced = (action) => dispatch(action);
    dispatchEnhanced.canUndo = state.past.length > 0;
    dispatchEnhanced.canRedo = state.future.length > 0;
    dispatchEnhanced.undo = () => dispatch({ type: 'UNDO' });
    dispatchEnhanced.redo = () => dispatch({ type: 'REDO' });

    return (
        <BoardDispatch.Provider value={dispatchEnhanced}>
            <BoardContext.Provider value={state.present}>
                {children}
            </BoardContext.Provider>
        </BoardDispatch.Provider>
    );
}
