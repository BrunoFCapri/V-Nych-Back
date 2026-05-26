import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useAPI } from '../utils/useAPI';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { fetchAPI } = useAPI();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchAPI(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
        skipAuth: true,
      });

      if (!res.ok) {
        let errorMessage = 'Credenciales inválidas';
        const errorBody = await res.text();

        if (errorBody) {
          try {
            const errorJson = JSON.parse(errorBody) as { message?: string };
            errorMessage = errorJson.message || errorBody;
          } catch {
            errorMessage = errorBody;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      login(data.token, data.user);
      navigate(data.user.is_admin ? '/admin' : '/');
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Error al iniciar sesión. Verifica tus datos.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Iniciar Sesión</h2>
      <p className="auth-hint">Usa tu usuario o email. El acceso de administrador es exclusivo para admin.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Usuario o email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Entrar</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>
        ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
      </p>
    </div>
  );
}
