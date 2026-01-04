
/**
 * 自动同步服务 - 极简稳定版
 */

// 严格 20 位 Bucket ID
const BUCKET_ID = 'hens_sync_stable_v1'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
  
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      // 不添加任何自定义 Header，使用最基础的配置以通过所有移动端防火墙
      body: payload,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (err) {
    console.error("Upload Error:", err);
    throw err;
  }
};

export const pullFromCloud = async (cloudId: string) => {
  const url = `${API_BASE}/${cloudId}?nocache=${Date.now()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });
    
    if (response.status === 404) return { isNewUser: true };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    return await response.json();
  } catch (err) {
    console.error("Download Error:", err);
    throw err;
  }
};
