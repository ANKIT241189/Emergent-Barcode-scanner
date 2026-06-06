import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("pb_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("pb_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API}/auth/me`)
      .then((r) => {
        setUser(r.data.user);
        localStorage.setItem("pb_user", JSON.stringify(r.data.user));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("pb_token");
        localStorage.removeItem("pb_user");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (employee_id, password) => {
    const r = await axios.post(`${API}/auth/login`, { employee_id, password });
    setToken(r.data.token);
    setUser(r.data.user);
    localStorage.setItem("pb_token", r.data.token);
    localStorage.setItem("pb_user", JSON.stringify(r.data.user));
    return r.data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("pb_token");
    localStorage.removeItem("pb_user");
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
