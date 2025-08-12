import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'success' | 'error' | 'info';
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  type = 'info' 
}) => {
  useEffect(() => {
    // Close modal with escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let headerBgColor = 'bg-blue-500';
  if (type === 'success') headerBgColor = 'bg-green-500';
  if (type === 'error') headerBgColor = 'bg-red-500';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="bg-white rounded-lg shadow-xl overflow-hidden w-full max-w-md z-10">
        {/* Header */}
        <div className={`${headerBgColor} text-white py-3 px-4 flex justify-between items-center`}>
          <h3 className="text-lg font-semibold">{title}</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
        
        {/* Actions */}
        <div className="bg-gray-50 py-3 px-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
