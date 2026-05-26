import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../utils/useAPI';

interface Note {
  id: string;
  title: string;
  content: any;
  updated_at: string;
  parent_id?: string | null;
}

interface Block {
  id: string;
  type: 'text' | 'h1' | 'h2' | 'h3' | 'image' | 'note' | 'bullet-list';
  content: string;
}


const BlockInput = ({ block, index, isFocused, isSelected, updateBlock, onKeyDown, onFocusNext, onFocusPrev, onManualFocus, onMouseEnter, onPaste, onNavigateNote, getNoteTitle }: { 
    block: Block, 
    index: number,
    isFocused: boolean,
    isSelected: boolean,
    updateBlock: (id: string, content: string) => void,
    onKeyDown: (e: React.KeyboardEvent, index: number) => void,
    onFocusNext: (current: number, isShift: boolean) => void,
    onFocusPrev: (current: number, isShift: boolean) => void,
    onManualFocus: (isShift: boolean) => void,
    onMouseEnter: () => void,
    onPaste: (e: React.ClipboardEvent) => void,
    onNavigateNote: (noteId: string) => void,
    getNoteTitle: (id: string) => string
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const noteContainerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [block.content]);

    useEffect(() => {
        if (isFocused) {
            if (textareaRef.current) {
                textareaRef.current.focus();
            } else if (imageContainerRef.current) {
                imageContainerRef.current.focus();
            } else if (noteContainerRef.current) {
                noteContainerRef.current.focus();
            }
        }
    }, [isFocused]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'ArrowDown') {
            const val = e.currentTarget.value;
            const start = e.currentTarget.selectionStart;
            // "At the end or in the last paragraph"
            // We check if there is no newline character after the cursor position.
            if (val.slice(start).indexOf('\n') === -1) {
                // We are in the last logical paragraph
                e.preventDefault();
                onFocusNext(index, e.shiftKey);
                return;
            }
        }
        if (e.key === 'ArrowUp') {
            const val = e.currentTarget.value;
            const start = e.currentTarget.selectionStart;
            // Check if there is no newline before the cursor
            if (val.slice(0, start).lastIndexOf('\n') === -1) {
                e.preventDefault();
                onFocusPrev(index, e.shiftKey);
                return;
            }
        }
        onKeyDown(e, index);
    };

    if (block.type === 'image') {
        const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                   updateBlock(block.id, reader.result as string);
                };
                reader.readAsDataURL(file);
            }
        };

        const handleImageKeyDown = (e: React.KeyboardEvent) => {
             if (e.key === 'ArrowDown') {
                 e.preventDefault();
                 onFocusNext(index, e.shiftKey);
             } else if (e.key === 'ArrowUp') {
                 e.preventDefault();
                 onFocusPrev(index, e.shiftKey);
             } else {
                 onKeyDown(e, index);
             }
        };

        return (
            <div 
                ref={imageContainerRef}
                tabIndex={0}
                onKeyDown={handleImageKeyDown}
                className={`block-input type-image ${isSelected ? 'selected' : ''}`}
                style={{ 
                    border: isSelected ? '2px solid var(--accent)' : 'none',
                    padding: '10px',
                    borderRadius: '4px',
                    outline: 'none',
                    backgroundColor: isSelected ? 'var(--accent-weak)' : 'transparent'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onManualFocus(e.shiftKey);
                }}
            >
                {block.content ? (
                    <img src={block.content} alt="User content" style={{ maxWidth: '100%', borderRadius: '4px' }} />
                ) : (
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="file-input"
                        style={{ color: 'var(--text-secondary)' }}
                    />
                )}
            </div>
        );
    }

    if (block.type === 'note') {
        const handleNoteClick = () => {
             // Block content should be JSON { title: ..., id: ... } for display, 
             // but 'onNavigateNote' only needs ID
             try {
                const noteInfo = JSON.parse(block.content);
                if (noteInfo && noteInfo.id) {
                    onNavigateNote(noteInfo.id);
                }
             } catch (e) {
                console.error("Invalid note block content", e);
             }
        };
        
        const handleNoteKey = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleNoteClick();
            } else if (e.key === 'ArrowDown') {
                 e.preventDefault();
                 onFocusNext(index, e.shiftKey);
             } else if (e.key === 'ArrowUp') {
                 e.preventDefault();
                 onFocusPrev(index, e.shiftKey);
             } else {
                 onKeyDown(e, index);
             }
        };

        const noteInfo = (() => {
            try { return JSON.parse(block.content) } catch { return { title: 'Untitled Note', id: '' } } 
        })();

        // Try to get live title if available
        const displayTitle = getNoteTitle(noteInfo.id) || noteInfo.title || 'Untitled';


        return (
             <div 
                ref={noteContainerRef}
                tabIndex={0}
                onKeyDown={handleNoteKey}
                className={`block-input type-note ${isSelected ? 'selected' : ''}`}
                style={{ 
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: '10px',
                    borderRadius: '4px',
                    outline: 'none',
                    backgroundColor: isSelected ? 'var(--accent-weak)' : 'var(--card-bg)',
                    color: 'var(--text-primary)', // Always light text for dark note block
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '5px'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                        onManualFocus(true);
                    } else {
                        handleNoteClick();
                        onManualFocus(false); 
                    }
                }}
            >
                <span style={{ fontSize: '1.2em' }}>📄</span>
                <span style={{ fontWeight: 500, textDecoration: 'underline', color: 'var(--accent)' }}>{displayTitle}</span>
            </div>
        );
    }

    const isBullet = block.type === 'bullet-list';

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            {isBullet && (
                <span style={{ 
                    marginRight: '8px', 
                    marginLeft: '8px', 
                    marginTop: '2px', // Align with text
                    fontSize: '1em', 
                    color: 'var(--text-secondary)',
                    userSelect: 'none'
                }}>•</span>
            )}
            <textarea
                ref={textareaRef}
                className={`block-input type-${block.type} ${isSelected ? 'selected' : ''}`}
                value={block.content || ''}
                onChange={e => updateBlock(block.id, e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => {
                     onManualFocus(e.shiftKey);
                }}
                onMouseDown={(e) => {
                    if (e.shiftKey) {
                        e.preventDefault();
                        onManualFocus(true);
                    } else {
                        onManualFocus(false);
                    }
                }}
                onMouseEnter={(e) => {
                    if (e.buttons === 1) { 
                        onMouseEnter();
                    }
                }}
                onPaste={onPaste}
                placeholder={block.type === 'text' ? "Type '/' for commands" : (isBullet ? "List item" : `Heading ${block.type.replace('h', '')}`)}
                rows={1}
                style={{ 
                    resize: 'none', 
                    overflow: 'hidden',
                    backgroundColor: isSelected ? 'rgba(170, 59, 255, 0.1)' : 'transparent',
                    flex: 1, // Take remaining space
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    padding: 0,
                    margin: 0,
                    lineHeight: '1.5'
                }}
            />
        </div>
    );
};

