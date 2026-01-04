
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Hen, EggRecord, Tab, StatPeriod, User, SyncStatus } from './types';
import { STORAGE_KEY, AVAILABLE_AVATARS, AVAILABLE_COLORS } from './constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getHenAdvice } from './services/geminiService';
import { pushToCloud, pullFromCloud } from './services/syncService';
import WeightModal from './components/WeightModal';
import EditRecordModal from './components/EditRecordModal';
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
  
  // 同步增强状态
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [syncLog, setSyncLog] = useState<string>('系统准备就绪');
  const [lastRemoteTime, setLastRemoteTime] = useState<number>(0);
  const [isInitialPullDone, setIsInitialPullDone] = useState(false);
  
  const isSyncingRef = useRef(false);
  const ignoreNextEffectRef = useRef(false);
  const lastSyncFingerprintRef = useRef('');

  const [recordingForHen, setRecordingForHen] = useState<Hen | null>(null);
  const [editingHen, setEditingHen] = useState<Hen | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editColor, setEditColor] = useState('');

  const currentFingerprint = useMemo(() => JSON.stringify({ hens, records }), [hens, records]);

  useEffect(() => {
    const sh = localStorage.getItem(STORAGE_KEY + '_hens');
    const sr = localStorage.getItem(STORAGE_KEY + '_records');
    if (sh) setHens(JSON.parse(sh));
    if (sr) setRecords(JSON.parse(sr));
  }, []);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSyncLog(`[${time}] ${msg}`);
  };

  const syncFromCloud = useCallback(async (isManual = false) => {
    if (!user || isSyncingRef.current) return;
    
    setSyncStatus('syncing');
    isSyncingRef.current = true;
    addLog(isManual ? '正在手动拉取云端数据...' : '正在同步检查...');
    
    try {
      const remote = await pullFromCloud(user.cloudId);
      
      if (remote) {
        if (remote.isNewUser) {
          addLog('云端无数据，准备初始化...');
          await pushToCloud(user.cloudId, { hens, records });
          lastSyncFingerprintRef.current = currentFingerprint;
          addLog('初始化同步成功');
        } else {
          const remoteFingerprint = JSON.stringify({ hens: remote.hens, records: remote.records });
          if (remoteFingerprint !== currentFingerprint || isManual) {
            ignoreNextEffectRef.current = true;
            setHens(remote.hens || []);
            setRecords(remote.records || []);
            setLastRemoteTime(remote.lastUpdated || Date.now());
            lastSyncFingerprintRef.current = remoteFingerprint;
            addLog('检测到更新，本地数据已刷新');
          } else {
            addLog('数据已是最新');
          }
        }
        setIsInitialPullDone(true);
        setSyncStatus('synced');
      }
    } catch (err: any) {
      addLog(`同步失败: ${err.message}`);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, currentFingerprint, hens, records]);

  const syncToCloud = useCallback(async () => {
    if (!user || !isInitialPullDone || isSyncingRef.current) return;
    if (currentFingerprint === lastSyncFingerprintRef.current) return;

    setSyncStatus('syncing');
    isSyncingRef.current = true;
    addLog('正在上传变更...');
    
    try {
      const success = await pushToCloud(user.cloudId, { hens, records });
      if (success) {
        setSyncStatus('synced');
        setLastRemoteTime(Date.now());
        lastSyncFingerprintRef.current = currentFingerprint;
        addLog('云端保存成功');
      }
    } catch (err: any) {
      addLog(`上传失败: ${err.message}`);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
    }
  }, [user, hens, records, isInitialPullDone, currentFingerprint]);

  useEffect(() => {
    if (user) {
      syncFromCloud();
      const timer = setInterval(() => syncFromCloud(), 20000);
      return () => clearInterval(timer);
    }
  }, [user, syncFromCloud]);

  useEffect(() => {
    if (!user || !isInitialPullDone) return;
    if (ignoreNextEffectRef.current) {
      ignoreNextEffectRef.current = false;
      return;
    }

    const timer = setTimeout(() => syncToCloud(), 1500);
    localStorage.setItem(STORAGE_KEY + '_hens', JSON.stringify(hens));
    localStorage.setItem(STORAGE_KEY + '_records', JSON.stringify(records));
    return () => clearTimeout(timer);
  }, [hens, records, user, isInitialPullDone, syncToCloud]);

  const forcePush = async () => {
    if (!user || !confirm('确定用当前手机数据覆盖云端吗？')) return;
    setSyncStatus('syncing');
    try {
      await pushToCloud(user.cloudId, { hens, records });
      lastSyncFingerprintRef.current = currentFingerprint;
      addLog('手动强制覆盖云端成功');
      alert('同步成功！');
      setSyncStatus('synced');
    } catch (err: any) {
      alert(`覆盖失败: ${err.message}`);
      setSyncStatus('error');
    }
  };

  const handleLogin = (u: User) => { 
    setUser(u); 
    setIsInitialPullDone(false); 
    localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(u));
    addLog(`欢迎回来: ${u.email}`);
  };

  const handleLogout = () => confirm('退出登录？') && (setUser(null), localStorage.removeItem(STORAGE_KEY + '_user'));

  // 渲染逻辑...
  const todayStr = new Date().toISOString().split('T')[0];
  const getTodayStats = (id: string) => {
    const hr = records.filter(r => r.henId === id && r.date === todayStr);
    return { count: hr.length, avg: hr.length > 0 ? (hr.reduce((s, r) => s + (r.weight || 0), 0) / hr.filter(r => r.weight).length || 0).toFixed(1) : '-' };
  };

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
    <div className="max-w-md mx-auto min-h-screen pb-24 flex flex-col bg-amber-50/50 select-none">
      <header className="pt-14 px-6 pb-6 bg-white shadow-sm rounded-b-[40px] mb-6 border-b border-amber-100">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-amber-900 leading-none">鸡舍管家</h1>
              <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-bounce'}`}></div>
            </div>
            <p className={`text-[10px] font-bold mt-2 transition-colors ${syncStatus === 'error' ? 'text-red-500' : 'text-slate-400'}`}>{syncLog}</p>
          </div>
          <button onClick={() => syncFromCloud(true)} className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center active:scale-90 transition-all border border-amber-100">
            <i className={`fa-solid fa-sync-alt ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4">
        {activeTab === Tab.TRACK && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {hens.map(h => {
              const s = getTodayStats(h.id);
              return (
                <div key={h.id} className="bg-white rounded-[32px] p-5 shadow-sm border border-white flex items-center">
                  <div onClick={() => {setEditingHen(h); setEditName(h.name); setEditAvatar(h.avatar); setEditColor(h.color);}} className={`w-14 h-14 ${h.color} rounded-2xl flex items-center justify-center text-3xl shadow-inner cursor-pointer`}>{h.avatar}</div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-black text-slate-800">{h.name}</h3>
                    <p className="text-[10px] text-slate-400 font-black">今日: <span className="text-amber-600 font-black">{s.count}枚</span> {s.avg !== '-' && <span className="text-slate-300 ml-1">/ {s.avg}g</span>}</p>
                  </div>
                  <button onClick={() => setRecordingForHen(h)} className="bg-amber-100 text-amber-700 w-12 h-12 rounded-2xl flex items-center justify-center active:bg-amber-500 active:text-white transition-all shadow-sm"><i className="fa-solid fa-plus text-lg"></i></button>
                </div>
              );
            })}
            <button onClick={() => {
              const nh = { id: Math.random().toString(36).substr(2, 9), name: '新母鸡', color: AVAILABLE_COLORS[hens.length % 10], avatar: AVAILABLE_AVATARS[hens.length % 10] };
              setHens([...hens, nh]);
            }} className="w-full py-5 border-2 border-dashed border-amber-200 rounded-[32px] text-amber-500 font-black flex items-center justify-center gap-2 hover:bg-white transition-colors">领养新成员</button>
          </div>
        )}

        {activeTab === Tab.MANAGE && (
          <div className="space-y-4 animate-in fade-in">
             <div className="bg-white p-6 rounded-[32px] shadow-sm border border-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl">👩‍🌾</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">同步账户</p>
                    <p className="font-black text-slate-700 truncate text-sm">{user.email}</p>
                  </div>
                  <button onClick={handleLogout} className="bg-red-50 text-red-500 text-[10px] font-black px-3 py-2 rounded-xl">退出</button>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">最近同步日志</p>
                  <p className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-100">{syncLog}</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                   <button onClick={() => syncFromCloud(true)} className="w-full py-4 bg-amber-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-amber-100">
                     <i className="fa-solid fa-cloud-download"></i> 手动获取云端最新数据
                   </button>
                   <button onClick={forcePush} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black flex items-center justify-center gap-2 active:bg-slate-200">
                     <i className="fa-solid fa-cloud-upload"></i> 以当前手机为准覆盖云端
                   </button>
                </div>
                <p className="text-[9px] text-slate-300 text-center mt-4 font-bold uppercase leading-relaxed">提示：多台手机同步时，请在记录完后等待上方灯变绿，另一台手机进入设置点“手动获取”即可刷新。</p>
             </div>
             
             <div className="bg-white p-6 rounded-[32px] shadow-sm">
               <h3 className="font-black text-slate-800 text-xs mb-4 uppercase tracking-widest opacity-40">母鸡设置</h3>
               <div className="space-y-2">
                 {hens.map(h => (
                   <div key={h.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-white">
                     <div className="flex items-center gap-3">
                       <span className={`w-8 h-8 ${h.color} rounded-lg flex items-center justify-center text-lg`}>{h.avatar}</span>
                       <span className="font-bold text-slate-700 text-sm">{h.name}</span>
                     </div>
                     <button onClick={() => confirm('确定移除该母鸡吗？') && setHens(hens.filter(x => x.id !== h.id))} className="text-slate-200 hover:text-red-400 p-2"><i className="fa-solid fa-trash-alt text-xs"></i></button>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        )}

        {/* 统计和专家页面保持不变... */}
        {activeTab === Tab.STATS && (
           <div className="space-y-4 animate-in fade-in">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-white">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800">生产趋势</h3>
                <button onClick={() => setStatPeriod(statPeriod === StatPeriod.WEEK ? StatPeriod.MONTH : StatPeriod.WEEK)} className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl border border-amber-100">
                  {statPeriod === StatPeriod.WEEK ? '按周' : '按月'}
                </button>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer>
                  <BarChart data={statsData}>
                    <Tooltip cursor={{fill: '#f8fafc', radius: 8}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                    {hens.map((h, i) => <Bar key={h.id} dataKey={h.name} stackId="a" fill={i === 0 ? '#f59e0b' : '#94a3b8'} radius={[4, 4, 0, 0]} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-[32px] shadow-sm max-h-[300px] overflow-y-auto custom-scrollbar border border-white">
               <h3 className="font-black text-slate-800 text-sm mb-4">产蛋流水线</h3>
               {records.length === 0 ? <p className="text-center text-slate-300 py-10 font-bold text-xs">暂无流水记录</p> : 
                 [...records].reverse().slice(0, 30).map(r => {
                   const h = hens.find(x => x.id === r.henId) || { name: '已移出', avatar: '🥚' };
                   return (
                     <div key={r.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                       <div className="flex items-center gap-3">
                         <span className="text-xl">{h.avatar}</span>
                         <div><p className="font-bold text-slate-700 text-xs">{h.name}</p><p className="text-[9px] text-slate-400 font-bold tracking-wider">{r.date}</p></div>
                       </div>
                       <div className="flex items-center gap-4">
                         <span className="text-amber-600 font-black text-xs">{r.weight ? `${r.weight}g` : '-'}</span>
                         <button onClick={() => confirm('删除记录？') && setRecords(records.filter(x => x.id !== r.id))} className="text-slate-200 hover:text-red-300 p-1"><i className="fa-solid fa-times-circle text-xs"></i></button>
                       </div>
                     </div>
                   );
                 })
               }
            </div>
          </div>
        )}

        {activeTab === Tab.TIPS && (
          <div className="space-y-4 animate-in fade-in">
             <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-[40px] text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xl font-black mb-1">AI 养鸡专家</h2>
                  <p className="text-amber-100 text-[10px] mb-6 font-bold uppercase tracking-widest opacity-80">分析您的产蛋数据</p>
                  <button onClick={async () => { setIsLoadingAdvice(true); setAiAdvice(await getHenAdvice(records, hens) || ''); setIsLoadingAdvice(false); }} disabled={isLoadingAdvice} className="w-full bg-white text-orange-600 font-black py-4 rounded-2xl active:scale-95 transition-all shadow-xl">
                    {isLoadingAdvice ? '正在生成报告...' : '生成本周诊断'}
                  </button>
                </div>
                <i className="fa-solid fa-robot absolute -bottom-4 -right-4 text-white/10 text-9xl"></i>
             </div>
             <div className="bg-white p-7 rounded-[32px] min-h-[250px] border border-slate-100 shadow-sm">
               {aiAdvice ? <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">{aiAdvice}</div> : <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50"><i className="fa-solid fa-comment-dots text-3xl mb-4"></i><p className="text-[10px] font-black uppercase">点击上方按钮获取建议</p></div>}
             </div>
          </div>
        )}
      </main>

      {/* 底部导航 */}
      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(448px-3rem)] mx-auto bg-slate-900/95 backdrop-blur-md rounded-[28px] px-6 py-4 flex justify-between items-center shadow-2xl z-50">
        {[
          { tab: Tab.TRACK, icon: 'fa-egg', label: '蛋仓' },
          { tab: Tab.STATS, icon: 'fa-chart-pie', label: '统计' },
          { tab: Tab.MANAGE, icon: 'fa-sliders', label: '设置' },
          { tab: Tab.TIPS, icon: 'fa-magic-wand-sparkles', label: '专家' }
        ].map(item => (
          <button key={item.tab} onClick={() => setActiveTab(item.tab)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.tab ? 'text-amber-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <i className={`fa-solid ${item.icon} text-lg`}></i><span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 称重弹窗 */}
      {recordingForHen && (
        <WeightModal 
          henName={recordingForHen.name} 
          onSave={(d, w) => {
            const newRecords = [...records, { id: Math.random().toString(36).substr(2, 9), henId: recordingForHen.id, date: d, timestamp: Date.now(), weight: w }];
            setRecords(newRecords);
            setRecordingForHen(null);
            addLog('本地已记蛋，准备同步...');
          }} 
          onCancel={() => setRecordingForHen(null)} 
        />
      )}
      
      {/* 编辑母鸡弹窗 */}
      {editingHen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl">
            <h3 className="text-center font-black text-slate-800 mb-6">修改母鸡信息</h3>
            <div className="space-y-4">
              <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-center font-bold outline-none border-2 border-transparent focus:border-amber-400" placeholder="名字" />
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_AVATARS.slice(0, 10).map(a => <button key={a} onClick={() => setEditAvatar(a)} className={`h-10 rounded-xl flex items-center justify-center text-xl transition-all ${editAvatar === a ? 'bg-amber-100 scale-110 shadow-sm' : 'bg-slate-50'}`}>{a}</button>)}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => { setHens(hens.map(h => h.id === editingHen.id ? { ...h, name: editName, avatar: editAvatar } : h)); setEditingHen(null); addLog('母鸡信息已更新'); }} className="flex-1 bg-amber-500 text-white font-black py-4 rounded-2xl shadow-lg">保存</button>
                <button onClick={() => setEditingHen(null)} className="flex-1 bg-slate-100 text-slate-400 font-bold py-4 rounded-2xl">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
