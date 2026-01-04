
/**
 * 自动同步服务 - 增强版
 * 解决了缓存导致的数据滞后问题
 */

// 更换一个全新的 Bucket ID 确保环境纯净
const BUCKET_ID = 'happy_hens_v3_final_sync'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  try {
    const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error('[Sync] Upload Error:', error);
    return false;
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    // 使用 no-cache 策略和随机数双重保险
    const response = await fetch(`${API_BASE}/${cloudId}?nocache=${Math.random()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    
    if (response.status === 404) return { isNewUser: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('[Sync] Download Error:', error);
    return null;
  }
};
