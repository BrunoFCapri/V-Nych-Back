import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAPI } from '../utils/useAPI';

type AdminSummary = {
  users: number;
  notes: number;
  tasks: number;
  events: number;
  task_lists: number;
  completed_tasks: number;
  starred_tasks: number;
};

type TaskStatusCount = {
  status: string;
  total: number;
};

type RecentUser = {
  id: string;
  username: string;
  email: string;
  created_at: string | null;
};

type RecentTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  owner_username: string;
  owner_email: string;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

type RecentNote = {
  id: string;
  title: string;
  owner_username: string;
  owner_email: string;
  created_at: string | null;
  updated_at: string | null;
};

type RecentEvent = {
  id: string;
  title: string;
  status: string;
  color: string;
  owner_username: string;
  owner_email: string;
  start_time: string;
  end_time: string;
};

type AdminOverview = {
  summary: AdminSummary;
  task_status_breakdown: TaskStatusCount[];
  recent_users: RecentUser[];
  recent_tasks: RecentTask[];
  recent_notes: RecentNote[];
  recent_events: RecentEvent[];
};

type UserTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

type UserEvent = {
  id: string;
  title: string;
  status: string;
  color: string;
  start_time: string;
  end_time: string;
};

type UserNote = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
};

type TaskAttachment = {
  id: string;
  filename: string;
  mime_type: string | null;
  uploaded_at: string | null;
};

type UserDetailResponse = {
  id: string;
  username: string;
  email: string;
  created_at: string | null;
  task_count: number;
  event_count: number;
  note_count: number;
  attachment_count: number;
  tasks: UserTask[];
  events: UserEvent[];
  notes: UserNote[];
  attachments: TaskAttachment[];
};

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'done' || normalized === 'completed' || normalized === 'confirmed') {
    return 'pill pill--ok';
  }

  if (normalized === 'cancelled' || normalized === 'blocked' || normalized === 'overdue') {
    return 'pill pill--warn';
  }

  return 'pill';
}

function formatStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  const labels: Record<string, string> = {
    todo: 'In Progress',
    'to-do': 'In Progress',
    in_progress: 'In Progress',
    'in-progress': 'In Progress',
    done: 'Completed',
    completed: 'Completed',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    blocked: 'Blocked',
    overdue: 'Overdue',
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetailResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState('');
  const { token, user, logout } = useAuth();
  const { fetchAPI } = useAPI();

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      if (!token) {
        setError('No hay sesión de administrador.');
        setLoadingOverview(false);
        return;
      }

      try {
        const res = await fetchAPI('/api/admin/overview');
        const data: AdminOverview = await res.json();
        if (active) {
          setOverview(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
        }
      } finally {
        if (active) {
          setLoadingOverview(false);
        }
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, [token, fetchAPI]);

  const handleSelectUser = async (userId: string) => {
    if (!userId || !token) return;
    
    setLoadingUser(true);
    setUserDetail(null);

    try {
      const res = await fetchAPI(`/api/admin/user/${userId}`);
      const data: UserDetailResponse = await res.json();
      setUserDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuario');
    } finally {
      setLoadingUser(false);
    }
  };

  return (
    <div className="admin-shell">
      <header className="admin-hero card">
        <div>
          <p className="eyebrow">Panel de administrador</p>
          <h1>Vista central de la base de datos</h1>
          <p className="admin-hero__copy">
            Acceso restringido para <strong>{user?.username ?? 'admin'}</strong>. Aquí se ve el estado general, el
            volumen de datos y el flujo de actividad reciente.
          </p>
        </div>
        <div className="admin-hero__actions">
          <button className="action-btn action-btn--danger" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      {loadingOverview && <div className="card admin-empty">Cargando resumen...</div>}
      {error && !loadingOverview && <div className="card admin-empty admin-empty--error">{error}</div>}

      {userDetail && (
        <section className="card admin-panel user-detail-panel">
          <div className="user-detail__header">
            <div>
              <button 
                className="action-btn action-btn--small"
                onClick={() => setUserDetail(null)}
              >
                ← Volver
              </button>
              <h2 style={{ marginTop: '1rem' }}>{userDetail.username}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{userDetail.email}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Miembro desde {formatDate(userDetail.created_at)}
              </p>
            </div>
            <div className="user-stats">
              <div className="user-stat">
                <strong>{userDetail.task_count}</strong>
                <span>Tareas</span>
              </div>
              <div className="user-stat">
                <strong>{userDetail.event_count}</strong>
                <span>Eventos</span>
              </div>
              <div className="user-stat">
                <strong>{userDetail.note_count}</strong>
                <span>Notas</span>
              </div>
              <div className="user-stat">
                <strong>{userDetail.attachment_count}</strong>
                <span>Archivos</span>
              </div>
            </div>
          </div>

          {userDetail.attachments.length > 0 && (
            <div className="user-section">
              <h3>Archivos Subidos</h3>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Tipo MIME</th>
                      <th>Subido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDetail.attachments.map((att) => (
                      <tr key={att.id}>
                        <td>{att.filename}</td>
                        <td>{att.mime_type || 'Sin especificar'}</td>
                        <td>{formatDate(att.uploaded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {userDetail.tasks.length > 0 && (
            <div className="user-section">
              <h3>Tareas del Usuario</h3>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tarea</th>
                      <th>Estado</th>
                      <th>Actualizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDetail.tasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.title}</td>
                        <td><span className={statusClass(task.status)}>{formatStatusLabel(task.status)}</span></td>
                        <td>{formatDate(task.updated_at ?? task.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {userDetail.events.length > 0 && (
            <div className="user-section">
              <h3>Eventos Recientes</h3>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th>Estado</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDetail.events.map((evt) => (
                      <tr key={evt.id}>
                        <td>
                          <span className="event-chip" style={{ backgroundColor: evt.color }} />
                          {evt.title}
                        </td>
                        <td><span className={statusClass(evt.status)}>{formatStatusLabel(evt.status)}</span></td>
                        <td>{formatDate(evt.start_time)}</td>
                        <td>{formatDate(evt.end_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {userDetail.notes.length > 0 && (
            <div className="user-section">
              <h3>Notas Creadas</h3>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nota</th>
                      <th>Actualizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDetail.notes.map((note) => (
                      <tr key={note.id}>
                        <td>{note.title}</td>
                        <td>{formatDate(note.updated_at ?? note.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {overview && !loadingOverview && !error && !userDetail && (
        <main className="admin-grid">
          <section className="admin-stats">
            <article className="card stat-card">
              <span className="stat-card__label">Usuarios</span>
              <strong>{overview.summary.users}</strong>
            </article>
            <article className="card stat-card">
              <span className="stat-card__label">Notas</span>
              <strong>{overview.summary.notes}</strong>
            </article>
            <article className="card stat-card">
              <span className="stat-card__label">Tareas</span>
              <strong>{overview.summary.tasks}</strong>
            </article>
            <article className="card stat-card">
              <span className="stat-card__label">Eventos</span>
              <strong>{overview.summary.events}</strong>
            </article>
            <article className="card stat-card">
              <span className="stat-card__label">Listas</span>
              <strong>{overview.summary.task_lists}</strong>
            </article>
            <article className="card stat-card">
              <span className="stat-card__label">Tareas completadas</span>
              <strong>{overview.summary.completed_tasks}</strong>
            </article>
          </section>

          <section className="card admin-panel">
            <div className="admin-panel__head">
              <div>
                <p className="eyebrow">Flujo</p>
                <h2>Estado de tareas por flujo</h2>
              </div>
            </div>
            <div className="status-flow">
              {overview.task_status_breakdown.map((item) => (
                <div key={item.status} className="status-flow__item">
                  <span className={statusClass(item.status)}>{formatStatusLabel(item.status)}</span>
                  <strong>{item.total}</strong>
                </div>
              ))}
              <div className="status-flow__item">
                <span className="pill pill--accent">Estrella</span>
                <strong>{overview.summary.starred_tasks}</strong>
              </div>
            </div>
          </section>

          <section className="card admin-panel">
            <div className="admin-panel__head">
              <div>
                <p className="eyebrow">Actividad</p>
                <h2>Usuarios recientes</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Creado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{item.email}</td>
                      <td>{formatDate(item.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="action-btn action-btn--small"
                          onClick={() => handleSelectUser(item.id)}
                          disabled={loadingUser}
                        >
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card admin-panel">
            <div className="admin-panel__head">
              <div>
                <p className="eyebrow">Flujo de datos</p>
                <h2>Tareas y notas recientes</h2>
              </div>
            </div>
            <div className="split-stack">
              <div className="split-stack__group">
                <h3 className="split-stack__title">Recent Tasks</h3>
                <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tarea</th>
                      <th>Estado</th>
                      <th>Propietario</th>
                      <th>Actualizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent_tasks.slice(0, 10).map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td><span className={statusClass(item.status)}>{formatStatusLabel(item.status)}</span></td>
                        <td>{item.owner_username}</td>
                        <td>{formatDate(item.updated_at ?? item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="split-stack__group">
                <h3 className="split-stack__title">Recent Notes</h3>
                <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nota</th>
                      <th>Propietario</th>
                      <th>Actualizada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recent_notes.slice(0, 10).map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td>{item.owner_username}</td>
                        <td>{formatDate(item.updated_at ?? item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </section>

          <section className="card admin-panel">
            <div className="admin-panel__head">
              <div>
                <p className="eyebrow">Calendario</p>
                <h2>Eventos recientes</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Estado</th>
                    <th>Propietario</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recent_events.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="event-chip" style={{ backgroundColor: item.color }} />
                        {item.title}
                      </td>
                      <td><span className={statusClass(item.status)}>{formatStatusLabel(item.status)}</span></td>
                      <td>{item.owner_username}</td>
                      <td>{formatDate(item.start_time)}</td>
                      <td>{formatDate(item.end_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
