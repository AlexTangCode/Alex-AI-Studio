
import React, { useState } from 'react';
import { authenticate } from '../services/authService';
import { User } from '../types';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const user = await authenticate(email, password);
      onLogin(user);
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-amber-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-[30px] text-4xl mb-4 shadow-sm animate-bounce">🐔</div>
          <h1 className="text-3xl font-black text-amber-900">鸡舍管家</h1>
          <p className="text-slate-400 font-medium mt-2">登录后即可多端实时同步</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 ml-4 uppercase tracking-widest">邮箱地址</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white border-2 border-transparent focus:border-amber-400 rounded-3xl p-5 outline-none font-bold shadow-sm transition-all"
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-400 ml-4 uppercase tracking-widest">访问密码</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white border-2 border-transparent focus:border-amber-400 rounded-3xl p-5 outline-none font-bold shadow-sm transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-amber-200 transition-all active:scale-95 disabled:opacity-70"
          >
            {loading ? '同步中...' : '进入我的鸡舍'}
          </button>
        </form>

        <p className="text-center mt-8 text-slate-400 text-xs px-6 leading-relaxed">
          温馨提示：如果账号不存在将自动创建。数据存储在加密云端，确保隐私安全。
        </p>
      </div>
    </div>
  );
};

export default AuthModal;
