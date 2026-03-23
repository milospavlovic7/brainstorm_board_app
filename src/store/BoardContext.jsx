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
    selectionIds: [],   // Array of selected node/path IDs (multi-select)
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
    return ['ADD_NODE', 'UPDATE_NODE', 'DELETE_NODE', 'ADD_PATH', 'DELETE_PATH', 'SET_THEME', 'MOVE_SELECTION'].includes(type);
};

function boardReducer(state, action) {
    if (action.type === 'HYDRATE') {
        const hydratedPresent = { ...initialBoardState, ...action.payload };
        // Migrate old selectionId → selectionIds
        if (!hydratedPresent.selectionIds) {
            hydratedPresent.selectionIds = hydratedPresent.selectionId ? [hydratedPresent.selectionId] : [];
        }
        delete hydratedPresent.selectionId;
        // Normalise path points: old saves used {x,y} objects, new code uses [x,y] arrays
        if (hydratedPresent.paths) {
            hydratedPresent.paths = hydratedPresent.paths.map(p => ({
                ...p,
                points: p.points.map(pt => Array.isArray(pt) ? pt : [pt.x, pt.y])
            }));
        }
        return { past: [], present: hydratedPresent, future: [] };
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
            newPresent = { ...present, mode: action.payload, selectionIds: [] };
            break;
        case 'SET_VIEWPORT':
            newPresent = { ...present, viewport: action.payload };
            break;
        case 'SET_SELECTION':
            // payload: single id or null
            newPresent = { ...present, selectionIds: action.payload ? [action.payload] : [] };
            break;
        case 'SET_MULTI_SELECTION':
            // payload: array of ids
            newPresent = { ...present, selectionIds: action.payload || [] };
            break;
        case 'SET_BRUSH':
            newPresent = { ...present, brush: { ...present.brush, ...action.payload } };
            break;
        case 'SET_THEME':
            newPresent = { ...present, ...action.payload }; // e.g., { isDarkTheme: true } or { showGrid: false }
            break;
        
        // Nodes
        case 'ADD_NODE':
            newPresent = { ...present, nodes: [...present.nodes, action.payload], selectionIds: [action.payload.id], mode: CONFIG.MODES.SELECT };
            break;
        case 'UPDATE_NODE':
            newPresent = { ...present, nodes: present.nodes.map(n => n.id === action.id ? { ...n, ...action.payload } : n) };
            break;
        case 'DELETE_NODE':
            newPresent = { ...present, nodes: present.nodes.filter(n => n.id !== action.id), selectionIds: present.selectionIds.filter(id => id !== action.id) };
            break;
        
        // Paths
        case 'ADD_PATH':
            newPresent = { ...present, paths: [...present.paths, action.payload] };
            break;
        case 'DELETE_PATH':
            newPresent = { ...present, paths: present.paths.filter(p => p.id !== action.id), selectionIds: present.selectionIds.filter(id => id !== action.id) };
            break;

        // Move all currently selected nodes + paths by dx, dy (in board coordinates)
        case 'MOVE_SELECTION': {
            const { dx, dy } = action.payload;
            const ids = new Set(present.selectionIds);
            const newNodes = present.nodes.map(n =>
                ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
            );
            const newPaths = present.paths.map(p => {
                if (!ids.has(p.id)) return p;
                return {
                    ...p,
                    // Handle both [x,y] arrays and legacy {x,y} objects
                    points: p.points.map(pt => {
                        const px = Array.isArray(pt) ? pt[0] : pt.x;
                        const py = Array.isArray(pt) ? pt[1] : pt.y;
                        return [px + dx, py + dy];
                    })
                };
            });
            newPresent = { ...present, nodes: newNodes, paths: newPaths };
            break;
        }
            
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
            // Check if user is typing in an input or a contentEditable div
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) {
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
                const currentIds = state.present.selectionIds;
                // Delete all selected nodes
                currentIds.forEach(id => {
                    const isNode = state.present.nodes.some(n => n.id === id);
                    const isPath = state.present.paths.some(p => p.id === id);
                    if (isNode) dispatch({ type: 'DELETE_NODE', id });
                    if (isPath) dispatch({ type: 'DELETE_PATH', id });
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.present.selectionIds, state.present.nodes, state.present.paths]);

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
