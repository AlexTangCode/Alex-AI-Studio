
/**
 * 自动同步服务
 * 使用 kvdb.io 提供基于自定义 Key 的持久化存储
 */

// 使用一个固定的公共 Bucket ID
const BUCKET_ID = 'happy_hens_v1_storage'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'POST', // kvdb.io 使用 POST 或 PUT 来更新内容
      body: JSON.stringify({ ...data, lastUpdated: Date.now() }),
    });
    return response.ok;
  } catch (error) {
    console.error('Push failed:', error);
    return false;
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`);
    if (!response.ok) {
      if (response.status === 404) return { isNewUser: true };
      throw new Error('Pull failed');
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { isNewUser: true };
    }
  } catch (error) {
    console.error('Pull failed:', error);
    return null;
  }
};
