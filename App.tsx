
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Hen, EggRecord, Tab, StatPeriod, User, SyncStatus } from './types';
import { STORAGE_KEY, AVAILABLE_AVATARS, AVAILABLE_COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { getHenAdvice } from './services/geminiService';
import { pushToCloud, pullFromCloud, encodeData, decodeData } from './services/syncService';
import WeightModal from './components/WeightModal';
import AuthModal from './components/AuthModal';
import HenCard from './components/HenCard';

const App: React.FC = () => {
  // 1. 关键修复：使用函数式初始化，确保第一时间拿到本地数据，防止刷新时被空数组覆盖
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [hens, setHens] = useState<Hen[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_hens');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [records, setRecords] = useState<EggRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_records');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [activeTab, setActiveTab] = useState<Tab>(Tab.TRACK);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [statPeriod, setStatPeriod] = useState<StatPeriod>(StatPeriod.WEEK);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [syncLog, setSyncLog] = useState<string>('就绪');
  const [lastSyncTime, setLastSyncTime] = useState<string>('本地已保存');
  const [isInitialPullDone, setIsInitialPullDone] = useState(false);
  
  const isSyncingRef = useRef(false);
  const lastSyncFingerprintRef = useRef('');
  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);

  // 计算当前数据指纹
  const currentFingerprint = useMemo(() => {
    return `v4_${hens.length}_${records.length}_${records.slice(-1)[0]?.id || ''}`;
  }, [hens, records]);

  // 2. 实时持久化：任何状态改变立即写入 LocalStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY + '_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));
  }, [hens, records]);

  const addLog = (msg: string, isError = false) => {
    setSyncLog(msg);
    if (isError) setSyncStatus('error');
    else setSyncStatus('synced');
  };

  const mergeData = useCallback((remote: any) => {
    if (!remote || remote.isNewUser) return;

    if (remote.hens && remote.hens.length > 0) {
      setHens(remote.hens);
    }
    if (remote.records && remote.records.length > 0) {
      setRecords(remote.records);
    }
    
    setLastSyncTime(new Date().toLocaleTimeString());
    addLog('已从云端恢复');
  }, []);

  const performSync = useCallback(async (isManual = false) => {
    if (!user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    if (isManual) addLog('正在连接...');

    try {
      const remote = await pullFromCloud(user.cloudId);
      
      if (remote && remote.isNewUser) {
        // 如果是新用户且本地有数据，则上传本地数据
        if (hens.length > 0) {
          addLog('正在上传备份...');
          await pushToCloud(user.cloudId, { hens, records });
          addLog('云端同步成功');
        } else {
          addLog('云端已就绪');
        }
      } else if (remote) {
        // 数据比对与合并
        const remoteFingerprint = `v4_${remote.hens?.length}_${remote.records?.length}_${remote.records?.slice(-1)[0]?.id || ''}`;
        
        // 如果本地为空但云端有，或者指纹不一致，执行同步
        if (hens.length === 0 && remote.hens?.length > 0) {
          mergeData(remote);
          lastSyncFingerprintRef.current = remoteFingerprint;
        } else if (remoteFingerprint !== currentFingerprint && lastSyncFingerprintRef.current !== remoteFingerprint) {
          // 只有当远程数据确实发生了变化才合并
          mergeData(remote);
          lastSyncFingerprintRef.current = remoteFingerprint;
        } else if (currentFingerprint !== lastSyncFingerprintRef.current) {
          // 本地数据更新了，上传
          await pushToCloud(user.cloudId, { hens, records });
          addLog('云端已更新');
          lastSyncFingerprintRef.current = currentFingerprint;
        } else {
          addLog('已是最新');
        }
      }
      setIsInitialPullDone(true);
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      addLog('同步受限', true);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, currentFingerprint, hens, records, mergeData]);

  // 初始同步
  useEffect(() => {
    if (user && !isInitialPullDone) {
      performSync();
    }
  }, [user, isInitialPullDone, performSync]);

  // 退出逻辑
  const handleLogout = () => {
    if (confirm('确定要清除本地缓存并退出吗？')) {
      localStorage.removeItem(STORAGE_KEY + '_user');
      localStorage.removeItem(STORAGE_KEY + '_hens');
      localStorage.removeItem(STORAGE_KEY + '_records');
      window.location.reload();
    }
  };

  const handleLogin = (u: User) => {
    // 强制立即写入，防止刷新失效
    localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(u));
    setUser(u);
    setIsInitialPullDone(false);
  };

  const saveEggRecord = (date: string, weight?: number) => {
    if (!recordingForHen) return;
    const newRecord: EggRecord = {
      id: `egg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      henId: recordingForHen.id,
      date,
      timestamp: new Date(date).getTime(),
      weight
    };
    setRecords(prev => [...prev, newRecord].sort((a, b) => a.timestamp - b.timestamp));
    setRecordingForHen(null);
    // 操作后尝试自动同步
    setTimeout(() => performSync(), 500);
  };

  const fetchAdvice = async () => {
    setIsLoadingAdvice(true);
    const advice = await getHenAdvice(records, hens);
    setAiAdvice(advice || "AI 忙碌中。");
    setIsLoadingAdvice(false);
  };

  if (!user) {
    return <AuthModal onLogin={handleLogin} />;
  }

  const statsData = useMemo(() => {
    const days = statPeriod === StatPeriod.WEEK ? 7 : 30;
    const now = new Date();
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = records.filter(r => r.date === dateStr).length;
      data.push({ name: dateStr.split('-').slice(5).join('/'), count });
    }
    return data;
  }, [records, statPeriod]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">快乐鸡舍 🐔</h1>
            <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-black uppercase">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-400' : 'bg-green-400'}`}></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{syncLog} · {lastSyncTime}</span>
          </div>
        </div>
        <button onClick={() => performSync(true)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${syncStatus === 'syncing' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500 active:scale-90'}`}>
          <i className={`fa-solid fa-arrows-rotate ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
        </button>
      </div>

      <main className="p-6">
        {activeTab === Tab.TRACK && (
          <div className="grid gap-4">
            {hens.length === 0 && (
              <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">还没有母鸡，去“管理”添加吧！</p>
                <button onClick={() => setActiveTab(Tab.MANAGE)} className="mt-4 text-amber-600 font-black text-sm">点击前往添加</button>
              </div>
            )}
            {hens.map(hen => (
              <HenCard 
                key={hen.id} 
                hen={hen} 
                todayCount={records.filter(r => r.henId === hen.id && r.date === new Date().toISOString().split('T')[0]).length}
                onAdd={(count) => {
                  if (count > 0) setRecordingForHen(hen);
                  else {
                    const todayRecords = records.filter(r => r.henId === hen.id && r.date === new Date().toISOString().split('T')[0]);
                    if (todayRecords.length > 0) {
                      const lastId = todayRecords[todayRecords.length - 1].id;
                      setRecords(prev => prev.filter(r => r.id !== lastId));
                    }
                  }
                }}
              />
            ))}
          </div>
        )}

        {activeTab === Tab.STATS && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-800">产蛋量趋势</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[StatPeriod.WEEK, StatPeriod.MONTH].map(p => (
                    <button 
                      key={p}
                      onClick={() => setStatPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statPeriod === p ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      {p === StatPeriod.WEEK ? '周' : '月'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {statsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#f59e0b' : '#f1f5f9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-amber-900">AI 助理分析</h3>
                <button 
                  onClick={fetchAdvice}
                  disabled={isLoadingAdvice}
                  className="bg-white text-amber-600 text-[10px] font-black px-4 py-2 rounded-xl shadow-sm active:scale-95 disabled:opacity-50 uppercase"
                >
                  {isLoadingAdvice ? '正在分析...' : '一键咨询'}
                </button>
              </div>
              <div className="text-amber-800 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                {aiAdvice || "AI 将根据你记录的数据分析母鸡的健康状况并给出饲养方案。"}
              </div>
            </div>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100">
              <h3 className="font-black text-slate-800 mb-4 text-sm uppercase tracking-widest">鸡群管理</h3>
              <div className="space-y-3">
                {hens.map(hen => (
                  <div key={hen.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${hen.color} rounded-full flex items-center justify-center text-xl`}>{hen.avatar}</div>
                      <span className="font-black text-slate-700 text-sm">{hen.name}</span>
                    </div>
                    <button 
                      onClick={() => confirm(`确定删除 ${hen.name} 吗？`) && setHens(prev => prev.filter(h => h.id !== hen.id))}
                      className="text-slate-300 hover:text-red-400 p-2"
                    >
                      <i className="fa-solid fa-circle-xmark"></i>
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const name = prompt('给母鸡起个名字:');
                    if (name) {
                      const newHen: Hen = {
                        id: `hen-${Date.now()}`,
                        name,
                        color: AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)],
                        avatar: AVAILABLE_AVATARS[Math.floor(Math.random() * AVAILABLE_AVATARS.length)]
                      };
                      setHens(prev => [...prev, newHen]);
                    }
                  }}
                  className="w-full py-4 border-2 border-dashed border-amber-200 rounded-2xl text-amber-600 font-black flex items-center justify-center gap-2 text-sm"
                >
                  <i className="fa-solid fa-plus-circle"></i> 添加新成员
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">系统管理</p>
              <button onClick={handleLogout} className="text-red-400 text-xs font-black uppercase tracking-widest bg-red-50 w-full py-4 rounded-2xl active:bg-red-100 transition-colors">
                退出当前账号并清空本地
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-xl rounded-[32px] p-2 flex items-center justify-around shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '记录' },
          { tab: Tab.STATS, icon: 'fa-chart-pie', label: '分析' },
          { tab: Tab.MANAGE, icon: 'fa-gear', label: '管理' }
        ].map(item => (
          <button 
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            className={`flex-1 flex flex-col items-center py-3 transition-all ${activeTab === item.tab ? 'text-amber-400 scale-110' : 'text-slate-500'}`}
          >
            <i className={`fa-solid ${item.icon} text-lg mb-1`}></i>
            <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {recordingForHen && (
        <WeightModal 
          henName={recordingForHen.name}
          onSave={saveEggRecord}
          onCancel={() => setRecordingForHen(null)}
        />
      )}
    </div>
  );
};

export default App;
