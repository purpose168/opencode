// 本文件由 @hey-api/openapi-ts 自动生成

// 导出认证相关类型
export type { Auth } from "../core/auth.gen.js"
// 导出查询序列化选项类型
export type { QuerySerializerOptions } from "../core/bodySerializer.gen.js"
// 导出请求体序列化器
export {
  formDataBodySerializer,
  jsonBodySerializer,
  urlSearchParamsBodySerializer,
} from "../core/bodySerializer.gen.js"
// 导出客户端参数构建函数
export { buildClientParams } from "../core/params.gen.js"
// 导出客户端创建函数
export { createClient } from "./client.gen.js"
// 导出客户端相关类型
export type {
  Client,
  ClientOptions,
  Config,
  CreateClientConfig,
  Options,
  OptionsLegacyParser,
  RequestOptions,
  RequestResult,
  ResolvedRequestOptions,
  ResponseStyle,
  TDataShape,
} from "./types.gen.js"
// 导出配置和头部合并函数
export { createConfig, mergeHeaders } from "./utils.gen.js"
