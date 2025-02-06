import {
  McpConfigData,
  McpRequestMessage,
  ServerConfig,
  ServerStatusResponse,
} from "./types";

// 获取客户端状态
export async function getClientsStatus(): Promise<
  Record<string, ServerStatusResponse>
> {
  return {};
}

// 获取客户端工具
export async function getClientTools(clientId: string) {
  return null;
}

// 获取可用客户端数量
export async function getAvailableClientsCount() {
  return 0;
}

// 获取所有客户端工具
export async function getAllTools() {
  return [];
}

// 初始化系统
export async function initializeMcpSystem() {
  throw new Error();
}

// 添加服务器
export async function addMcpServer(clientId: string, config: ServerConfig) {
  throw new Error();
}

// 暂停服务器
export async function pauseMcpServer(clientId: string) {
  throw new Error();
}

// 恢复服务器
export async function resumeMcpServer(clientId: string): Promise<void> {
  throw new Error();
}

// 移除服务器
export async function removeMcpServer(clientId: string) {
  throw new Error();
}

// 重启所有客户端
export async function restartAllClients() {
  throw new Error();
}

// 执行 MCP 请求
export async function executeMcpAction(
  clientId: string,
  request: McpRequestMessage,
) {
  throw new Error();
}

// 获取 MCP 配置文件
export async function getMcpConfigFromFile(): Promise<McpConfigData> {
  return { mcpServers: {} };
}

// 检查 MCP 是否启用
export async function isMcpEnabled() {
  return false;
}
