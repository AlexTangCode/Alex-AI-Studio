
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
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<Tab>(Tab.TRACK);
  const [hens, setHens] = useState<Hen[]>([]);
  const [records, setRecords] = useState<EggRecord[]>([]);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [statPeriod, setStatPeriod] = useState<StatPeriod>(StatPeriod.WEEK);
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [syncLog, setSyncLog] = useState<string>('就绪');
  const [lastSyncTime, setLastSyncTime] = useState<string>('从未同步');
  const [isInitialPullDone, setIsInitialPullDone] = useState(false);
  
  const isSyncingRef = useRef(false);
  const lastSyncFingerprintRef = useRef('');
  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);

  const currentFingerprint = useMemo(() => {
    return `v4_${hens.length}_${records.length}_${records.slice(-1)[0]?.id || ''}`;
  }, [hens, records]);

  // Handle local persistence
  useEffect(() => {
    const sh = localStorage.getItem(STORAGE_KEY + '_hens');
    const sr = localStorage.getItem(STORAGE_KEY + '_records');
    if (sh) setHens(JSON.parse(sh));
    if (sr) setRecords(JSON.parse(sr));
  }, []);

  useEffect(() => {
    if (hens.length > 0) localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));
  }, [hens, records]);

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(user));
  }, [user]);

  const addLog = (msg: string, isError = false) => {
    setSyncLog(msg);
    if (isError) setSyncStatus('error');
    else setSyncStatus('synced');
  };

  const mergeData = useCallback((remote: any) => {
    if (!remote || remote.isNewUser) return;
    if (!remote.hens?.length && !remote.records?.length) return;

    setHens(prev => {
      const localMap = new Map(prev.map(h => [h.id, h]));
      (remote.hens || []).forEach((rh: Hen) => {
        localMap.set(rh.id, rh);
      });
      return Array.from(localMap.values());
    });

    setRecords(prev => {
      const localMap = new Map(prev.map(r => [r.id, r]));
      (remote.records || []).forEach((rr: EggRecord) => {
        localMap.set(rr.id, rr);
      });
      return Array.from(localMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
    
    setLastSyncTime(new Date().toLocaleTimeString());
  }, []);

  const performSync = useCallback(async (isManual = false) => {
    if (!user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    if (isManual) addLog('正在尝试同步...');

    try {
      const remote = await pullFromCloud(user.cloudId);
      
      if (remote && remote.isNewUser) {
        if (hens.length > 0) {
          addLog('同步中...');
          await pushToCloud(user.cloudId, { hens, records });
          addLog('云端已更新');
        } else {
          addLog('云端暂无数据');
        }
      } else if (remote) {
        const remoteFingerprint = `v4_${remote.hens?.length}_${remote.records?.length}_${remote.records?.slice(-1)[0]?.id || ''}`;
        if (remoteFingerprint !== currentFingerprint || hens.length === 0) {
          mergeData(remote);
          lastSyncFingerprintRef.current = remoteFingerprint;
          addLog('同步完成');
        } else if (currentFingerprint !== lastSyncFingerprintRef.current) {
          await pushToCloud(user.cloudId, { hens, records });
          addLog('云端已同步');
          lastSyncFingerprintRef.current = currentFingerprint;
        } else {
          addLog('已是最新');
        }
      }
      setIsInitialPullDone(true);
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      addLog('同步异常', true);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, currentFingerprint, hens, records, mergeData]);

  useEffect(() => {
    if (user && !isInitialPullDone) {
      performSync();
    }
  }, [user, isInitialPullDone, performSync]);

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
  };

  const statsData = useMemo(() => {
    const days = statPeriod === StatPeriod.WEEK ? 7 : 30;
    const now = new Date();
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = records.filter(r => r.date === dateStr).length;
      data.push({ name: dateStr.split('-').slice(1).join('/'), count });
    }
    return data;
  }, [records, statPeriod]);

  const fetchAdvice = async () => {
    setIsLoadingAdvice(true);
    const advice = await getHenAdvice(records, hens);
    setAiAdvice(advice || "AI 忙碌中，请稍后再试。");
    setIsLoadingAdvice(false);
  };

  if (!user) {
    return <AuthModal onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-black text-slate-800">快乐鸡舍 🐔</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'bg-blue-400 animate-pulse' : syncStatus === 'error' ? 'bg-red-400' : 'bg-green-400'}`}></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{syncLog} · {lastSyncTime}</span>
          </div>
        </div>
        <button onClick={() => performSync(true)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 active:rotate-180 transition-all duration-500">
          <i className="fa-solid fa-arrows-rotate"></i>
        </button>
      </div>

      <main className="p-6">
        {activeTab === Tab.TRACK && (
          <div className="grid gap-4">
            {hens.length === 0 && (
              <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">还没有母鸡，去管理页面添加吧！</p>
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
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#cbd5e1'}} />
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
                <h3 className="font-black text-amber-900">AI 养鸡助理</h3>
                <button 
                  onClick={fetchAdvice}
                  disabled={isLoadingAdvice}
                  className="bg-white text-amber-600 text-xs font-bold px-4 py-2 rounded-xl shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isLoadingAdvice ? '思考中...' : '获取建议'}
                </button>
              </div>
              <div className="text-amber-800 text-sm leading-relaxed whitespace-pre-wrap">
                {aiAdvice || "点击上方按钮，让 AI 分析目前的产蛋数据并提供专业建议。"}
              </div>
            </div>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100">
              <h3 className="font-black text-slate-800 mb-4">鸡群管理</h3>
              <div className="space-y-3">
                {hens.map(hen => (
                  <div key={hen.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${hen.color} rounded-full flex items-center justify-center text-xl`}>{hen.avatar}</div>
                      <span className="font-bold text-slate-700">{hen.name}</span>
                    </div>
                    <button 
                      onClick={() => setHens(prev => prev.filter(h => h.id !== hen.id))}
                      className="text-red-400 p-2"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const name = prompt('母鸡名字?');
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
                  className="w-full py-4 border-2 border-dashed border-amber-200 rounded-2xl text-amber-600 font-bold flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i> 添加母鸡
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900 rounded-[32px] p-2 flex items-center justify-around shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '记录' },
          { tab: Tab.STATS, icon: 'fa-chart-simple', label: '数据' },
          { tab: Tab.MANAGE, icon: 'fa-kiwi-bird', label: '管理' }
        ].map(item => (
          <button 
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            className={`flex-1 flex flex-col items-center py-2 transition-all ${activeTab === item.tab ? 'text-amber-400 scale-110' : 'text-slate-500'}`}
          >
            <i className={`fa-solid ${item.icon} text-lg mb-1`}></i>
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
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
