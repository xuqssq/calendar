import { SocksProxyAgent } from 'socks-proxy-agent';
import { fetch as undiciFetch } from 'undici';

// SOCKS5 代理配置
// 格式: socks5h://username:password@host:port
// 可通过环境变量 SOCKS_PROXY_URL 配置，设为空字符串禁用代理
const DEFAULT_PROXY_URL = 'socks5h://if:xuqssq@127.0.0.1:6666';

/**
 * 获取代理 URL
 * @returns {string|null} 代理 URL，如果禁用则返回 null
 */
export const getProxyUrl = () => {
  const proxyUrl = process.env.SOCKS_PROXY_URL ?? DEFAULT_PROXY_URL;
  return proxyUrl || null;
};

/**
 * 创建 SOCKS 代理 Agent (用于 https 模块)
 * @param {string} [proxyUrl] 可选的代理 URL，默认使用配置的代理
 * @returns {SocksProxyAgent|null} 代理 Agent，如果禁用代理则返回 null
 */
export const createSocksAgent = (proxyUrl = getProxyUrl()) => {
  if (!proxyUrl) return null;
  return new SocksProxyAgent(proxyUrl);
};

/**
 * 支持代理的 fetch 函数
 * @param {string} url 请求 URL
 * @param {object} [options] fetch 选项
 * @param {string} [options.proxyUrl] 可选的代理 URL
 * @returns {Promise<Response>} fetch 响应
 */
export const proxyFetch = async (url, options = {}) => {
  const { proxyUrl = getProxyUrl(), ...fetchOptions } = options;

  if (proxyUrl) {
    const agent = new SocksProxyAgent(proxyUrl);
    return undiciFetch(url, {
      ...fetchOptions,
      dispatcher: agent,
    });
  }

  return undiciFetch(url, fetchOptions);
};
