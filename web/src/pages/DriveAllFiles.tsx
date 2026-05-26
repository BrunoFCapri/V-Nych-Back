import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAPI } from '../utils/useAPI';

interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  mime_type?: string;
  uploaded_at?: string;
}

const DriveAllFiles: React.FC = () => {
  const { token } = useAuth();
  const { fetchAPI } = useAPI();
  const navigate = useNavigate();
  const [files, setFiles] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Estado para previsualización
  const [previewUrl, setPreviewUrl] = useState<string|null>(null);
  const [previewType, setPreviewType] = useState<string|null>(null);
  const [previewName, setPreviewName] = useState<string|null>(null);
    // Previsualizar archivo
    const handlePreview = async (file: Attachment) => {
      const res = await fetchAPI(`/api/tasks/${file.task_id}/attachments/${file.id}`);
      if (!res.ok) return alert('Error al obtener archivo');
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewType(blob.type);
      setPreviewName(file.filename);
    };

    const closePreview = () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewType(null);
      setPreviewName(null);
    };
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setUploading(true);
    // Endpoint especial: /api/tasks/null/attachments para archivos "sueltos"
    const res = await fetchAPI(`/api/tasks/null/attachments`, {
      method: 'POST',
      body: data,
    });
    setUploading(false);
    if (res.ok) {
      // Refresca la lista de archivos
      fetchAPI(`/api/attachments`)
        .then((res) => res.json())
        .then(setFiles);
      form.reset();
    } else {
      alert('Error al subir archivo');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAPI(`/api/attachments`)
      .then((res) => res.json())
      .then(setFiles)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al obtener archivos'))
      .finally(() => setLoading(false));
  }, [token, fetchAPI]);

  const handleDownload = async (file: Attachment) => {
    const res = await fetchAPI(`/api/tasks/${file.task_id}/attachments/${file.id}`);
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
    const res = await fetchAPI(`/api/tasks/${file.task_id}/attachments/${file.id}`, {
      method: 'DELETE',
    });
    if (res.ok) setFiles((prev) => prev.filter((f) => f.id !== file.id));
    else alert('Error al eliminar');
  };

  return (
    <div className="card" style={{maxWidth: 650, margin: '2rem auto'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18}}>
        <h2 style={{margin:0}}>Todos mis archivos</h2>
        <button className="action-btn" onClick={() => navigate('/')}>⟵ Menú</button>
      </div>
      <form onSubmit={handleUpload} style={{display:'flex',gap:8,alignItems:'center',marginBottom:18}}>
        <input type="file" name="file" required style={{color:'var(--text-primary)',background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 8px',fontSize:15}} />
        <button className="action-btn" type="submit" disabled={uploading} style={{minWidth:120}}>{uploading ? 'Subiendo...' : 'Subir archivo'}</button>
      </form>
      {loading && <p style={{color:'var(--accent)'}}>Cargando...</p>}
      {error && <p style={{color:'var(--error)'}}>{error}</p>}
      {files.length === 0 && !loading && !error && (
        <div style={{textAlign:'center',color:'var(--text-muted)',margin:'2.5rem 0'}}>No tienes archivos subidos.</div>
      )}
      {files.length > 0 && (
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',background:'var(--surface-2)',borderRadius:10,overflow:'hidden',boxShadow:'0 2px 8px #0002'}}>
            <thead>
              <tr style={{background:'rgba(173,255,35,0.07)'}}>
                <th style={{padding:'10px 8px',textAlign:'left',fontWeight:600,color:'var(--accent)'}}>Archivo</th>
                <th style={{padding:'10px 8px',textAlign:'left',fontWeight:600,color:'var(--accent)'}}>Subido</th>
                <th style={{padding:'10px 8px',textAlign:'center',fontWeight:600,color:'var(--accent)'}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const ext = file.filename.includes('.') ? file.filename.split('.').pop() : '';
                return (
                  <tr key={file.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'10px 8px'}}>{file.filename}{ext && <span style={{color:'var(--text-muted)',fontSize:13}}> ({ext})</span>}</td>
                    <td style={{padding:'10px 8px'}}>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : ''}</td>
                    <td style={{padding:'10px 8px',textAlign:'center'}}>
                      <button className="action-btn" style={{marginRight:6,minWidth:90}} onClick={() => handlePreview(file)}>👁 Previsualizar</button>
                      <button className="action-btn" style={{marginRight:6,minWidth:90}} onClick={() => handleDownload(file)}>⬇ Descargar</button>
                      <button className="action-btn" style={{background:'var(--error-weak)',color:'var(--error)',minWidth:90}} onClick={() => handleDelete(file)}>🗑 Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de previsualización */}
      <Modal
        isOpen={!!previewUrl}
        onRequestClose={closePreview}
        contentLabel="Previsualización"
        style={{
          content:{
            maxWidth:520,
            margin:'auto',
            height:'auto',
            background:'var(--card-bg)',
            color:'var(--text-primary)',
            borderRadius:14,
            border:'1px solid var(--border)',
            boxShadow:'0 8px 32px #0008',
            padding:'2.2rem 1.5rem 1.5rem 1.5rem',
            position:'relative',
            textAlign:'center',
          },
          overlay:{
            background:'rgba(0,0,0,0.55)',
            zIndex:9999
          }
        }}
        ariaHideApp={false}
      >
        <button onClick={closePreview} className="action-btn" style={{position:'absolute',top:18,right:18,minWidth:70}}>Cerrar</button>
        <h3 style={{marginTop:0,marginBottom:18,fontWeight:600}}>Previsualizando: <span style={{color:'var(--accent)'}}>{previewName}</span></h3>
        {previewUrl && previewType && previewType.startsWith('image') && (
          <img src={previewUrl} alt={previewName||''} style={{maxWidth:'100%',maxHeight:340,borderRadius:10,boxShadow:'0 2px 8px #0003'}} />
        )}
        {previewUrl && previewType === 'application/pdf' && (
          <iframe src={previewUrl} title="PDF" style={{width:'100%',height:340,border:'none',borderRadius:10}} />
        )}
        {previewUrl && previewType && previewType.startsWith('text') && (
          <iframe src={previewUrl} title="Texto" style={{width:'100%',height:340,border:'none',borderRadius:10}} />
        )}
        {previewUrl && !['image','application/pdf','text'].some(t=>previewType?.startsWith(t)) && (
          <p style={{color:'var(--error)',marginTop:30}}>No se puede previsualizar este tipo de archivo.</p>
        )}
      </Modal>
    </div>
  );
};

export default DriveAllFiles;
