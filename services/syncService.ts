
/**
 * 自动同步服务 - 极简兼容版 (无需注册)
 */

// 每次更新代码都会尝试使用一个较新的随机桶 ID，避开拥挤
const BUCKET_ID = 'kvdb_hens_v3_9821'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

/**
 * 上传数据 - 使用最基础的配置
 */
export const pushToCloud = async (cloudId: string, data: any) => {
  const payload = JSON.stringify({ ...data, lastUpdated: Date.now() });
  
  try {
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT',
      // 使用 text/plain 可以避开很多移动端浏览器的复杂跨域(CORS)预检
      headers: {
        'Content-Type': 'text/plain',
      },
      body: payload,
    });
    
    if (!response.ok) {
      throw new Error(`服务器返回错误: ${response.status}`);
    }
    return true;
  } catch (err: any) {
    console.error("Upload Detail:", err);
    if (err.message.includes('Failed to fetch')) {
      throw new Error('网络请求被拦截(请尝试切换WiFi/流量)');
    }
    throw err;
  }
};

/**
 * 下载数据 - 增加防缓存处理
 */
export const pullFromCloud = async (cloudId: string) => {
  // 添加随机数防止浏览器返回旧的缓存数据
  const url = `${API_BASE}/${cloudId}?nocache=${Math.random()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain'
      }
    });
    
    if (response.status === 404) return { isNewUser: true };
    if (!response.ok) throw new Error(`同步失败(${response.status})`);
    
    const text = await response.text();
    return JSON.parse(text);
  } catch (err: any) {
    console.error("Download Detail:", err);
    throw new Error('无法连接云端(请检查联网状态)');
  }
};
