import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
};

export const useAPI = () => {
  const { logout } = useAuth();

  const fetchAPI = async (endpoint: string, options: FetchOptions = {}) => {
    const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Merge custom headers si existen
    if (customHeaders && typeof customHeaders === 'object' && !Array.isArray(customHeaders)) {
      Object.assign(headers, customHeaders);
    }

    // Agregar token si existe y no está marcado para saltar autenticación
    if (!skipAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
      });

      // Manejar 401 (Unauthorized) y 403 (Forbidden)
      if (response.status === 401 || response.status === 403) {
        // El token expiró o no tiene permisos, hacer logout
        logout();
        // Redirigir al login (la app debería estar protegida por una ruta privada)
        window.location.href = '/login';
        throw new Error(`Sesión expirada o permiso denegado (${response.status})`);
      }

      // Manejar otros errores HTTP
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  return { fetchAPI };
};
