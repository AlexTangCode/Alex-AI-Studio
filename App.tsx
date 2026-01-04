
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  const [isInitialPullDone, setIsInitialPullDone] = useState(false);
  
  // Refs to prevent recursive updates and track sync state
  const isSyncingRef = useRef(false);

  // Modal States
  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);
  const [editingHen, setEditingHen] = useState<Hen | null>(null);
  const [editingRecord, setEditingRecord] = useState<EggRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editColor, setEditColor] = useState('');

  // 1. Initial Local Load
  useEffect(() => {
    const savedHens = localStorage.getItem(STORAGE_KEY + '_hens');
    const savedRecords = localStorage.getItem(STORAGE_KEY + '_records');
    if (savedHens) setHens(JSON.parse(savedHens));
    if (savedRecords) setRecords(JSON.parse(savedRecords));
  }, []);

  // 2. Cloud Pull Logic
  const syncFromCloud = useCallback(async (force = false) => {
    if (!user || isSyncingRef.current) return;
    
    setSyncStatus('syncing');
    isSyncingRef.current = true;
    
    try {
      const remoteData = await pullFromCloud(user.cloudId);
      
      if (remoteData) {
        if (remoteData.isNewUser) {
          console.log('[App] 云端尚无数据，准备初始化本地数据到云端');
          const pushSuccess = await pushToCloud(user.cloudId, { hens, records });
          if (pushSuccess) setLastRemoteUpdate(Date.now());
        } else if (force || remoteData.lastUpdated > lastRemoteUpdate) {
          console.log('[App] 云端数据较新，正在更新本地...');
          setHens(remoteData.hens || []);
          setRecords(remoteData.records || []);
          setLastRemoteUpdate(remoteData.lastUpdated);
        } else {
          console.log('[App] 本地数据已是最新');
        }
        setIsInitialPullDone(true);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('[App] 同步拉取异常:', err);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, lastRemoteUpdate, hens, records]);

  // 3. Cloud Push Logic
  const syncToCloud = useCallback(async () => {
    // 关键点：如果还没完成第一次拉取，绝对不允许上传，否则会覆盖云端数据
    if (!user || !isInitialPullDone || isSyncingRef.current) return;
    
    setSyncStatus('syncing');
    isSyncingRef.current = true;
    
    try {
      const success = await pushToCloud(user.cloudId, { hens, records });
      if (success) {
        setSyncStatus('synced');
        setLastRemoteUpdate(Date.now());
      } else {
        setSyncStatus('error');
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, hens, records, isInitialPullDone]);

  // Login handler
  const handleLogin = (newUser: User) => {
    setUser(newUser);
    setIsInitialPullDone(false); // 强制重新触发拉取
    setLastRemoteUpdate(0);
    localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    if (confirm('确定退出登录吗？数据将保留在本地及云端。')) {
      setUser(null);
      setIsInitialPullDone(false);
      localStorage.removeItem(STORAGE_KEY + '_user');
    }
  };

  // Effect: Auto Pull on Periodically (30s)
  useEffect(() => {
    if (user) {
      if (!isInitialPullDone) {
        syncFromCloud(true);
      }
      const interval = setInterval(() => syncFromCloud(), 30000);
      return () => clearInterval(interval);
    }
  }, [user, isInitialPullDone, syncFromCloud]);

  // Effect: Auto Push on Data Change (only after first pull)
  useEffect(() => {
    if (!user || !isInitialPullDone) return;
    
    const timeout = setTimeout(() => {
      syncToCloud();
    }, 2000); // 更改后2秒同步一次
    
    localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));

    return () => clearTimeout(timeout);
  }, [hens, records, user, isInitialPullDone, syncToCloud]);

  // UI Helpers
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
  const deleteRecord = (id: string) => confirm('确认删除该记录吗？') && setRecords(records.filter(r => r.id !== id));
  const addNewHen = () => {
    const nh = { id: Math.random().toString(36).substr(2, 9), name: `新母鸡`, color: AVAILABLE_COLORS[hens.length % AVAILABLE_COLORS.length], avatar: AVAILABLE_AVATARS[hens.length % AVAILABLE_AVATARS.length] };
    setHens([...hens, nh]);
    startEditHen(nh);
  };
  const deleteHen = (id: string) => confirm('确定移除母鸡及其所有历史数据吗？') && setHens(hens.filter(h => h.id !== id));
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
      <header className="pt-14 px-6 pb-6 bg-white shadow-sm rounded-b-[40px] mb-6 relative">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-amber-900 leading-none">鸡舍管家</h1>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-100 text-green-700' : 
                syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'syncing' ? 'animate-pulse' : ''} bg-current`}></div>
                <span className="text-[10px] font-black uppercase tracking-tight">
                  {syncStatus === 'synced' ? '已就绪' : syncStatus === 'syncing' ? '同步中' : '连接失败'}
                </span>
              </div>
            </div>
            <p className="text-slate-400 text-[10px] font-bold mt-2 truncate max-w-[180px]">账户: {user.email}</p>
          </div>
          <button 
            onClick={() => syncFromCloud(true)}
            className={`w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${syncStatus === 'syncing' ? 'opacity-50' : 'hover:bg-amber-100 hover:text-amber-600'}`}
          >
            <i className={`fa-solid fa-arrows-rotate ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </header>

      {/* 渲染模态框... */}
      {recordingForHen && <WeightModal henName={recordingForHen.name} onSave={saveEggRecord} onCancel={() => setRecordingForHen(null)} />}
      {editingRecord && <EditRecordModal record={editingRecord} henName={hens.find(h => h.id === editingRecord.henId)?.name || '母鸡'} onSave={updateEggRecord} onCancel={() => setEditingRecord(null)} />}
      {editingHen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-800 mb-6 text-center">编辑母鸡信息</h3>
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className={`w-24 h-24 ${editColor} rounded-3xl flex items-center justify-center text-5xl shadow-inner mb-4 transition-all`}>{editAvatar}</div>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-100 border-2 border-transparent focus:border-amber-400 rounded-2xl p-4 text-center font-bold outline-none transition-all" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_AVATARS.map(a => <button key={a} onClick={() => setEditAvatar(a)} className={`h-10 text-xl flex items-center justify-center rounded-xl transition-all ${editAvatar === a ? 'bg-amber-500 shadow-lg scale-110' : 'bg-slate-50 hover:bg-slate-100'}`}>{a}</button>)}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_COLORS.slice(0, 5).map(c => <button key={c} onClick={() => setEditColor(c)} className={`h-8 rounded-lg ${c} border-2 ${editColor === c ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent opacity-60'}`}></button>)}
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={saveHenEdit} className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-amber-100">保存</button>
              <button onClick={() => setEditingHen(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold">取消</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 px-4">
        {activeTab === Tab.TRACK && (
          <div className="space-y-4">
            {hens.length === 0 && (
              <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-amber-100">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-4xl mb-4 mx-auto">🏡</div>
                <p className="text-slate-400 font-black">鸡舍还是空的，快去领养母鸡吧</p>
              </div>
            )}
            {hens.map(hen => {
              const stats = getTodayStats(hen.id);
              return (
                <div key={hen.id} className="bg-white rounded-[32px] p-5 shadow-sm border border-white flex items-center active:scale-[0.98] transition-all">
                  <div onClick={() => startEditHen(hen)} className={`w-14 h-14 ${hen.color} rounded-2xl flex items-center justify-center text-3xl shadow-inner cursor-pointer hover:rotate-6 transition-transform`}>{hen.avatar}</div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-black text-slate-800">{hen.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black mt-0.5">今日: <span className="text-amber-600">{stats.count}枚</span> / {stats.avgWeight !== '-' ? stats.avgWeight + 'g' : '未称重'}</p>
                  </div>
                  <button onClick={() => handleAddEgg(hen)} className="bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-700 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm active:shadow-none"><i className="fa-solid fa-plus text-lg"></i></button>
                </div>
              )
            })}
            <button onClick={addNewHen} className="w-full py-5 border-2 border-dashed border-amber-200 rounded-[32px] text-amber-500 font-black flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors"><i className="fa-solid fa-plus-circle"></i> 领养新母鸡</button>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
             <div className="bg-white p-6 rounded-[32px] shadow-sm mb-4 border border-white">
               <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl">👩‍🌾</div>
                 <div className="flex-1 overflow-hidden">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">农场主人</p>
                   <p className="font-black text-slate-700 truncate">{user.email}</p>
                 </div>
                 <button onClick={handleLogout} className="text-red-400 text-xs font-black p-2 hover:bg-red-50 rounded-xl transition-colors">退出登录</button>
               </div>
               <div className="grid grid-cols-2 gap-3 text-center">
                 <div className="bg-slate-50 p-4 rounded-2xl">
                   <p className="text-[9px] text-slate-400 font-black mb-1 uppercase">本地蛋仓</p>
                   <p className="text-sm font-black text-slate-800">{records.length} 枚</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl">
                   <p className="text-[9px] text-slate-400 font-black mb-1 uppercase">最后同步</p>
                   <p className="text-sm font-black text-green-600">{lastRemoteUpdate > 0 ? new Date(lastRemoteUpdate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '从未'}</p>
                 </div>
               </div>
             </div>

             <h3 className="px-2 font-black text-slate-800 text-xs mb-2 uppercase tracking-widest opacity-40">鸡舍成员</h3>
             {hens.map(hen => (
               <div key={hen.id} className="bg-white p-4 rounded-[28px] flex items-center justify-between shadow-sm border border-slate-50">
                 <div className="flex items-center">
                   <div className={`w-10 h-10 ${hen.color} rounded-xl flex items-center justify-center text-xl mr-3`}>{hen.avatar}</div>
                   <div><div className="font-bold text-slate-800 text-sm">{hen.name}</div></div>
                 </div>
                 <div className="flex gap-1">
                   <button onClick={() => startEditHen(hen)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><i className="fa-solid fa-gear"></i></button>
                   <button onClick={() => deleteHen(hen.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                 </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === Tab.STATS && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800">生产趋势</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[{ id: StatPeriod.WEEK, label: '周' }, { id: StatPeriod.MONTH, label: '月' }].map(p => (
                    <button key={p.id} onClick={() => setStatPeriod(p.id)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${statPeriod === p.id ? 'bg-white text-amber-600 shadow-sm scale-105' : 'text-slate-400'}`}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} hide />
                    <Tooltip 
                      cursor={{fill: '#f8fafc', radius: 10}}
                      contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px'}} 
                    />
                    {hens.map((hen, idx) => (
                      <Bar 
                        key={hen.id} 
                        name={hen.name} 
                        dataKey={hen.name} 
                        fill={idx % 2 === 0 ? '#fb923c' : '#94a3b8'} 
                        radius={[6, 6, 0, 0]} 
                        stackId="a" 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-white">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-black text-slate-800 text-sm">产蛋流水线</h3>
                 <span className="text-[10px] font-black text-slate-300 uppercase">按时间排序</span>
               </div>
               <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                 {records.length === 0 ? <div className="text-center py-10 text-slate-300 text-xs font-black italic">尚无流水记录...</div> : 
                   [...records].sort((a,b) => b.timestamp - a.timestamp).map(r => {
                     const hen = hens.find(h => h.id === r.henId) || { name: '已移出', avatar: '🥚', color: 'bg-slate-50' };
                     return (
                       <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-white group hover:bg-white transition-colors">
                         <div className="flex items-center">
                           <span className="text-xl mr-3 group-hover:scale-110 transition-transform">{hen.avatar}</span>
                           <div>
                             <div className="font-black text-slate-700 text-xs">{hen.name}</div>
                             <div className="text-[9px] text-slate-400 font-bold">{r.date}</div>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="text-amber-600 font-black italic text-sm">{r.weight ? `${r.weight}g` : '-'}</div>
                           <button onClick={() => deleteRecord(r.id)} className="p-2 text-slate-200 hover:text-red-400 transition-colors"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                         </div>
                       </div>
                     )
                   })
                 }
               </div>
            </div>
          </div>
        )}

        {activeTab === Tab.TIPS && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                 <h2 className="text-2xl font-black mb-1">养殖专家 AI</h2>
                 <p className="text-amber-100 text-[10px] mb-8 font-black opacity-80 uppercase tracking-widest">基于真实产蛋量进行健康评估</p>
                 <button onClick={fetchAdvice} disabled={isLoadingAdvice} className="w-full bg-white text-orange-600 font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-70">
                   {isLoadingAdvice ? '正在通过卫星观察鸡舍...' : '生成本周健康报告'}
                 </button>
               </div>
               <i className="fa-solid fa-wand-magic-sparkles absolute -bottom-6 -right-6 text-white/10 text-[12rem]"></i>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 min-h-[300px]">
              {aiAdvice ? (
                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium animate-in fade-in duration-500">{aiAdvice}</div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300 text-center">
                  <i className="fa-solid fa-wheat-awn text-3xl mb-4 opacity-50"></i>
                  <p className="text-xs font-black px-4 leading-loose">点击上方按钮<br/>让 AI 给您的母鸡开个“小灶”</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[32px] px-6 py-4 flex justify-between items-center shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '蛋仓' },
          { tab: Tab.STATS, icon: 'fa-chart-simple', label: '统计' },
          { tab: Tab.MANAGE, icon: 'fa-user-nurse', label: '账户' },
          { tab: Tab.TIPS, icon: 'fa-sparkles', label: '专家' }
        ].map(item => (
          <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.tab ? 'text-amber-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <i className={`fa-solid ${item.icon} text-lg`}></i><span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
