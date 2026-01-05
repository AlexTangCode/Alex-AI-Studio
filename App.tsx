
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Hen, EggRecord, Tab, StatPeriod, User, SyncStatus } from './types';
import { STORAGE_KEY, AVAILABLE_AVATARS, AVAILABLE_COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { getHenAdvice } from './services/geminiService';
import { pushToCloud, pullFromCloud, encodeData, decodeData } from './services/syncService';
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

  useEffect(() => {
    const sh = localStorage.getItem(STORAGE_KEY + '_hens');
    const sr = localStorage.getItem(STORAGE_KEY + '_records');
    if (sh) setHens(JSON.parse(sh));
    if (sr) setRecords(JSON.parse(sr));
  }, []);

  const addLog = (msg: string, isError = false) => {
    setSyncLog(msg);
    if (isError) setSyncStatus('error');
    else setSyncStatus('synced');
  };

  const mergeData = useCallback((remote: any) => {
    if (!remote || remote.isNewUser) return;
    
    setHens(prev => {
      const merged = [...prev];
      (remote.hens || []).forEach((rh: Hen) => {
        if (!merged.find(lh => lh.id === rh.id)) merged.push(rh);
      });
      return merged;
    });

    setRecords(prev => {
      const localMap = new Map(prev.map(r => [r.id, r]));
      (remote.records || []).forEach((rr: EggRecord) => {
        localMap.set(rr.id, rr);
      });
      return Array.from(localMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
  }, []);

  const performSync = useCallback(async (isManual = false) => {
    if (!user || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    if (isManual) addLog('正在尝试连接云端...');
    
    try {
      const remote = await pullFromCloud(user.cloudId);
      if (remote && remote.isNewUser) {
        addLog('初始化新空间...');
        await pushToCloud(user.cloudId, { hens, records });
        addLog('初始化完成');
      } else if (remote) {
        const remoteFingerprint = JSON.stringify({ hens: remote.hens, records: remote.records });
        if (remoteFingerprint !== currentFingerprint) {
          mergeData(remote);
          lastSyncFingerprintRef.current = remoteFingerprint;
          addLog('已同步最新数据');
        } else {
          addLog('已是最新状态');
        }
      }
      setIsInitialPullDone(true);
      setSyncStatus('synced');
    } catch (err: any) {
      addLog(err.message || '连接受限', true);
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
      addLog('写入失败(请检查网络)', true);
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, hens, records, isInitialPullDone, currentFingerprint]);

  useEffect(() => {
    if (user) {
      performSync();
      const timer = setInterval(() => performSync(), 45000);
      return () => clearInterval(timer);
    }
  }, [user, performSync]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));
    const timer = setTimeout(() => uploadData(), 3000);
    return () => clearTimeout(timer);
  }, [hens, records, uploadData]);

  const handleExport = () => {
    const code = encodeData({ hens, records });
    const input = document.createElement('textarea');
    input.value = code; document.body.appendChild(input);
    input.select(); document.execCommand('copy');
    document.body.removeChild(input);
    alert('备份代码已复制！');
  };

  const handleImport = () => {
    const code = prompt('请粘贴备份代码：');
    if (code) {
      const data = decodeData(code);
      if (data) { mergeData(data); alert('导入成功！'); }
      else alert('代码错误。');
    }
  };

  const handleLogin = (u: User) => { setUser(u); setIsInitialPullDone(false); localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(u)); };
  const handleLogout = () => confirm('确定退出并清除本地缓存吗？') && (localStorage.clear(), window.location.reload());

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
      <header className="pt-14 px-6 pb-6 bg-white shadow-sm rounded-b-[40px] mb-6 border-b border-amber-100 sticky top-0 z-40">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-amber-900 leading-none">同步码: {user.email}</h1>
              <div className={`w-3 h-3 rounded-full shadow-sm transition-colors ${syncStatus === 'synced' ? 'bg-green-500' : syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-bounce'}`}></div>
            </div>
            <p className={`text-[11px] font-bold mt-2 uppercase tracking-widest ${syncStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
              {syncLog}
            </p>
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
                <p className="text-slate-400 font-bold">请点击下方按钮添加母鸡</p>
              </div>
            )}
            {hens.map(h => {
              const hr = records.filter(r => r.henId === h.id && r.date === todayStr);
              return (
                <div key={h.id} className="bg-white rounded-[32px] p-5 shadow-sm border border-white flex items-center">
                  <div className={`w-14 h-14 ${h.color} rounded-2xl flex items-center justify-center text-3xl shadow-inner`}>{h.avatar}</div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-black text-slate-800">{h.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black">今日蛋量: <span className="text-amber-600 font-black text-base ml-1">{hr.length}</span></p>
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
                  {statPeriod === StatPeriod.WEEK ? '近7天' : '近30天'}
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
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4">
             <div className="bg-white p-8 rounded-[40px] shadow-sm border border-white text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[4px] mb-4">云端同步设置</p>
                <div className="inline-block bg-amber-50 px-8 py-4 rounded-[32px] border-2 border-amber-100 text-3xl font-black text-amber-600 mb-6 tracking-widest">
                  {user.email}
                </div>
                
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 text-left mb-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">同步控制</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExport} className="bg-white border border-slate-200 text-slate-700 font-black py-4 rounded-2xl text-[11px] uppercase shadow-sm">复制备份</button>
                    <button onClick={handleImport} className="bg-white border border-slate-200 text-slate-700 font-black py-4 rounded-2xl text-[11px] uppercase shadow-sm">导入合并</button>
                  </div>
                  <button onClick={() => performSync(true)} className="w-full mt-3 bg-amber-500 text-white font-black py-4 rounded-2xl text-[11px] uppercase shadow-lg shadow-amber-100">手动刷新云端</button>
                </div>

                <button onClick={handleLogout} className="text-slate-300 font-black py-2 text-[10px] uppercase tracking-widest">退出登录</button>
             </div>
             
             <div className="bg-white p-6 rounded-[40px] shadow-sm border border-white">
                <h3 className="font-black text-slate-800 text-xs mb-6 uppercase tracking-widest opacity-30 text-center">修改母鸡</h3>
                <div className="space-y-3">
                  {hens.map(h => (
                    <div key={h.id} className="bg-slate-50 p-4 rounded-[24px] flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className={`w-10 h-10 ${h.color} rounded-xl flex items-center justify-center text-xl`}>{h.avatar}</span>
                        <input className="bg-transparent font-black text-slate-700 text-sm outline-none w-24" value={h.name} onChange={e => setHens(hens.map(x => x.id === h.id ? {...x, name: e.target.value} : x))} />
                      </div>
                      <button onClick={() => confirm('确认删除？') && setHens(hens.filter(x => x.id !== h.id))} className="text-slate-200 hover:text-red-400"><i className="fa-solid fa-circle-xmark"></i></button>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === Tab.TIPS && (
          <div className="space-y-4">
             <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-8 rounded-[40px] text-white shadow-xl shadow-orange-200">
                <h2 className="text-2xl font-black mb-2">养鸡 AI 顾问</h2>
                <button onClick={async () => { setIsLoadingAdvice(true); setAiAdvice(await getHenAdvice(records, hens) || ''); setIsLoadingAdvice(false); }} disabled={isLoadingAdvice} className="w-full bg-white text-orange-600 font-black py-5 rounded-[28px] mt-6 shadow-md">
                  {isLoadingAdvice ? '正在分析数据...' : '获取喂养报告'}
                </button>
             </div>
             <div className="bg-white p-8 rounded-[40px] border border-white shadow-sm min-h-[200px]">
               {aiAdvice ? <div className="text-slate-600 text-sm leading-relaxed font-bold">{aiAdvice}</div> : <div className="text-slate-300 text-center py-10 italic">分析报告将在这里显示</div>}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[32px] px-8 py-5 flex justify-between items-center shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '记录' },
          { tab: Tab.STATS, icon: 'fa-chart-simple', label: '走势' },
          { tab: Tab.MANAGE, icon: 'fa-cloud', label: '云端' },
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
          }} 
          onCancel={() => setRecordingForHen(null)} 
        />
      )}
    </div>
  );
};

export default App;
