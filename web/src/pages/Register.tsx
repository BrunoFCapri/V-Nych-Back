import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useAPI } from '../utils/useAPI';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { fetchAPI } = useAPI();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchAPI(`/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
        skipAuth: true,
      });

      if (!res.ok) {
        let errorMessage = 'Error en el registro';
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
      navigate('/');
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || 'No se pudo registrar. Intenta con otro email/usuario.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Registro</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Registrarse</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link>
      </p>
    </div>
  );
}
