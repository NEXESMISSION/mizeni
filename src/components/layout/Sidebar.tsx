import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Package, BarChart2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Translation object (will be moved to a separate file in production)
const translations = {
  ar: {
    appName: "SimpliBiz",
    register: "الكاشير",
    inventory: "المخزون",
    reports: "التقارير",
    logout: "تسجيل خروج",
  }
};

const t = (key: string) => translations.ar[key as keyof typeof translations.ar] || key;

interface SidebarProps {}

const Sidebar: React.FC<SidebarProps> = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  
  const navItems = [
    { id: '/', label: 'register', icon: ShoppingCart },
    { id: '/inventory', label: 'inventory', icon: Package },
    { id: '/reports', label: 'reports', icon: BarChart2 },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden lg:flex flex-col w-64 bg-white border-l h-screen">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold text-blue-600">{t('appName')}</h1>
        </div>
        <ul className="flex-1 mt-4">
          {navItems.map(item => (
            <li key={item.id}>
              <Link
                to={item.id}
                className={`flex items-center gap-3 px-4 py-3 font-medium ${
                  location.pathname === item.id
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                    : 'hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} />
                {t(item.label)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="p-4 border-t">
          <button
            onClick={handleSignOut}
            className="w-full text-right text-gray-700 hover:text-red-600 py-2"
          >
            {t('logout')}
          </button>
        </div>
      </nav>
      
      {/* Mobile App Style Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around z-50 shadow-lg">
        {navItems.map(item => (
          <Link
            key={item.id}
            to={item.id}
            className={`flex-1 flex flex-col items-center justify-center py-4 text-xs ${
              location.pathname === item.id 
                ? 'text-blue-600 font-bold border-t-2 border-blue-600' 
                : 'text-gray-600'
            }`}
          >
            <item.icon size={24} />
            <span className="mt-1 font-medium">{t(item.label)}</span>
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
