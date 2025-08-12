import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Translation object (will be moved to a separate file in production)
const translations = {
  ar: {
    appName: "SimpliBiz",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    loginButton: "دخول",
    registerButton: "إنشاء",
    switchToLogin: "لديك حساب بالفعل؟ تسجيل الدخول",
    switchToRegister: "ليس لديك حساب؟ إنشاء حساب جديد",
    passwordsDontMatch: "كلمات المرور غير متطابقة",
    authError: "حدث خطأ. يرجى التحقق من بيانات الاعتماد الخاصة بك."
  }
};

const t = (key: string) => translations.ar[key as keyof typeof translations.ar] || key;

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Disable demo mode to use real authentication
    const isDemoMode = false;
    
    try {
      if (isDemoMode) {
        // In demo mode, we'll bypass actual authentication and simulate a successful login
        // This is only for demo purposes - in a real app, you'd use real credentials
        localStorage.setItem('simplibiz_demo_user', JSON.stringify({
          id: 'demo-user-id',
          email: email || 'demo@example.com'
        }));
        // Always redirect to cashier page (root route)
        navigate('/');
        return;
      }
      
      if (isLogin) {
        await signIn(email, password);
        // Always redirect to cashier page (root route)
        navigate('/');
      } else {
        if (password !== confirmPassword) {
          setError(t('passwordsDontMatch'));
          setLoading(false);
          return;
        }
        await signUp(email, password);
        // User will be automatically logged in after signup
        // Always redirect to cashier page (root route)
        navigate('/');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      // Provide more specific error messages
      if (error?.message) {
        if (error.message.includes('Invalid login credentials')) {
          setError(t('invalidCredentials'));
        } else {
          setError(`${t('authError')} (${error.message})`);
        }
      } else {
        setError(t('authError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">{t('appName')}</h1>
        
        <h2 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? t('login') : t('register')}
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="email">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-gray-700 mb-2" htmlFor="confirmPassword">
                {t('confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 mb-4"
          >
            {isLogin ? t('loginButton') : t('registerButton')}
          </button>
        </form>
        
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-center text-blue-600 hover:text-blue-800"
        >
          {isLogin ? t('switchToRegister') : t('switchToLogin')}
        </button>
      </div>
    </div>
  );
};

export default Auth;
