
import React, { useState } from 'react';
import { authenticate } from '../services/authService';
import { User } from '../types';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const user = await authenticate(code);
      onLogin(user);
    } catch (err) {
      setError('连接同步服务器失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-amber-50">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-[40px] text-5xl mb-6 shadow-xl shadow-amber-200/50 animate-bounce">🐔</div>
        <h1 className="text-3xl font-black text-amber-900 mb-2">母鸡记账本</h1>
        <p className="text-slate-400 font-bold mb-10 text-sm">输入同步码，开启多端同步</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input 
              type="text" 
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full bg-white border-4 border-amber-100 focus:border-amber-500 rounded-[32px] p-6 text-center text-3xl font-black text-amber-600 outline-none transition-all placeholder:text-amber-100"
              placeholder="如：6688"
              required
            />
            <label className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-50 px-4 text-[10px] font-black text-amber-600 uppercase tracking-widest">设置你的同步码</label>
          </div>
          
          {error && <p className="text-red-500 text-xs font-bold bg-red-50 py-2 rounded-xl">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-6 rounded-[32px] shadow-xl shadow-amber-200 transition-all active:scale-95 disabled:opacity-70 text-xl"
          >
            {loading ? '正在同步数据...' : '进入鸡舍'}
          </button>
        </form>

        <div className="mt-12 p-6 bg-white/50 rounded-3xl border border-white">
          <p className="text-slate-400 text-xs font-bold leading-relaxed">
            💡 提示：在另一台手机上输入相同的数字，即可看到同步的数据。
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
