
/**
 * 自动同步服务 - 稳定增强版
 * 修复了 Bucket ID 长度限制问题 (必须为 20 位)
 */

// 严格 20 位字母数字 ID
const BUCKET_ID = 'hens7f9e8a5c4b2d1f0e'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  try {
    const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: payload,
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server ${response.status}: ${errText}`);
    }
    return true;
  } catch (error) {
    console.error('[Sync] Upload Error:', error);
    throw error; // 抛出错误以便 UI 捕获具体信息
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    const response = await fetch(`${API_BASE}/${cloudId}?nocache=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.status === 404) return { isNewUser: true };
    if (!response.ok) throw new Error(`Server ${response.status}`);
    
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('[Sync] Download Error:', error);
    throw error;
  }
};
