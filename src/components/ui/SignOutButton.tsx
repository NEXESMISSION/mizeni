import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const SignOutButton: React.FC = () => {
  const { signOut } = useAuth();
  
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <button 
      onClick={handleSignOut}
      className="flex items-center justify-center p-2 text-gray-600 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100"
      aria-label="Sign out"
    >
      <LogOut size={18} />
    </button>
  );
};

export default SignOutButton;
