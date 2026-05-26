import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { folderIcon, homeIcon, starIcon, taskIcon } from '../assets/icons';

interface TaskAttachment {
    id: string;
    filename: string;
    mime_type?: string;
    uploaded_at?: string;
}

// Custom hook para manejar los attachments de tareas
function useTaskAttachments(selectedTask: Task | null, token: string) {

        // Eliminar attachment
        const handleDeleteAttachment = async (attId: string) => {
            if (!selectedTask) return;
            if (!window.confirm('Are you sure you want to delete this file?')) return;
            try {
                const res = await fetch(`${API_URL}/api/tasks/${selectedTask.id}/attachments/${attId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    setAttachments(prev => prev.filter(a => a.id !== attId));
                } else {
                    alert('Failed to delete file');
                }
            } catch {
                alert('Failed to delete file');
            }
        };
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!selectedTask) return;
        const fetchAttachments = async () => {
            try {
                const res = await fetch(`${API_URL}/api/tasks/${selectedTask.id}/attachments`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) setAttachments(await res.json());
                else setAttachments([]);
            } catch {
                setAttachments([]);
            }
        };
        fetchAttachments();
    }, [selectedTask, token]);

    // Upload handler
    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTask || !fileInputRef.current || !fileInputRef.current.files?.length) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', fileInputRef.current.files[0]);
        try {
            const res = await fetch(`${API_URL}/api/tasks/${selectedTask.id}/attachments`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                // Refetch attachments
                const updated = await fetch(`${API_URL}/api/tasks/${selectedTask.id}/attachments`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (updated.ok) setAttachments(await updated.json());
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } finally {
            setUploading(false);
        }
    };

    return { attachments, setAttachments, uploading, setUploading, fileInputRef, handleFileUpload, handleDeleteAttachment };
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  is_starred: boolean;
  due_date?: string;
  list_id?: string;
  parent_id?: string | null;
  created_at?: string;
}

interface TaskList {
  id: string;
  title: string;
  color?: string;
  icon?: string;
}

interface TaskTreeItemProps {
  task: Task;
  level: number;
  tasksByParent: Map<string, Task[]>;
  expandedTasks: Set<string>;
  toggleExpand: (id: string) => void;
  onSelect: (task: Task) => void;
  selectedTaskId?: string;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  breadcrumb?: string; // NEW prop for showing path
}

const TaskTreeItem = ({
  task,
  level,
  tasksByParent,
  expandedTasks,
  toggleExpand,
  onSelect,
  selectedTaskId,
  onUpdate,
  onDelete,
  breadcrumb
}: TaskTreeItemProps) => {
  // Sort children: Active first, then Done
  const children = (tasksByParent.get(task.id) || []).sort((a,b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  });
  
  const hasChildren = children.length > 0;
  const isExpanded = expandedTasks.has(task.id);
  const isSelected = selectedTaskId === task.id;
  const isDone = task.status === 'done' || task.status === 'completed';

  return (
    <>
      <div 
        onClick={(e) => { e.stopPropagation(); onSelect(task); }}
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '8px 12px', 
            paddingLeft: `${level * 20 + 12}px`,
            marginBottom: '4px', 
            borderRadius: '6px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--border)' : 'var(--card-bg)',
            opacity: isDone ? 0.7 : 1,
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s',
            position: 'relative'
        }}
      >
         {/* Indentation Guide Line (optional visual cue) */}
         {level > 0 && (
             <div style={{
                 position: 'absolute',
                 left: `${level * 20 - 10}px`,
                 top: 0,
                 bottom: 0,
                 width: '1px',
                 backgroundColor: 'var(--border)'
             }} />
         )}

         {/* Expand Toggle */}
         <div 
            style={{ 
                width: '20px', 
                display: 'flex', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                marginRight: '6px',
                color: 'var(--text-secondary)',
                visibility: hasChildren ? 'visible' : 'hidden'
            }}
            onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
         >
             {isExpanded ? '▼' : '▶'}
         </div>

         {/* Selection Checkbox */}
        <input
            type="checkbox"
            checked={isDone}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onUpdate(task.id, { status: isDone ? 'todo' : 'done' })}
            style={{ marginRight: '12px', width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }}
        />
        
        {/* Title & Breadcrumb Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {breadcrumb && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {breadcrumb}
                </div>
            )}
            
            <div style={{ 
                textDecoration: isDone ? 'line-through' : 'none',
                color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
                fontWeight: 500,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center'
            }}>
                {task.title}
                {task.due_date && (
                    <span style={{ fontSize: '0.75rem', color: new Date(task.due_date) < new Date() && !isDone ? 'var(--error)' : 'var(--text-secondary)', marginLeft: '8px' }}>
                        📅 {new Date(task.due_date).toLocaleDateString()}
                    </span>
                )}
            </div>
        </div>

        <button 
            onClick={(e) => {
                e.stopPropagation();
                onUpdate(task.id, { is_starred: !task.is_starred });
            }}
            style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                color: task.is_starred ? '#fbbf24' : 'var(--border)', fontSize: '1.1rem', marginRight: '8px', marginLeft: '8px'
            }}
        >
            ★
        </button>

        <button 
            onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
            }}
            style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}
        >
            ×
        </button>
      </div>

      {isExpanded && children.map(child => (
          <TaskTreeItem 
             key={child.id} 
             task={child} 
             level={level + 1} 
             tasksByParent={tasksByParent}
             expandedTasks={expandedTasks}
             toggleExpand={toggleExpand}
             onSelect={onSelect}
             selectedTaskId={selectedTaskId}
             onUpdate={onUpdate}
             onDelete={onDelete}
          />
      ))}
    </>
  )
}

export default function Tasks() {
    // Descarga de adjuntos con autorización
    const handleDownloadAttachment = async (att: TaskAttachment) => {
        if (!selectedTask) return;
        try {
            const res = await fetch(`${API_URL}/api/tasks/${selectedTask.id}/attachments/${att.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = att.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert('Error downloading file');
        }
    };

    const [tasks, setTasks] = useState<Task[]>([]);
    const [lists, setLists] = useState<TaskList[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null); // null = All Tasks
    const [showStarredOnly, setShowStarredOnly] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newListTitle, setNewListTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { token, isAuthenticated } = useAuth();

    // Hook para adjuntos de tareas (debe ir después de declarar selectedTask y token)
    const { attachments, uploading, fileInputRef, handleFileUpload, handleDeleteAttachment } = useTaskAttachments(selectedTask, token ?? '');
  const navigate = useNavigate();

  // --- Initial Load ---
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLists();
    
    // FETCH ALL TASKS always, allow client filtering for better UX (breadcrumbs)
    // and performance on small datasets
    fetchAllTasks();
  }, [isAuthenticated]); // Run once on auth

  // --- Fetchers ---
  const fetchLists = async () => {
    try {
      const res = await fetch(`${API_URL}/api/lists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLists(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAllTasks = async () => {
    setLoading(true);
    try {
      // No filters in URL -> Get All
      const res = await fetch(`${API_URL}/api/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
          const data = await res.json();
          setTasks(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Computations ---
  
  // Filtered lists for display
  const tasksByParent = useMemo(() => {
      // We always group ALL tasks to build the map for lookups/expansion
      // But we will filter ROOTS for display later
      const map = new Map<string, Task[]>();
      tasks.forEach(t => {
        const pid = t.parent_id || 'root';
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)?.push(t);
      });
      return map;
  }, [tasks]);

  const visibleRootTasks = useMemo(() => {
      if (showStarredOnly) {
          // Flattened list of starred tasks
          return tasks.filter(t => t.is_starred);
      }
      
      // Default: Root tasks (filtered by list if selected)
      let roots = tasksByParent.get('root') || [];
      
      if (selectedListId) {
          roots = roots.filter(t => t.list_id === selectedListId);
      }
      
      return roots.sort((a,b) => {
          if (a.is_starred && !b.is_starred) return -1;
          if (!a.is_starred && b.is_starred) return 1;
          return (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      });
  }, [tasks, tasksByParent, showStarredOnly, selectedListId]);

  // Helper for breadcrumbs
  const getBreadcrumb = (task: Task) => {
      // Only show breadcrumb if viewing Starred list or "All Tasks" mixed view
      
      const chain: string[] = [];
      
      // List Name
      if (task.list_id) {
          const l = lists.find(li => li.id === task.list_id);
          if (l) chain.push(l.title);
      }

      // Parents
      let current = task;
      const parents: string[] = [];
      // Safety break to prevent infinite loops in cyclic refs (shouldn't happen but good practice)
      let depth = 0;
      while (current.parent_id && depth < 10) {
          const p = tasks.find(t => t.id === current.parent_id);
          if (p) {
              parents.unshift(p.title);
              current = p;
          } else {
              break;
          }
          depth++;
      }
      
      return [...chain, ...parents].join(' > ');
  };

  // --- Actions ---

  const toggleExpand = (id: string) => {
      setExpandedTasks(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          return newSet;
      });
  };

  const createNewTask = async (title: string, parentId?: string) => {
    try {
      const body: any = { 
        title, 
        list_id: selectedListId, 
        parent_id: parentId 
      };
      
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Failed');
      
      const newTask = await res.json();
      
      setTasks(prev => [newTask, ...prev]);
      
      // Auto-expand parent if subtask created
      if (parentId) {
          setExpandedTasks(prev => new Set(prev).add(parentId));
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  const updateTask = async (id: string, updates: Partial<Task>) => {
    // Prepare updates locally
    const updatesMap = new Map<string, Partial<Task>>();
    updatesMap.set(id, updates);

    // If changing status (done/todo), cascade to all descendants
    if (updates.status) {
        const getDescendants = (parentId: string): string[] => {
            let ids: string[] = [];
            const children = tasksByParent.get(parentId) || [];
            children.forEach(child => {
                ids.push(child.id);
                ids = [...ids, ...getDescendants(child.id)];
            });
            return ids;
        };

        const descendants = getDescendants(id);
        descendants.forEach(dId => {
            updatesMap.set(dId, { status: updates.status });
        });
    }

    // Optimistic UI
    setTasks(prev => prev.map(t => {
        const specificUpdates = updatesMap.get(t.id);
        return specificUpdates ? { ...t, ...specificUpdates } : t;
    }));
    
    // Update selectedTask if needed
    if (selectedTask) {
        const specificUpdates = updatesMap.get(selectedTask.id);
        if (specificUpdates) {
             setSelectedTask({ ...selectedTask, ...specificUpdates });
        }
    }

    try {
      // Execute all updates
      await Promise.all(Array.from(updatesMap.entries()).map(([taskId, taskUpdates]) => 
          fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(taskUpdates)
          })
      ));
    } catch (e) {
      fetchAllTasks(); // Revert on error
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Delete this task and all its subtasks?')) return;
    
    // Calculate all IDs to remove for Optimistic UI
    const getDescendants = (parentId: string): string[] => {
        let ids: string[] = [];
        const children = tasksByParent.get(parentId) || [];
        children.forEach(child => {
            ids.push(child.id);
            ids = [...ids, ...getDescendants(child.id)];
        });
        return ids;
    };
    const idsToRemove = new Set([id, ...getDescendants(id)]);

    // Optimistic Update
    setTasks(prev => prev.filter(t => !idsToRemove.has(t.id)));
    if (selectedTask && idsToRemove.has(selectedTask.id)) setSelectedTask(null);

    try {
      await fetch(`${API_URL}/api/tasks/${id}`, {
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) { 
        setError('Failed to delete'); 
        fetchAllTasks(); // Revert
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
        const res = await fetch(`${API_URL}/api/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: newListTitle })
        });
        
        if (res.ok) {
            const newList = await res.json();
            setLists([...lists, newList]);
            setNewListTitle('');
        }
    } catch (e) { 
        console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-color)' }}>
      
      {/* Sidebar - Lists */}
      <div style={{ width: '250px', backgroundColor: 'var(--card-bg)', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={taskIcon} alt="Task lists" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
            Task Lists
        </h2>
        
        <div 
            onClick={() => { setSelectedListId(null); setShowStarredOnly(false); }}
            style={{ 
                padding: '10px', 
                cursor: 'pointer', 
                backgroundColor: !selectedListId && !showStarredOnly ? 'var(--border)' : 'transparent', 
                borderRadius: '6px',
                marginBottom: '5px',
                color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
            }}
        >
            <img src={folderIcon} alt="All tasks" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
            All Tasks
        </div>
        
        <div 
            onClick={() => { setShowStarredOnly(true); setSelectedListId(null); }}
            style={{ 
                padding: '10px', 
                cursor: 'pointer', 
                backgroundColor: showStarredOnly ? 'var(--border)' : 'transparent', 
                borderRadius: '6px',
                marginBottom: '15px',
                color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'
            }}
        >
            <img src={starIcon} alt="Starred" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
            Starred
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>Your Lists</div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
            {lists.map(list => (
                <div 
                    key={list.id}
                    onClick={() => { setSelectedListId(list.id); setShowStarredOnly(false); }}
                    style={{ 
                        padding: '10px', 
                        cursor: 'pointer', 
                        backgroundColor: selectedListId === list.id ? 'var(--border)' : 'transparent', 
                        borderRadius: '6px',
                        marginBottom: '4px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: selectedListId === list.id ? 'white' : 'var(--text-secondary)'
                    }}
                >
                    {list.icon ? (
                        <span>{list.icon}</span>
                    ) : (
                        <img src={folderIcon} alt="List" style={{ width: '16px', height: '16px', borderRadius: '3px' }} />
                    )}
                    {list.title}
                </div>
            ))}
        </div>

        <form onSubmit={handleCreateList} style={{ marginTop: '15px', display: 'flex', gap: '5px' }}>
            <input 
                value={newListTitle}
                onChange={e => setNewListTitle(e.target.value)}
                placeholder="+ New List"
                style={{ 
                    flex: 1, 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border)', 
                    backgroundColor: 'var(--bg-color)', 
                    color: 'white',
                    outline: 'none'
                }}
            />
            <button 
                type="submit"
                disabled={!newListTitle.trim()}
                style={{ backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', padding: '0 10px', cursor: 'pointer' }}
            >
                +
            </button>
        </form>

        <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '10px', backgroundColor: 'var(--border)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <img src={homeIcon} alt="Dashboard" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
            Back to Dashboard
        </button>
      </div>

      {/* Main Content - Tasks */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto', borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-color)' }}>
        <h1 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>
            {showStarredOnly ? 'Starred Tasks' : (selectedListId ? lists.find(l => l.id === selectedListId)?.title : 'All Tasks')}
        </h1>
        
        {loading && <div style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>Loading tasks...</div>}
        {error && <div style={{ color: 'var(--error)', marginBottom: '10px' }}>Error: {error}</div>}
        
        <form onSubmit={(e) => { e.preventDefault(); if(newTaskTitle.trim()) { createNewTask(newTaskTitle.trim()); setNewTaskTitle(''); } }} style={{ marginBottom: '20px' }}>
            <input 
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Add a new task..."
                style={{ 
                    width: '100%', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    fontSize: '1rem', 
                    backgroundColor: 'var(--card-bg)', 
                    color: 'var(--text-primary)',
                    outline: 'none'
                }}
            />
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Active Tasks or Filtered View */}
            {visibleRootTasks.filter(t => t.status !== 'done').map(task => (
                <TaskTreeItem 
                    key={task.id} 
                    task={task} 
                    level={showStarredOnly ? 0 : 0} // Flatten indentation if starred view
                    tasksByParent={tasksByParent}
                    expandedTasks={expandedTasks}
                    toggleExpand={toggleExpand}
                    onSelect={setSelectedTask}
                    selectedTaskId={selectedTask?.id}
                    onUpdate={updateTask}
                    onDelete={handleDeleteTask}
                    breadcrumb={showStarredOnly ? getBreadcrumb(task) : undefined}
                />
            ))}
            
            {/* Completed Tasks */}
            {visibleRootTasks.some(t => t.status === 'done') && (
                <div style={{ marginTop: '30px' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Completed</h3>
                    {visibleRootTasks.filter(t => t.status === 'done').map(task => (
                        <TaskTreeItem 
                            key={task.id} 
                            task={task} 
                            level={showStarredOnly ? 0 : 0}
                            tasksByParent={tasksByParent}
                            expandedTasks={expandedTasks}
                            toggleExpand={toggleExpand}
                            onSelect={setSelectedTask}
                            selectedTaskId={selectedTask?.id}
                            onUpdate={updateTask}
                            onDelete={handleDeleteTask}
                            breadcrumb={showStarredOnly ? getBreadcrumb(task) : undefined}
                        />
                    ))}
                </div>
            )}

            {visibleRootTasks.length === 0 && !loading && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>No tasks found.</div>}
        </div>
      </div>

      {/* Right Panel - Details */}
      {selectedTask && (
        <div style={{ width: '350px', backgroundColor: 'var(--card-bg)', padding: '20px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Task Details</h3>
                <button onClick={() => setSelectedTask(null)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            
            {/* Breadcrumb in details too */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', fontStyle: 'italic' }}>
                {getBreadcrumb(selectedTask)}
            </div>

            <input 
                value={selectedTask.title}
                onChange={(e) => updateTask(selectedTask.id, { title: e.target.value })}
                style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 'bold', 
                    border: 'none', 
                    borderBottom: '1px solid var(--border)', 
                    padding: '5px 0', 
                    marginBottom: '15px', 
                    width: '100%', 
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)'
                }}
            />

            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>Due Date</label>
            <input 
                type="date"
                value={selectedTask.due_date ? selectedTask.due_date.split('T')[0] : ''}
                onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                    updateTask(selectedTask.id, { due_date: date });
                }}
                style={{ 
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border)', 
                    marginBottom: '20px', 
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-color)',
                    colorScheme: 'dark'
                }}
            />

            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Description / Notes</label>
            <textarea 
                value={selectedTask.description || ''}
                onChange={(e) => updateTask(selectedTask.id, { description: e.target.value })}
                placeholder="Add notes..."
                style={{ 
                    width: '100%', 
                    minHeight: '100px', 
                    padding: '10px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--border)', 
                    marginBottom: '20px', 
                    resize: 'vertical',
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-primary)'
                }}
            />

            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Subtasks</label>
            <div style={{ marginBottom: '20px' }}>
                {(tasksByParent.get(selectedTask.id) || []).map(st => (
                    <div 
                        key={st.id} 
                        style={{ display: 'flex', alignItems: 'center', padding: '6px', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}
                    >
                         <input
                            type="checkbox"
                            checked={st.status === 'done'}
                            onChange={() => updateTask(st.id, { status: st.status === 'done' ? 'todo' : 'done' })}
                            style={{ marginRight: '8px' }}
                        />
                        <span style={{ 
                            textDecoration: st.status === 'done' ? 'line-through' : 'none', 
                            color: st.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)',
                            flex: 1 
                        }}>{st.title}</span>
                    </div>
                ))}
                
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.currentTarget.elements[0] as HTMLInputElement);
                        const val = input.value.trim();
                        if(val) {
                             createNewTask(val, selectedTask.id).then(() => { input.value = ''; });
                        }
                    }} 
                    style={{ marginTop: '10px', display: 'flex' }}
                >
                    <input 
                        placeholder="Add subtask..." 
                        style={{ 
                            flex: 1, 
                            padding: '5px', 
                            borderRadius: '4px', 
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-color)',
                            color: 'var(--text-primary)'
                        }} 
                    />
                    <button type="submit" style={{ marginLeft: '5px', padding: '5px 10px', backgroundColor: 'var(--border)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}>+</button>
                </form>
            </div>


                        {/* Attachments Section */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>Attachments</label>
                            <form onSubmit={handleFileUpload} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                                <input ref={fileInputRef} type="file" style={{ color: 'var(--text-primary)', background: 'transparent' }} />
                                <button type="submit" disabled={uploading} style={{ backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer' }}>{uploading ? 'Uploading...' : 'Upload'}</button>
                            </form>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {attachments.length === 0 && <li style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No files uploaded.</li>}
                                {attachments.map(att => (
                                    <li key={att.id} style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadAttachment(att)}
                                            style={{ color: 'var(--accent)', textDecoration: 'underline', fontSize: '0.97rem', wordBreak: 'break-all', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {att.filename}
                                        </button>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{att.mime_type || ''}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAttachment(att.id)}
                                            style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', marginLeft: '8px' }}
                                            title="Delete file"
                                        >
                                            🗑️
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Created: {new Date(selectedTask.created_at || '').toLocaleDateString()}
            </div>
        </div>
      )}

    </div>
  );
}
