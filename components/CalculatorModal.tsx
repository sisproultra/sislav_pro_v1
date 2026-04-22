
import React, { useState, useEffect } from 'react';
import { X, Delete, ChevronRight, Equal } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [shouldReset, setShouldReset] = useState(false);

  // Get system color
  const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#0054A6';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (/[0-9]/.test(e.key)) handleNumber(e.key);
      if (['+', '-', '*', '/'].includes(e.key)) handleOperator(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key);
      if (e.key === 'Enter' || e.key === '=') calculate();
      if (e.key === 'Escape') onClose();
      if (e.key === 'Backspace') handleBackspace();
      if (e.key === '.') handleNumber('.');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display, equation, shouldReset]);

  if (!isOpen) return null;

  const handleNumber = (num: string) => {
    if (shouldReset) {
      setDisplay(num);
      setShouldReset(false);
    } else {
      setDisplay(display === '0' && num !== '.' ? num : display + num);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setShouldReset(true);
  };

  const calculate = () => {
    if (!equation) return;
    const fullEquation = equation + display;
    try {
      // Basic sanitization and evaluation
      const mathEquation = fullEquation.replace(/×/g, '*').replace(/÷/g, '/');
      const result = eval(mathEquation);
      setDisplay(String(Number(result.toFixed(8))));
      setEquation('');
      setShouldReset(true);
    } catch (e) {
      setDisplay('Error');
      setEquation('');
      setShouldReset(true);
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    setShouldReset(false);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const CalcButton = ({ val, onClick, className = "", isPrimary = false }: any) => (
    <button
      onClick={onClick}
      style={isPrimary ? { backgroundColor: primaryColor } : {}}
      className={`h-14 rounded-2xl text-lg font-bold transition-all active:scale-95 flex items-center justify-center shadow-sm ${
        isPrimary 
          ? 'text-white shadow-indigo-200' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } ${className}`}
    >
      {val}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[320px] rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-2 flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calculadora</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Display Area */}
        <div className="px-6 py-4 text-right overflow-hidden">
            <div className="h-6 text-xs font-bold text-indigo-400 mb-1 truncate">
                {equation}
            </div>
            <div className="text-4xl font-bold text-gray-900 truncate tabular-nums">
                {display}
            </div>
        </div>

        {/* Keypad */}
        <div className="p-4 grid grid-cols-4 gap-2">
            <CalcButton val="C" onClick={clear} className="text-red-500 bg-red-50 hover:bg-red-100" />
            <CalcButton val={<Delete size={20} />} onClick={handleBackspace} />
            <CalcButton val="÷" onClick={() => handleOperator('÷')} className="text-indigo-600" />
            <CalcButton val="×" onClick={() => handleOperator('×')} className="text-indigo-600" />

            <CalcButton val="7" onClick={() => handleNumber('7')} />
            <CalcButton val="8" onClick={() => handleNumber('8')} />
            <CalcButton val="9" onClick={() => handleNumber('9')} />
            <CalcButton val="-" onClick={() => handleOperator('-')} className="text-indigo-600" />

            <CalcButton val="4" onClick={() => handleNumber('4')} />
            <CalcButton val="5" onClick={() => handleNumber('5')} />
            <CalcButton val="6" onClick={() => handleNumber('6')} />
            <CalcButton val="+" onClick={() => handleOperator('+')} className="text-indigo-600" />

            <CalcButton val="1" onClick={() => handleNumber('1')} />
            <CalcButton val="2" onClick={() => handleNumber('2')} />
            <CalcButton val="3" onClick={() => handleNumber('3')} />
            <CalcButton val="=" onClick={calculate} isPrimary={true} className="row-span-2 h-auto" />

            <CalcButton val="0" onClick={() => handleNumber('0')} className="col-span-2" />
            <CalcButton val="." onClick={() => handleNumber('.')} />
        </div>
        
        <div className="p-4 pt-0 text-center">
            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-tight">SISLAV TOOLKIT</p>
        </div>
      </div>
    </div>
  );
};

export default CalculatorModal;
