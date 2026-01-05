
import { User } from '../types';

/**
 * 简化云端 ID 生成逻辑，确保在所有手机浏览器中完全一致
 */
export const authenticate = async (code: string): Promise<User> => {
  const sanitizedCode = code.trim().toLowerCase();
  
  // 不再使用复杂的哈希，直接基于同步码生成可预测的 ID
  // 这确保了不同设备只要输入相同，生成的 ID 绝对一致
  const safeId = sanitizedCode.replace(/[^a-z0-9]/g, '') || 'default';
  const cloudId = `hen_sync_v4_${safeId}`;
  
  return {
    email: sanitizedCode,
    cloudId
  };
};
