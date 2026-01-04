
/**
 * 自动同步服务 - 稳定版 (基于标准化 Bucket)
 */

// 必须使用 20 位的 16 进制字符串作为 Bucket ID
const BUCKET_ID = '7f9e8a5c4b2d1f0e9c8b'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
  
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain', // 使用基础类型规避复杂的跨域检查
      },
      body: payload,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (err: any) {
    console.error("Upload failed:", err);
    throw new Error('云端写入失败，请检查联网');
  }
};

export const pullFromCloud = async (cloudId: string) => {
  const url = `${API_BASE}/${cloudId}?nocache=${Date.now()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
    });
    
    // 404 表示该同步码在云端还没有数据，属于正常现象（新用户）
    if (response.status === 404) {
      return { isNewUser: true };
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const text = await response.text();
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Download failed:", err);
    throw new Error('无法获取云端数据');
  }
};
