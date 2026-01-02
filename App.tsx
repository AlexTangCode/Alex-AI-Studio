
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Hen, EggRecord, Tab, StatPeriod, User, SyncStatus } from './types';
import { STORAGE_KEY, AVAILABLE_AVATARS, AVAILABLE_COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getHenAdvice } from './services/geminiService';
import { pushToCloud, pullFromCloud } from './services/syncService';
import WeightModal from './components/WeightModal';
import EditRecordModal from './components/EditRecordModal';
import AuthModal from './components/AuthModal';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Data States
  const [activeTab, setActiveTab] = useState<Tab>(Tab.TRACK);
  const [hens, setHens] = useState<Hen[]>([]);
  const [records, setRecords] = useState<EggRecord[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [statPeriod, setStatPeriod] = useState<StatPeriod>(StatPeriod.WEEK);
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastRemoteUpdate, setLastRemoteUpdate] = useState<number>(0);

  // Modal States
  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);
  const [editingHen, setEditingHen] = useState<Hen | null>(null);
  const [editingRecord, setEditingRecord] = useState<EggRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editColor, setEditColor] = useState('');

  // Initial Local Load
  useEffect(() => {
    const savedHens = localStorage.getItem(STORAGE_KEY + '_hens');
    const savedRecords = localStorage.getItem(STORAGE_KEY + '_records');
    if (savedHens) setHens(JSON.parse(savedHens));
    if (savedRecords) setRecords(JSON.parse(savedRecords));
  }, []);

  // Login handler
  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(newUser));
    setSyncStatus('syncing');
  };

  const handleLogout = () => {
    if (confirm('确定退出登录吗？本地数据将保留。')) {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY + '_user');
    }
  };

  // Cloud Pull Logic
  const syncFromCloud = useCallback(async () => {
    if (!user) return;
    const remoteData = await pullFromCloud(user.cloudId);
    if (remoteData && !remoteData.isNewUser) {
      // Simple merge: if remote is newer, take it
      if (remoteData.lastUpdated > lastRemoteUpdate) {
        setHens(remoteData.hens || []);
        setRecords(remoteData.records || []);
        setLastRemoteUpdate(remoteData.lastUpdated);
        setSyncStatus('synced');
      }
    } else {
      setSyncStatus('synced');
    }
  }, [user, lastRemoteUpdate]);

  // Cloud Push Logic
  const syncToCloud = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    const success = await pushToCloud(user.cloudId, { hens, records });
    if (success) {
      setSyncStatus('synced');
      setLastRemoteUpdate(Date.now());
    } else {
      setSyncStatus('error');
    }
  }, [user, hens, records]);

  // Effect: Auto Pull on Login and Periodically
  useEffect(() => {
    if (user) {
      syncFromCloud();
      const interval = setInterval(syncFromCloud, 30000); // 30s 轮询
      return () => clearInterval(interval);
    }
  }, [user, syncFromCloud]);

  // Effect: Debounced Auto Push on Data Change
  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(() => {
      syncToCloud();
    }, 2000); // 变化后 2 秒同步
    
    localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));

    return () => clearTimeout(timeout);
  }, [hens, records, user, syncToCloud]);

  // UI Helper
  const todayStr = new Date().toISOString().split('T')[0];
  const getTodayStats = (henId: string) => {
    const hr = records.filter(r => r.henId === henId && r.date === todayStr);
    return { count: hr.length, avgWeight: hr.length > 0 ? (hr.reduce((s, r) => s + (r.weight || 0), 0) / hr.filter(r => r.weight).length || 0).toFixed(1) : '-' };
  };

  // Operations
  const handleAddEgg = (hen: Hen) => setRecordingForHen(hen);
  const saveEggRecord = (date: string, weight?: number) => {
    if (recordingForHen) {
      setRecords([...records, { id: Math.random().toString(36).substr(2, 9), henId: recordingForHen.id, date, timestamp: Date.now(), weight }]);
      setRecordingForHen(null);
    }
  };
  const updateEggRecord = (id: string, date: string, weight?: number) => {
    setRecords(records.map(r => r.id === id ? { ...r, date, weight } : r));
    setEditingRecord(null);
  };
  const deleteRecord = (id: string) => confirm('确定删除记录？') && setRecords(records.filter(r => r.id !== id));
  const addNewHen = () => {
    const nh = { id: Math.random().toString(36).substr(2, 9), name: `新母鸡`, color: AVAILABLE_COLORS[hens.length % AVAILABLE_COLORS.length], avatar: AVAILABLE_AVATARS[hens.length % AVAILABLE_AVATARS.length] };
    setHens([...hens, nh]);
    startEditHen(nh);
  };
  const deleteHen = (id: string) => confirm('确定删除母鸡？') && setHens(hens.filter(h => h.id !== id));
  const startEditHen = (hen: Hen) => { setEditingHen(hen); setEditName(hen.name); setEditAvatar(hen.avatar); setEditColor(hen.color); };
  const saveHenEdit = () => { if (editingHen) { setHens(hens.map(h => h.id === editingHen.id ? { ...h, name: editName, avatar: editAvatar, color: editColor } : h)); setEditingHen(null); } };

  const statsData = useMemo(() => {
    const days = statPeriod === StatPeriod.WEEK ? 7 : 30;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dr = records.filter(r => r.date === ds);
      const data: any = { name: ds.slice(5) };
      hens.forEach(hen => data[hen.name] = dr.filter(r => r.henId === hen.id).length);
      result.push(data);
    }
    return result;
  }, [records, hens, statPeriod]);

  const fetchAdvice = async () => { setIsLoadingAdvice(true); const advice = await getHenAdvice(records, hens); setAiAdvice(advice || ''); setIsLoadingAdvice(false); };

  if (!user) return <AuthModal onLogin={handleLogin} />;

  return (
    <div className="max-w-md mx-auto min-h-screen pb-24 flex flex-col bg-amber-50/50">
      <header className="pt-10 px-6 pb-6 bg-white shadow-sm rounded-b-[40px] mb-6 relative">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-amber-900">鸡舍管家</h1>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              syncStatus === 'synced' ? 'bg-green-500' : 
              syncStatus === 'syncing' ? 'bg-blue-500' : 'bg-red-500'
            }`} title={syncStatus}></div>
          </div>
          <div className="bg-amber-100 px-3 py-1 rounded-full text-amber-700 text-[10px] font-black uppercase tracking-wider">
            {records.length} 🥚 总计
          </div>
        </div>
        <p className="text-slate-400 text-[10px] font-bold">在线：{user.email}</p>
      </header>

      {/* Modals */}
      {recordingForHen && <WeightModal henName={recordingForHen.name} onSave={saveEggRecord} onCancel={() => setRecordingForHen(null)} />}
      {editingRecord && <EditRecordModal record={editingRecord} henName={hens.find(h => h.id === editingRecord.henId)?.name || '母鸡'} onSave={updateEggRecord} onCancel={() => setEditingRecord(null)} />}
      {editingHen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-6 text-center">编辑母鸡</h3>
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className={`w-24 h-24 ${editColor} rounded-3xl flex items-center justify-center text-5xl shadow-inner mb-4`}>{editAvatar}</div>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-100 rounded-2xl p-4 text-center font-bold outline-none" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_AVATARS.map(a => <button key={a} onClick={() => setEditAvatar(a)} className={`h-10 text-xl flex items-center justify-center rounded-xl ${editAvatar === a ? 'bg-amber-500' : 'bg-slate-50'}`}>{a}</button>)}
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={saveHenEdit} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black">保存</button>
              <button onClick={() => setEditingHen(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold">取消</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4">
        {activeTab === Tab.TRACK && (
          <div className="space-y-4">
            {hens.length === 0 && <div className="text-center py-20 text-slate-300">还没有母鸡，点击下方新增</div>}
            {hens.map(hen => {
              const stats = getTodayStats(hen.id);
              return (
                <div key={hen.id} className="bg-white rounded-[32px] p-5 shadow-sm border border-white flex items-center group active:scale-[0.98] transition-all">
                  <div onClick={() => startEditHen(hen)} className={`w-14 h-14 ${hen.color} rounded-2xl flex items-center justify-center text-3xl shadow-inner cursor-pointer`}>{hen.avatar}</div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-bold text-slate-800">{hen.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">今日: {stats.count}枚 / {stats.avgWeight !== '-' ? stats.avgWeight + 'g' : '暂无重量'}</p>
                  </div>
                  <button onClick={() => handleAddEgg(hen)} className="bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-700 w-12 h-12 rounded-2xl flex items-center justify-center transition-colors"><i className="fa-solid fa-plus"></i></button>
                </div>
              )
            })}
            <button onClick={addNewHen} className="w-full py-5 border-2 border-dashed border-amber-200 rounded-[32px] text-amber-500 font-bold flex items-center justify-center gap-2 hover:bg-amber-50"><i className="fa-solid fa-plus-circle"></i> 新增母鸡</button>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
             <div className="bg-white p-6 rounded-[32px] shadow-sm mb-4">
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">👤</div>
                 <div className="flex-1 overflow-hidden">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">当前账户</p>
                   <p className="font-bold text-slate-700 truncate">{user.email}</p>
                 </div>
                 <button onClick={handleLogout} className="text-red-400 text-xs font-black p-2">退出登录</button>
               </div>
               <div className="grid grid-cols-2 gap-3 text-center">
                 <div className="bg-slate-50 p-4 rounded-2xl">
                   <p className="text-[10px] text-slate-400 font-black mb-1">同步状态</p>
                   <p className="text-xs font-bold text-green-600">实时自动同步</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl">
                   <p className="text-[10px] text-slate-400 font-black mb-1">最后拉取</p>
                   <p className="text-xs font-bold text-slate-600">{new Date(lastRemoteUpdate).toLocaleTimeString()}</p>
                 </div>
               </div>
             </div>

             <h3 className="px-2 font-black text-slate-800 text-sm mb-2 uppercase tracking-widest">母鸡列表 ({hens.length})</h3>
             {hens.map(hen => (
               <div key={hen.id} className="bg-white p-4 rounded-[28px] flex items-center justify-between shadow-sm border border-slate-50">
                 <div className="flex items-center">
                   <div className={`w-10 h-10 ${hen.color} rounded-xl flex items-center justify-center text-xl mr-3`}>{hen.avatar}</div>
                   <div><div className="font-bold text-slate-800 text-sm">{hen.name}</div></div>
                 </div>
                 <div className="flex gap-1">
                   <button onClick={() => startEditHen(hen)} className="p-2 text-slate-300 hover:text-amber-500"><i className="fa-solid fa-gear"></i></button>
                   <button onClick={() => deleteHen(hen.id)} className="p-2 text-slate-300 hover:text-red-500"><i className="fa-solid fa-trash-can"></i></button>
                 </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === Tab.STATS && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800">产量图表</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[{ id: StatPeriod.WEEK, label: '周' }, { id: StatPeriod.MONTH, label: '月' }].map(p => (
                    <button key={p.id} onClick={() => setStatPeriod(p.id)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${statPeriod === p.id ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <YAxis axisLine={false} tickLine={false} hide />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
                    {hens.map((hen, idx) => <Bar key={hen.id} name={hen.name} dataKey={hen.name} fill={idx % 2 === 0 ? '#fb923c' : '#94a3b8'} radius={[4, 4, 0, 0]} stackId="a" />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm">
               <h3 className="font-black text-slate-800 mb-4 text-sm">历史明细</h3>
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                 {records.length === 0 ? <div className="text-center py-10 text-slate-300 text-xs font-bold">暂无流水记录</div> : 
                   [...records].sort((a,b) => b.timestamp - a.timestamp).map(r => {
                     const hen = hens.find(h => h.id === r.henId) || { name: '已删除', avatar: '🥚', color: 'bg-slate-50' };
                     return (
                       <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-white">
                         <div className="flex items-center"><span className="text-xl mr-3">{hen.avatar}</span><div><div className="font-bold text-slate-700 text-xs">{hen.name}</div><div className="text-[9px] text-slate-400">{r.date}</div></div></div>
                         <div className="flex items-center gap-3"><div className="text-amber-600 font-black italic text-sm">{r.weight ? `${r.weight}g` : '-'}</div><button onClick={() => deleteRecord(r.id)} className="p-2 text-slate-300 hover:text-red-500"><i className="fa-solid fa-trash-can text-[10px]"></i></button></div>
                       </div>
                     )
                   })
                 }
               </div>
            </div>
          </div>
        )}

        {activeTab === Tab.TIPS && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                 <h2 className="text-2xl font-black mb-1">养殖专家</h2>
                 <p className="text-amber-100 text-[10px] mb-8 font-bold opacity-80">根据您的产蛋数据进行 AI 分析</p>
                 <button onClick={fetchAdvice} disabled={isLoadingAdvice} className="w-full bg-white text-orange-600 font-black py-4 rounded-2xl shadow-lg disabled:opacity-70 active:scale-95 transition-all">
                   {isLoadingAdvice ? 'AI 正在分析中...' : '生成健康报告'}
                 </button>
               </div>
               <i className="fa-solid fa-sparkles absolute -bottom-6 -right-6 text-white/10 text-[12rem]"></i>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 min-h-[300px]">
              {aiAdvice ? <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{aiAdvice}</div> : <div className="flex flex-col items-center justify-center py-20 text-slate-300 text-center"><i className="fa-solid fa-wand-magic-sparkles text-2xl mb-4"></i><p className="text-xs font-bold px-4">点击上方按钮，让 AI 农场主为您把脉</p></div>}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[32px] px-6 py-4 flex justify-between items-center shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '记录' },
          { tab: Tab.STATS, icon: 'fa-chart-simple', label: '统计' },
          { tab: Tab.MANAGE, icon: 'fa-user-gear', label: '账号' },
          { tab: Tab.TIPS, icon: 'fa-wand-magic-sparkles', label: 'AI' }
        ].map(item => (
          <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === item.tab ? 'text-amber-400 scale-110' : 'text-slate-500'}`}>
            <i className={`fa-solid ${item.icon} text-lg`}></i><span className="text-[9px] font-black">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
