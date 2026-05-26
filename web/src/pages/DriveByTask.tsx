import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAPI } from '../utils/useAPI';

interface Task {
  id: string;
  title: string;
}
interface Attachment {
  id: string;
  filename: string;
  uploaded_at?: string;
}

const DriveByTask: React.FC = () => {
  const { token } = useAuth();
  const { fetchAPI } = useAPI();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAPI(`/api/tasks`)
      .then((res) => res.json())
      .then(setTasks);
  }, [token, fetchAPI]);

  useEffect(() => {
    if (!selectedTask) return setFiles([]);
    setLoading(true);
    fetchAPI(`/api/tasks/${selectedTask}/attachments`)
      .then((res) => res.json())
      .then(setFiles)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [selectedTask, token, fetchAPI]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTask) return alert('Selecciona una tarea');
    const form = e.currentTarget;
    const data = new FormData(form);
    setUploading(true);
    const res = await fetchAPI(`/api/tasks/${selectedTask}/attachments`, {
      method: 'POST',
      body: data,
    });
    setUploading(false);
    if (res.ok) {
      const file = await res.json();
      setFiles((prev) => [file, ...prev]);
      form.reset();
    } else {
      alert('Error al subir archivo');
    }
  };

  const handleDownload = async (file: Attachment) => {
    const res = await fetchAPI(`/api/tasks/${selectedTask}/attachments/${file.id}`);
    if (!res.ok) return alert('Error al descargar');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDelete = async (file: Attachment) => {
    if (!window.confirm('¿Eliminar archivo?')) return;
    const res = await fetchAPI(`/api/tasks/${selectedTask}/attachments/${file.id}`, {
      method: 'DELETE',
    });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== file.id));
    else alert('Error al eliminar');
  };

  return (
    <div>
      <h2>Archivos por tarea</h2>
      <label>
        Selecciona tarea:
        <select value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
          <option value=''>--</option>
          {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
      {selectedTask && (
        <form onSubmit={handleUpload}>
          <input type='file' name='file' required />
          <button type='submit' disabled={uploading}>{uploading ? 'Subiendo...' : 'Subir archivo'}</button>
        </form>
      )}
      {loading && <p>Cargando archivos...</p>}
      {error && <p style={{color:'red'}}>{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Archivo</th>
            <th>Subido</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>{file.filename}</td>
              <td>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : ''}</td>
              <td>
                <button onClick={() => handleDownload(file)}>Descargar</button>
                <button onClick={() => handleDelete(file)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DriveByTask;
