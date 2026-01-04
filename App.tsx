
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Hen, EggRecord, Tab, StatPeriod, User, SyncStatus } from './types';
import { STORAGE_KEY, AVAILABLE_AVATARS, AVAILABLE_COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { getHenAdvice } from './services/geminiService';
import { pushToCloud, pullFromCloud } from './services/syncService';
import WeightModal from './components/WeightModal';
import AuthModal from './components/AuthModal';

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
  const [isInitialPullDone, setIsInitialPullDone] = useState(false);
  
  const isSyncingRef = useRef(false);
  const lastSyncFingerprintRef = useRef('');

  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);

  const currentFingerprint = useMemo(() => JSON.stringify({ hens, records }), [hens, records]);

  // 初始化本地数据
  useEffect(() => {
    const sh = localStorage.getItem(STORAGE_KEY + '_hens');
    const sr = localStorage.getItem(STORAGE_KEY + '_records');
    if (sh) setHens(JSON.parse(sh));
    if (sr) setRecords(JSON.parse(sr));
  }, []);

  const addLog = (msg: string, isError = false) => {
    setSyncLog(msg);
    if (isError) setSyncStatus('error');
  };

  const mergeData = useCallback((remote: any) => {
    setHens(prev => {
      const merged = [...prev];
      (remote.hens || []).forEach((rh: Hen) => {
        if (!merged.find(lh => lh.id === rh.id)) merged.push(rh);
      });
      return merged;
    });
    setRecords(prev => {
      const merged = [...prev];
      (remote.records || []).forEach((rr: EggRecord) => {
        if (!merged.find(lr => lr.id === rr.id)) merged.push(rr);
      });
      return merged.sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  const performSync = useCallback(async (isManual = false) => {
    if (!user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    
    try {
      const remote = await pullFromCloud(user.cloudId);
      
      if (remote && remote.isNewUser) {
        addLog('首次使用，同步中...');
        await pushToCloud(user.cloudId, { hens, records });
        addLog('云端初始化完成');
      } else if (remote) {
        const remoteFingerprint = JSON.stringify({ hens: remote.hens, records: remote.records });
        if (remoteFingerprint !== currentFingerprint) {
          mergeData(remote);
          lastSyncFingerprintRef.current = remoteFingerprint;
          addLog('已从云端同步');
        } else {
          addLog('已是最新状态');
        }
      }
      setIsInitialPullDone(true);
      setSyncStatus('synced');
    } catch (err: any) {
      addLog(err.message || '连接失败', true);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, currentFingerprint, hens, records, mergeData]);

  const uploadData = useCallback(async () => {
    if (!user || !isInitialPullDone || isSyncingRef.current) return;
    if (currentFingerprint === lastSyncFingerprintRef.current) return;

    isSyncingRef.current = true;
    setSyncStatus('syncing');
    try {
      await pushToCloud(user.cloudId, { hens, records });
      lastSyncFingerprintRef.current = currentFingerprint;
      addLog('已保存至云端');
      setSyncStatus('synced');
    } catch (err: any) {
      addLog('保存受阻', true);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, hens, records, isInitialPullDone, currentFingerprint]);

  // 轮询同步
  useEffect(() => {
    if (user) {
      performSync();
      const timer = setInterval(() => performSync(), 30000);
      return () => clearInterval(timer);
    }
  }, [user, performSync]);

  // 数据变动保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));
    const timer = setTimeout(() => uploadData(), 1500);
    return () => clearTimeout(timer);
  }, [hens, records, uploadData]);

  const handleLogin = (u: User) => { 
    setUser(u); 
    setIsInitialPullDone(false); 
    localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(u)); 
  };

  const handleLogout = () => {
    if (confirm('登出将清除本地缓存。若要换手机，请记住当前的同步码。确定吗？')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const statsData = useMemo(() => {
    const days = statPeriod === StatPeriod.WEEK ? 7 : 30;
    const res = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dr = records.filter(r => r.date === ds);
      const row: any = { name: ds.slice(5) };
      hens.forEach(h => row[h.name] = dr.filter(r => r.henId === h.id).length);
      res.push(row);
    }
    return res;
  }, [records, hens, statPeriod]);

  if (!user) return <AuthModal onLogin={handleLogin} />;

  return (
    <div className="max-w-md mx-auto min-h-screen pb-24 flex flex-col bg-amber-50/50">
      <header className="pt-14 px-6 pb-6 bg-white shadow-sm rounded-b-[40px] mb-6 border-b border-amber-100">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-amber-900 leading-none">同步码: {user.email}</h1>
              <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-bounce'}`}></div>
            </div>
            <p className={`text-[10px] font-bold mt-2 uppercase tracking-widest ${syncStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>{syncLog}</p>
          </div>
          <button onClick={() => performSync(true)} className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center active:scale-90 transition-all border border-amber-100 shadow-sm">
            <i className={`fa-solid fa-sync ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4">
        {activeTab === Tab.TRACK && (
          <div className="space-y-4">
            {hens.length === 0 && (
              <div className="text-center py-20 bg-white/50 rounded-[40px] border-2 border-dashed border-amber-200">
                <p className="text-slate-400 font-bold">快给你的母鸡起个名吧</p>
              </div>
            )}
            {hens.map(h => {
              const hr = records.filter(r => r.henId === h.id && r.date === todayStr);
              return (
                <div key={h.id} className="bg-white rounded-[32px] p-5 shadow-sm border border-white flex items-center transition-all active:bg-amber-50">
                  <div className={`w-14 h-14 ${h.color} rounded-2xl flex items-center justify-center text-3xl shadow-inner`}>{h.avatar}</div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-black text-slate-800">{h.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">今日蛋量: <span className="text-amber-600 font-black text-base ml-1">{hr.length}</span></p>
                  </div>
                  <button onClick={() => setRecordingForHen(h)} className="bg-amber-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 shadow-lg shadow-amber-100"><i className="fa-solid fa-plus"></i></button>
                </div>
              );
            })}
            <button onClick={() => setHens([...hens, { id: Math.random().toString(36).substr(2, 9), name: `母鸡${hens.length+1}`, color: AVAILABLE_COLORS[hens.length % 10], avatar: AVAILABLE_AVATARS[hens.length % 10] }])} className="w-full py-6 border-4 border-dotted border-amber-100 rounded-[32px] text-amber-400 font-black flex items-center justify-center gap-2">添加成员</button>
          </div>
        )}

        {activeTab === Tab.STATS && (
           <div className="space-y-4">
            <div className="bg-white p-6 rounded-[40px] shadow-sm border border-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800">产量走势</h3>
                <button onClick={() => setStatPeriod(statPeriod === StatPeriod.WEEK ? StatPeriod.MONTH : StatPeriod.WEEK)} className="text-[10px] font-black bg-amber-50 text-amber-600 px-4 py-2 rounded-xl border border-amber-100">
                  {statPeriod === StatPeriod.WEEK ? '本周' : '本月'}
                </button>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={statsData}>
                    <Tooltip cursor={{fill: '#fff7ed', radius: 12}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.05)'}} />
                    {hens.map((h, i) => <Bar key={h.id} dataKey={h.name} stackId="a" fill={i === 0 ? '#f59e0b' : '#fbbf24'} radius={i === hens.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[40px] shadow-sm max-h-[350px] overflow-y-auto border border-white">
               <h3 className="font-black text-slate-800 text-xs mb-4 uppercase tracking-widest opacity-30 text-center">最近记录 (50条)</h3>
               {records.length === 0 ? <p className="text-center text-slate-300 py-10 font-bold text-xs">暂无数据</p> : 
                 [...records].reverse().slice(0, 50).map(r => {
                   const h = hens.find(x => x.id === r.henId) || { name: '未知', avatar: '🥚' };
                   return (
                     <div key={r.id} className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0">
                       <div className="flex items-center gap-4">
                         <span className="text-2xl">{h.avatar}</span>
                         <div><p className="font-bold text-slate-700 text-sm">{h.name}</p><p className="text-[9px] text-slate-400 font-black">{r.date}</p></div>
                       </div>
                       <button onClick={() => confirm('确认删除？') && setRecords(records.filter(x => x.id !== r.id))} className="text-slate-200 hover:text-red-400"><i className="fa-solid fa-trash-can text-sm"></i></button>
                     </div>
                   );
                 })
               }
            </div>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
             <div className="bg-white p-8 rounded-[40px] shadow-sm border border-white text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] mb-4">当前同步码</p>
                <div className="inline-block bg-amber-50 px-8 py-4 rounded-[32px] border-2 border-amber-100 text-3xl font-black text-amber-600 mb-6 tracking-widest">
                  {user.email}
                </div>
                <div className="space-y-3">
                  <button onClick={() => performSync(true)} className="w-full bg-amber-500 text-white font-black py-4 rounded-[28px] text-sm shadow-lg shadow-amber-100 active:scale-95 transition-all">强制云端同步</button>
                  <button onClick={handleLogout} className="w-full bg-slate-50 text-slate-400 font-black py-4 rounded-[28px] text-xs uppercase active:bg-red-50 active:text-red-400">登出账户</button>
                </div>
             </div>
             <div className="bg-white p-6 rounded-[40px] shadow-sm border border-white">
                <h3 className="font-black text-slate-800 text-xs mb-6 uppercase tracking-widest opacity-30">成员信息</h3>
                <div className="space-y-3">
                  {hens.map(h => (
                    <div key={h.id} className="bg-slate-50 p-4 rounded-[24px] flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 ${h.color} rounded-xl flex items-center justify-center text-xl`}>{h.avatar}</span>
                        <input className="bg-transparent font-black text-slate-700 text-sm outline-none w-24" value={h.name} onChange={e => setHens(hens.map(x => x.id === h.id ? {...x, name: e.target.value} : x))} />
                      </div>
                      <button onClick={() => confirm('确认删除？') && setHens(hens.filter(x => x.id !== h.id))} className="text-slate-200"><i className="fa-solid fa-minus-circle"></i></button>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === Tab.TIPS && (
          <div className="space-y-4">
             <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 rounded-[40px] text-white shadow-xl shadow-amber-200/50">
                <h2 className="text-2xl font-black mb-2">养鸡 AI 顾问</h2>
                <p className="text-amber-50 text-xs font-bold mb-8 uppercase tracking-widest opacity-80">根据产蛋记录给出科学喂养方案</p>
                <button onClick={async () => { setIsLoadingAdvice(true); setAiAdvice(await getHenAdvice(records, hens) || ''); setIsLoadingAdvice(false); }} disabled={isLoadingAdvice} className="w-full bg-white text-orange-500 font-black py-5 rounded-[28px] active:scale-95 shadow-lg">
                  {isLoadingAdvice ? 'AI 正赶往鸡舍...' : '获取最新建议'}
                </button>
             </div>
             <div className="bg-white p-8 rounded-[40px] min-h-[300px] border border-white shadow-sm">
               {aiAdvice ? <div className="text-slate-600 text-sm leading-[1.8] whitespace-pre-wrap font-bold">{aiAdvice}</div> : <div className="flex flex-col items-center justify-center py-20 text-slate-200"><i className="fa-solid fa-comment-dots text-4xl mb-4"></i><p className="text-[10px] font-black uppercase">等待生成报告</p></div>}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[32px] px-8 py-5 flex justify-between items-center shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '记录' },
          { tab: Tab.STATS, icon: 'fa-chart-simple', label: '统计' },
          { tab: Tab.MANAGE, icon: 'fa-gear', label: '管理' },
          { tab: Tab.TIPS, icon: 'fa-magic', label: '专家' }
        ].map(item => (
          <button key={item.tab} onClick={() => setActiveTab(item.tab as Tab)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.tab ? 'text-amber-400 scale-125' : 'text-slate-500'}`}>
            <i className={`fa-solid ${item.icon} text-xl`}></i><span className="text-[8px] font-black uppercase">{item.label}</span>
          </button>
        ))}
      </nav>

      {recordingForHen && (
        <WeightModal 
          henName={recordingForHen.name} 
          onSave={(d, w) => {
            setRecords(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), henId: recordingForHen.id, date: d, timestamp: Date.now(), weight: w }]);
            setRecordingForHen(null);
            addLog('记录已更新');
          }} 
          onCancel={() => setRecordingForHen(null)} 
        />
      )}
    </div>
  );
};

export default App;
