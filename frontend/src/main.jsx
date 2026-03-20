import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Produtos from './pages/Produtos';
import Grupos from './pages/Grupos';
import Cobertura from './pages/Cobertura';
import DatabasePlanilhas from './pages/DatabasePlanilhas';
import Frota from './pages/Frota';
import EstoqueMatriz from './pages/EstoqueMatriz';
import MapaLojas from './pages/MapaLojas';
import MapaClientes from './pages/MapaClientes';
import Layout from './components/Layout';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="grupos" element={<Grupos />} />
            <Route path="cobertura" element={<Cobertura />} />
            <Route path="database" element={<DatabasePlanilhas />} />
            <Route path="mapa-clientes" element={<MapaClientes />} />
            <Route path="mapa-do-motor" element={<Frota />} />
            <Route path="mapa-lojas" element={<MapaLojas />} />
            <Route path="estoque-matriz" element={<EstoqueMatriz />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);