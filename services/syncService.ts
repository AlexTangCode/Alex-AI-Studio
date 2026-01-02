
/**
 * 自动同步服务
 * 负责与云端 Bin 进行交互
 */

const API_BASE = 'https://api.npoint.io/bins';

export const pushToCloud = async (cloudId: string, data: any) => {
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    return await response.json();
  } catch (error) {
    console.error('Pull failed:', error);
    return null;
  }
};
