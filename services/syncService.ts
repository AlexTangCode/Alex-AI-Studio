
/**
 * 自动同步服务
 * 修复版：使用 PUT 方法确保覆盖更新，并指定 Content-Type
 */

// 使用一个更长且唯一的随机 Bucket ID，减少冲突概率
const BUCKET_ID = 'p_happy_hens_v2_prod_2024'; 
const API_BASE = `https://kvdb.io/${BUCKET_ID}`;

export const pushToCloud = async (cloudId: string, data: any) => {
  try {
    console.log('[Sync] 正在尝试上传数据到云端...', cloudId);
    const response = await fetch(`${API_BASE}/${cloudId}`, {
      method: 'PUT', // 必须使用 PUT 来覆盖更新单值
      headers: {
        'Content-Type': 'text/plain', // kvdb 存储纯文本/JSON 字符串
      },
      body: JSON.stringify({ ...data, lastUpdated: Date.now() }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Sync] 上传失败，服务器返回:', response.status, errorText);
      return false;
    }
    
    console.log('[Sync] 云端上传成功！');
    return true;
  } catch (error) {
    console.error('[Sync] 上传请求发生异常:', error);
    return false;
  }
};

export const pullFromCloud = async (cloudId: string) => {
  try {
    console.log('[Sync] 正在尝试从云端拉取数据...', cloudId);
    // 增加时间戳防止浏览器缓存
    const response = await fetch(`${API_BASE}/${cloudId}?t=${Date.now()}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('[Sync] 云端无此账户记录，将被视为新用户');
        return { isNewUser: true };
      }
      throw new Error(`Pull failed with status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('[Sync] 云端拉取原始数据成功');
    
    try {
      const data = JSON.parse(text);
      return data;
    } catch (e) {
      console.error('[Sync] 解析云端 JSON 失败:', e);
      return { isNewUser: true }; // 如果数据损坏，重置为新用户
    }
  } catch (error) {
    console.error('[Sync] 拉取请求发生异常:', error);
    return null;
  }
};
