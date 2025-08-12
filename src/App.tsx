import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import { SignOutButton } from './components/ui';
import Auth from './pages/Auth';
import Pos from './pages/Pos';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" />;
  }
  
  return <>{children}</>;
};

const AppLayout = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div dir="rtl" className="flex min-h-screen bg-gray-100 text-right font-tajawal">
      {/* Sidebar */}
      <div className="fixed lg:static lg:left-auto lg:w-64 z-30">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto transition-all duration-300 lg:ml-64">
        {/* Mobile Header */}
        {isMobile && (
          <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-20">
            <div className="w-8"></div> {/* Empty space for balance */}
            <h1 className="font-bold text-2xl tracking-wider font-display">MIZENI</h1>
            <SignOutButton />
          </div>
        )}
        
        {/* Page Routes */}
        <Routes>
          <Route path="/" element={<Pos />} />
          {/* Redirect from Arabic 'cashier' to root */}
          <Route path="/الكاشير" element={<Navigate to="/" replace />} />
          <Route path="/cashier" element={<Navigate to="/" replace />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