const SidebarItem = ({ note, selectedId, onSelect, onDelete }: { note: any, selectedId: string | undefined, onSelect: (n: any) => void, onDelete: (id: string, e: React.MouseEvent) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const hasChildren = note.children && note.children.length > 0;
    const [isHovered, setIsHovered] = useState(false);

    // Auto-expand if a child is selected
    useEffect(() => {
        const containsSelected = (n: any): boolean => {
            if (n.id === selectedId) return true;
            if (n.children && n.children.length > 0) {
                return n.children.some(containsSelected);
            }
            return false;
        };

        if (containsSelected(note)) {
            setExpanded(true);
        }
    }, [selectedId, note]);

    return (
        <li style={{ listStyle: 'none', marginLeft: '10px' }}>
            <div 
                className={selectedId === note.id ? 'active' : ''}
                style={{ 
                    cursor: 'pointer', 
                    padding: '5px', 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: selectedId === note.id ? 'var(--accent-weak)' : 'transparent',
                    borderRadius: '4px',
                    position: 'relative',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(note);
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
               <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', flex: 1 }}>
                    {hasChildren ? (
                        <span 
                                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                                style={{ marginRight: '5px', fontSize: '0.8em', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
                        >
                            {expanded ? '▼' : '▶'}
                        </span>
                    ) : (
                        <span style={{ width: '15px', flexShrink: 0 }}></span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.title || "Untitled"}
                    </span>
               </div>
               
               {isHovered && (
                   <button
                        onClick={(e) => onDelete(note.id, e)}
                        style={{
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1em',
                            padding: '0 5px',
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 0
                        }}
                        title="Delete page"
                   >
                       🗑️
                   </button>
               )}
            </div>
            {expanded && hasChildren && (
                <ul className="notes-list-nested" style={{ paddingLeft: '0', marginTop: '2px' }}>
                    {note.children.map((child: any) => (
                        <SidebarItem key={child.id} note={child} selectedId={selectedId} onSelect={onSelect} onDelete={onDelete} />
                    ))}
                </ul>
            )}
        </li>
    );
};

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([{ id: crypto.randomUUID(), type: 'text', content: '' }]);
  const [title, setTitle] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number>(-1);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
    const { token } = useAuth();
  const navigate = useNavigate();
  const { fetchAPI } = useAPI();
  // const editorRef = useRef<HTMLElement>(null); // Not used currently
  const titleInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusTitleRef = useRef(false);
  
  const [isMouseSelecting, setIsMouseSelecting] = useState(false);

    useEffect(() => {
        document.body.classList.add('notes-page');

        return () => {
            document.body.classList.remove('notes-page');
        };
    }, []);

  // History state for Undo/Redo. Limit 50 steps.
  const [history, setHistory] = useState<Block[][]>([[{ id: crypto.randomUUID(), type: 'text', content: '' }]]);
  // Pointer to current state in history
  const [historyPointer, setHistoryPointer] = useState(0);
  
  // Ref to ignore updates triggered by undo/redo
  const isUndoing = useRef(false);

  // Centralized History Update
  useEffect(() => {
    if (isUndoing.current) {
        isUndoing.current = false;
        return;
    }

    const currentTip = history[historyPointer];
    // Avoid duplicates
    if (JSON.stringify(blocks) === JSON.stringify(currentTip)) return;

    // Detect structure vs content change
    const isStructureChange = blocks.length !== currentTip?.length || 
                              blocks.some((b, i) => b.id !== currentTip[i]?.id || b.type !== currentTip[i]?.type);

    // Structure change -> Fast (50ms)
    // Word break (Space/Enter) -> Fast (100ms)
    // Typing -> Slow (800ms)
    let timeoutDuration = 800;

    if (isStructureChange) {
        timeoutDuration = 50;
    } else {
        // Find the block that changed
        const index = blocks.findIndex((b, i) => b.content !== currentTip[i]?.content);
        if (index !== -1) {
             const changedBlock = blocks[index];
             const oldContent = currentTip[index]?.content || "";
             // If we added a space or newline, treat as word break
             if (changedBlock.content.length > oldContent.length && 
                (changedBlock.content.endsWith(' ') || changedBlock.content.endsWith('\n'))) {
                 timeoutDuration = 200;
             }
        }
    }

    const handler = setTimeout(() => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyPointer + 1);
            newHistory.push(blocks);
            if (newHistory.length > 50) newHistory.shift();
            return newHistory;
        });
        setHistoryPointer(prev => {
             const next = prev + 1;
             return next >= 50 ? 49 : next;
        });
    }, timeoutDuration);

    return () => clearTimeout(handler);
  }, [blocks]); // Only run when blocks change
  
  // Global key listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.defaultPrevented) return; 

        // Define hasSelection here for reuse
        const hasSelection = selectionAnchor !== null && selectionAnchor !== focusedBlockIndex;

        // Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z or Ctrl+Y)
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Redo
                    if (historyPointer < history.length - 1) {
                         isUndoing.current = true;
                         const next = historyPointer + 1;
                         setBlocks(history[next]);
                         setHistoryPointer(next);
                    }
                } else {
                    // Undo
                    if (historyPointer > 0) {
                         isUndoing.current = true;
                         const prev = historyPointer - 1;
                         setBlocks(history[prev]);
                         setHistoryPointer(prev);
                    }
                }
                return;
            } else if (e.key.toLowerCase() === 'y') {
                // Warning: some browsers map Ctrl+Y to Redo
                e.preventDefault();
                 if (historyPointer < history.length - 1) {
                        isUndoing.current = true;
                        const next = historyPointer + 1;
                        setBlocks(history[next]);
                        setHistoryPointer(next);
                }
                return;
            }
        }

        // Deselect on Escape, Enter, or Space if multiple blocks selected
        if (hasSelection && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
            setSelectionAnchor(null);
            if (e.key === 'Escape') e.preventDefault();
            // Allow Enter/Space to propagate to input for valid typing
        }

        // Global backspace prevention and selection deletion
        if (e.key === 'Backspace') {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
            // If we have a multi-block selection, we want to delete blocks, not backspace text in one block
            if (hasSelection) {
                 e.preventDefault();
                 const start = Math.min(selectionAnchor, focusedBlockIndex);
                 const end = Math.max(selectionAnchor, focusedBlockIndex);
                 
                 const newBlocks = blocks.filter((_, i) => i < start || i > end);
                 // If resulting block is empty...
                 if (newBlocks.length === 0) {
                     newBlocks.push({ id: generateId(), type: 'text', content: '' });
                 }
                 setBlocks(newBlocks);
                 setSelectionAnchor(null);
                 setFocusedBlockIndex(start > 0 ? start - 1 : 0);
                 return;
            }

            // Prevent browser back navigation if not in an input
            if (!isInput) {
                e.preventDefault();
                // If a non-text block is focused (like an image), delete it on Backspace
                if (focusedBlockIndex !== -1 && blocks[focusedBlockIndex]?.type !== 'text') {
                     if (blocks.length > 1) {
                        const newBlocks = blocks.filter((_, i) => i !== focusedBlockIndex);
                        setBlocks(newBlocks);
                        setFocusedBlockIndex(Math.max(0, focusedBlockIndex - 1));
                     } else {
                         // If it's the last block, maybe convert to text?
                         setBlocks([{ id: generateId(), type: 'text', content: '' }]);
                     }
                }
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectionAnchor, focusedBlockIndex, blocks, history, historyPointer]);


  // Global mouse up for selection end
  useEffect(() => {
    const handleMouseUp = () => setIsMouseSelecting(false);
    
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Fetch notes
  useEffect(() => {
    if (!token) return;
    fetchAPI(`/api/notes`)
    .then(res => res.json())
    .then(data => {
        if (Array.isArray(data)) setNotes(data);
    })
    .catch(console.error);
  }, [token, fetchAPI]);

  const generateId = () => {
    return crypto.randomUUID();
  };

  const createNote = async () => {
    if (!token) return;
    const initialBlocks = [{ id: generateId(), type: 'text', content: "" }];
    const newNote = { title: "Untitled", content: initialBlocks };
    
        try {
                const res = await fetchAPI(`/api/notes`, {
          method: 'POST',
          body: JSON.stringify(newNote)
        });
        
        if (res.ok) {
            const savedNote = await res.json();
            setNotes(prev => [savedNote, ...prev]);
            selectNote(savedNote, true, true);
        } else {
            console.error("Failed to create note:", await res.text());
        }
    } catch (e) {
        console.error("Error creating note:", e);
    }
  };

  const deleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm("Are you sure you want to delete this page and all its subpages?")) return;

    try {
        const res = await fetchAPI(`/api/notes/${noteId}`, {
          method: 'DELETE'
        });
        
        if (res.ok) {
             setNotes(prev => {
                const getDescendants = (parentId: string, currentNotes: Note[]): string[] => {
                   const children = currentNotes.filter(n => n.parent_id === parentId);
                   let desc: string[] = children.map(c => c.id);
                   children.forEach(child => {
                       desc = [...desc, ...getDescendants(child.id, currentNotes)];
                   });
                   return desc;
                };

                const descendants = [noteId, ...getDescendants(noteId, prev)];
                
                // If the selected note is among those being deleted, clear it
                if (selectedNote && descendants.includes(selectedNote.id)) {
                    setSelectedNote(null);
                    setTitle('');
                    setBlocks([]);
                }

                return prev.filter(n => !descendants.includes(n.id));
             });
        }
    } catch (e) {
        console.error("Error deleting note:", e);
    }
  };

  const createSubNote = async (blockIndex: number) => {
    console.log("createSubNote: Function started for block index:", blockIndex);
    if (!token || !selectedNote) {
        console.warn("createSubNote: Token or selectedNote missing");
        return;
    }
    
    // Fallback ID generator if crypto fails
    const safeGenerateId = () => {
        try { return crypto.randomUUID(); } 
        catch { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
    };

    const initialBlocks = [{ id: safeGenerateId(), type: 'text', content: "" }];
    const newNote = { title: "Untitled Subpage", content: initialBlocks, parent_id: selectedNote.id };

    console.log("createSubNote: Posting new note to API:", newNote);

        try {
                const res = await fetchAPI(`/api/notes`, {
          method: 'POST',
          body: JSON.stringify(newNote)
        });
        
        if (res.ok) {
            const savedNote = await res.json();
            console.log("createSubNote: Subnote created:", savedNote);
            
            // Refetch all notes to ensure hierarchy is up to date
            const notesRes = await fetchAPI(`/api/notes`);
            if (notesRes.ok) {
                const allNotes = await notesRes.json();
                console.log("createSubNote: Notes list updated, count:", allNotes.length);
                setNotes(allNotes);
            } else {
                // Fallback if fetch fails
                setNotes(prev => [savedNote, ...prev]);
            }
            
            // 2. IMPORTANT: Save parent note immediately to persist the link!
            // We use the current 'blocks' state (which contains the trigger text like '/page')
            // and replace that block with the Link Block.
            const blocksForSave = [...blocks];
            
            // Ensure we are not accessing out of bounds
            if (blockIndex >= 0 && blockIndex < blocksForSave.length) {
                blocksForSave[blockIndex] = {
                    ...blocksForSave[blockIndex],
                    type: 'note',
                    content: JSON.stringify({ id: savedNote.id, title: savedNote.title })
                };
            }
            
            // Add a new text block if we are at the end
            if (blockIndex === blocksForSave.length - 1) {
                 blocksForSave.push({ id: safeGenerateId(), type: 'text', content: '' });
            }

            console.log("createSubNote: Updating parent blocks locally and remotely:", blocksForSave);

            setBlocks(blocksForSave);
            setFocusedBlockIndex(blockIndex + 1);

            const patchRes = await fetchAPI(`/api/notes/${selectedNote.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: blocksForSave })
            });

            if (!patchRes.ok) {
                 console.error("createSubNote: Failed to patch parent!", await patchRes.text());
                 alert("Error: Link to subpage could not be saved to parent.");
            } else {
                 console.log("createSubNote: Parent patched successfully, navigating to new note.");
                 
                 // 1. Update the parent note in our local notes list so when we return, it has the link
                 setNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, content: blocksForSave } : n));
                 
                 // 2. Navigate to the new note without saving the parent again (since we just did manually)
                 selectNote(savedNote, false, true);
            }

        } else {
            console.error("Failed to create subnote:", await res.text());
            alert("Failed to create subpage.");
        }
    } catch (e) {
        console.error("Error creating subnote:", e);
        alert("Exception creating subpage. See console.");
    }
  };

  const saveNote = async () => {
    if (!selectedNote || !token) return;
    
    // Fallback to "Untitled" if title is empty
    const currentTitle = title.trim() ? title : "Untitled";
    if (!title.trim()) {
        setTitle(currentTitle);
    }
    
    // Optimistic update locally
    const updated = { ...selectedNote, title: currentTitle, content: blocks };
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));

    // Persist to backend
    try {
        await fetchAPI(`/api/notes/${selectedNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: currentTitle, content: blocks })
        });
    } catch (e) {
        console.error("Failed to auto-save note:", e);
    }
  };

  // Auto-save effect
  useEffect(() => {
    // Debounce save operation
    const timeoutId = setTimeout(() => {
        if (selectedNote && token) {
            saveNote();
        }
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(timeoutId);
  }, [blocks, title]); // Re-run when content changes

  const selectNote = (note: Note, saveCurrent = true, focusTitle = false) => {
    // Save previous note state before switching if there was a selection
    if (saveCurrent && selectedNote && blocks.length > 0) {
        // Fire and forget save for the previous note
        // Note: This uses the CLOSURE variables (blocks, title) of the CURRENT render
        // which correspond to the note we are leaving.
        saveNote(); 
    }

    shouldFocusTitleRef.current = focusTitle;
    setSelectedNote(note);
    setTitle(note.title);
    try {
        let content = note.content;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch {
                content = null;
            }
        }
        
        if (Array.isArray(content) && content.length > 0) {
            // Ensure every block has an ID and type
            const safeBlocks = content.map((b: any) => ({
                id: b.id || generateId(),
                type: b.type || 'text',
                content: b.content || ''
            }));
            setBlocks(safeBlocks);
        } else {
            setBlocks([{ id: generateId(), type: 'text', content: '' }]);
        }
    } catch (e) {
        console.error("Error parsing note content:", e);
        setBlocks([{ id: generateId(), type: 'text', content: '' }]);
    }
    // Reset history when switching entries
    setHistory([[{ id: generateId(), type: 'text', content: '' }]]);
    setHistoryPointer(0);
  };
  
  // Effect to focus title on new note
  useEffect(() => {
      if (shouldFocusTitleRef.current && titleInputRef.current) {
          titleInputRef.current.focus();
          // Short timeout to ensure value is set and can be selected
          setTimeout(() => {
              titleInputRef.current?.select();
          }, 0);
          shouldFocusTitleRef.current = false;
      }
  }, [selectedNote]);

  const updateBlock = (id: string, content: string) => {
    // Check for /page command or other commands
    // We check against the literal content being typed
    const index = blocks.findIndex(b => b.id === id);
    if (index !== -1 && blocks[index].type === 'text') {
        if (content === '/page ') {
             createSubNote(index);
             return; 
        }
        if (content === '# ') {
            setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'h1', content: '' } : b));
            return;
        }
        if (content === '## ') {
            setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'h2', content: '' } : b));
            return;
        }
        if (content === '### ') {
            setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'h3', content: '' } : b));
            return;
        }
        if (content === '/image') {
            setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'image', content: '' } : b));
            return;
        }
        if (content === '/list ' || content === '- ') {
            setBlocks(prev => prev.map(b => b.id === id ? { ...b, type: 'bullet-list', content: '' } : b));
            return;
        }
    }

    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b));
  };

  const addBlock = (index: number, content: string = '', type: Block['type'] = 'text') => {
    const newBlock: Block = { id: generateId(), type, content };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
    setFocusedBlockIndex(index + 1);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const newBlocks = [...blocks];
    newBlocks.splice(index, 1);
    setBlocks(newBlocks);
    setFocusedBlockIndex(index - 1 >= 0 ? index - 1 : 0);
  };


  const handleFocus = (index: number, isShift: boolean = false) => {
      // Focus title if going above block 0
      if (index < 0) {
          if (titleInputRef.current) {
              titleInputRef.current.focus();
              setFocusedBlockIndex(-1);
          }
          return;
      }
      if (index >= blocks.length) return;
      
      if (isShift) {
        if (selectionAnchor === null) {
            setSelectionAnchor(focusedBlockIndex !== -1 ? focusedBlockIndex : index);
        }
      } else {
         // If we are merely clicking, reset anchor unless we are dragging?
         // This is handled by onMouseDown logic separately if needed
         if (!isMouseSelecting) {
            setSelectionAnchor(null);
         }
      }
      setFocusedBlockIndex(index);
  };
  
  const handleMouseEnter = (index: number) => {
      if (isMouseSelecting) {
         // If we are selecting, update focus, which updates selection range
         setFocusedBlockIndex(index);
      }
  };

  const isBlockSelected = (index: number) => {
      if (selectionAnchor === null) return false;
      const start = Math.min(selectionAnchor, focusedBlockIndex);
      const end = Math.max(selectionAnchor, focusedBlockIndex);
      return index >= start && index <= end;
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If we have a selection, Enter should clear it? 
      // User requested "deseleccione todo".
      if (selectionAnchor !== null) {
          setSelectionAnchor(null);
      }
      
      if (blocks[index].type === 'bullet-list') {
         if (blocks[index].content === '') {
             // If empty bullet, turn back to text
              setBlocks(prev => prev.map((b, i) => i === index ? { ...b, type: 'text' } : b));
         } else {
              addBlock(index, '', 'bullet-list');
         }
      } else {
         addBlock(index, '');
      }
    } // If Backspace is pressed and selection exists
    else if (e.key === 'Backspace') {
       if (selectionAnchor !== null && selectionAnchor !== focusedBlockIndex) {
          e.preventDefault();
          const start = Math.min(selectionAnchor, focusedBlockIndex);
          const end = Math.max(selectionAnchor, focusedBlockIndex);
          
          // Remove range
          const newBlocks = blocks.filter((_, i) => i < start || i > end);
          if (newBlocks.length === 0) {
             newBlocks.push({ id: generateId(), type: 'text', content: '' });
          }
          setBlocks(newBlocks);
          setSelectionAnchor(null);
          setFocusedBlockIndex(start > 0 ? start - 1 : 0);
       } else if (blocks[index].content === '') {
           if (blocks[index].type !== 'text') {
              e.preventDefault();
              setBlocks(prev => prev.map((b, i) => i === index ? { ...b, type: 'text' } : b));
           } else {
              e.preventDefault();
              // If it's a bullet list and we are at the start of it with content, convert to text?
              // No, `blocks[index].content === ''` handles the empty case.
              // What if content is NOT empty but we are at start?
              // That's handled by default backspace if we don't preventDefault.
              // But standard textarea doesn't know about "type".
              removeBlock(index);
           }
       } else {
           // Content not empty
           // If at start of block (selectionStart === 0)
           // and it is a list item, should we merge or convert to text?
           // For now let's leave default behavior (merge with previous block text if possible)
       }
    }
  };


  const handlePaste = async (e: React.ClipboardEvent, index: number) => {
    const items = Array.from(e.clipboardData.items);
    
    // 1. Direct File Paste (Screenshots, Copied Files)
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
        e.preventDefault(); 
        const text = e.clipboardData.getData('text/plain');
        
        let cursorStart = 0;
        let cursorEnd = 0;
        if (e.target instanceof HTMLTextAreaElement) {
             cursorStart = e.target.selectionStart;
             cursorEnd = e.target.selectionEnd;
        }

        const imagePromises = imageItems.map(item => {
            return new Promise<string | null>((resolve) => {
                const file = item.getAsFile();
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
        });

        const imagesContent = await Promise.all(imagePromises);
        const validImages = imagesContent.filter((c): c is string => c !== null);

        if (validImages.length === 0) return;

        insertPastedContent(index, text, validImages, cursorStart, cursorEnd);
        return;
    }

    // 2. HTML Paste (Webpages with Mixed Content)
    // Sometimes images are not in `items` as files but as `<img>` tags in HTML
    const html = e.clipboardData.getData('text/html');
    if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const imgs = doc.querySelectorAll('img');

        if (imgs.length > 0) {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            
            let cursorStart = 0;
            let cursorEnd = 0;
            if (e.target instanceof HTMLTextAreaElement) {
                 cursorStart = e.target.selectionStart;
                 cursorEnd = e.target.selectionEnd;
            }

            const imageUrls = Array.from(imgs).map(img => img.src).filter(src => src);
            if (imageUrls.length > 0) {
                 insertPastedContent(index, text, imageUrls, cursorStart, cursorEnd);
            }
        }
    }
  };

  const insertPastedContent = (index: number, text: string, images: string[], cursorStart: number, cursorEnd: number) => {
        setBlocks(prevBlocks => {
            const newBlocks = [...prevBlocks];
            const currentBlock = newBlocks[index];
            
            const imagesToInsert = [...images];
            let insertIndex = index + 1;
            
            if (text) {
                // If appending to existing block, preserve type
                const oldContent = currentBlock.content;
                const start = Math.min(cursorStart, oldContent.length);
                const end = Math.min(cursorEnd, oldContent.length);
                
                const newContent = oldContent.slice(0, start) + text + oldContent.slice(end);
                newBlocks[index] = { ...currentBlock, content: newContent };
            } else if (currentBlock.content.trim() === '') {
                 // Replace current block with first image
                 if (imagesToInsert.length > 0) {
                     newBlocks[index] = { ...currentBlock, type: 'image', content: imagesToInsert[0] };
                     imagesToInsert.shift(); 
                 }
                 // If there are more images, they go to index + 1
                 insertIndex = index + 1;
            } else {
                 // No text pasted, but current block has content. Images go after.
                 insertIndex = index + 1;
            }

            if (imagesToInsert.length > 0) {
                const newImageBlocks: Block[] = imagesToInsert.map(img => ({
                    id: crypto.randomUUID(),
                    type: 'image',
                    content: img
                }));
                newBlocks.splice(insertIndex, 0, ...newImageBlocks);
            }
            
            return newBlocks;
        });
  };

  const treeNotes = useMemo(() => {
    const noteMap: Record<string, any> = {};
    const tree: any[] = [];
    
    // First pass: create map entries
    notes.forEach(note => {
      noteMap[note.id] = { ...note, children: [] };
    });
    
    // Second pass: link children to parents
    notes.forEach(note => {
       if (note.parent_id && noteMap[note.parent_id]) {
           noteMap[note.parent_id].children.push(noteMap[note.id]);
       } else {
           tree.push(noteMap[note.id]);
       }
    });

    return tree;
  }, [notes]);

  return (
    <div className="notes-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h3>Notes</h3>
            <button className="add-btn" onClick={createNote}>+</button>
        </div>
        <ul className="notes-list" style={{ padding: '0 10px' }}>
          {treeNotes.map(note => (
             <SidebarItem 
                key={note.id} 
                note={note} 
                selectedId={selectedNote?.id} 
                onSelect={(n) => selectNote(n)} 
                onDelete={(id, e) => deleteNote(id, e)}
             />
          ))}
        </ul>
      </aside>
      <main className="editor">
        {selectedNote ? (
          <>
            <input 
              ref={titleInputRef}
              className="title-input"
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              onBlur={saveNote}
              onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'Enter') {
                      e.preventDefault();
                      if (blocks.length > 0) {
                          handleFocus(0);
                      }
                  }
              }}
              placeholder="Untitled"
            />
            <div className="blocks-container">
              {blocks.map((block, index) => (
                <div key={block.id} className="block-wrapper">
                  <BlockInput 
                      block={block}
                      index={index}
                      updateBlock={updateBlock}
                      onKeyDown={handleKeyDown}
                      isFocused={focusedBlockIndex === index}
                      isSelected={isBlockSelected(index)}
                      onFocusNext={(next, isShift) => handleFocus(next + 1, isShift)}
                      onFocusPrev={(prev, isShift) => handleFocus(prev - 1, isShift)}
                      onManualFocus={(isShift) => {
                          if (isShift) {
                              handleFocus(index, true); 
                          } else {
                              setSelectionAnchor(index);
                              setFocusedBlockIndex(index);
                              setIsMouseSelecting(true);
                          }
                      }}
                      onMouseEnter={() => handleMouseEnter(index)}
                      onPaste={(e) => handlePaste(e, index)}
                      onNavigateNote={(noteId) => {
                          const targetNote = notes.find(n => n.id === noteId);
                          if (targetNote) selectNote(targetNote);
                      }}
                      getNoteTitle={(id) => notes.find(n => n.id === id)?.title || ''}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">Select a note or create a new one.</div>
        )}
      </main>
    </div>
  );
}
