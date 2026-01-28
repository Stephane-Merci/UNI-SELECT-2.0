import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import WorkAllocation from './pages/WorkAllocation';
import PlanManagement from './pages/PlanManagement';
import WorkerTypeManagement from './pages/WorkerTypeManagement';
import Admin from './pages/Admin';
import Login from './pages/Login';
import { useAuthStore } from './store/useAuthStore';

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <Login />} 
        />
        <Route
          path="/"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<PlanManagement />} />
        </Route>
        <Route
          path="/work-allocation"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<WorkAllocation />} />
        </Route>
        <Route
          path="/worker-types"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<WorkerTypeManagement />} />
        </Route>
        <Route
          path="/admin"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
