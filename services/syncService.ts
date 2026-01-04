
/**
 * 自动同步服务 - 终极稳定版
 */

// 使用标准的 20 位字符 ID，确保服务商节点分发最优
const BUCKET_ID = 'hens7f9e8a5c4b2d1f0e'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
  
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      mode: 'cors', // 显式声明 CORS
      headers: {
        'Accept': 'application/json',
        // 移除 Content-Type 以减少某些手机环境下的 Preflight 拦截
      },
      body: payload,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (err: any) {
    console.error("Upload Error:", err);
    throw new Error(err.message || '网络异常');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  const url = `${API_BASE}/${cloudId}?t=${Date.now()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 404) return { isNewUser: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    return await response.json();
  } catch (err: any) {
    console.error("Download Error:", err);
    throw new Error(err.message || '连接超时');
  }
};
