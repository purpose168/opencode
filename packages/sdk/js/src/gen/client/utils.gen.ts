// 本文件由 @hey-api/openapi-ts 自动生成

// 导入获取认证令牌函数
import { getAuthToken } from "../core/auth.gen.js"
// 导入查询序列化选项类型
import type { QuerySerializerOptions } from "../core/bodySerializer.gen.js"
// 导入请求体序列化器
import { jsonBodySerializer } from "../core/bodySerializer.gen.js"
// 导入路径参数序列化函数
import { serializeArrayParam, serializeObjectParam, serializePrimitiveParam } from "../core/pathSerializer.gen.js"
// 导入获取 URL 函数
import { getUrl } from "../core/utils.gen.js"
// 导入客户端相关类型
import type { Client, ClientOptions, Config, RequestOptions } from "./types.gen.js"

// 创建查询序列化器
export const createQuerySerializer = <T = unknown>({ allowReserved, array, object }: QuerySerializerOptions = {}) => {
  const querySerializer = (queryParams: T) => {
    const search: string[] = []
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name]

        if (value === undefined || value === null) {
          continue
        }

        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam({
            allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...array,
          })
          if (serializedArray) search.push(serializedArray)
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam({
            allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value: value as Record<string, unknown>,
            ...object,
          })
          if (serializedObject) search.push(serializedObject)
        } else {
          const serializedPrimitive = serializePrimitiveParam({
            allowReserved,
            name,
            value: value as string,
          })
          if (serializedPrimitive) search.push(serializedPrimitive)
        }
      }
    }
    return search.join("&")
  }
  return querySerializer
}

/**
 * 从提供的 Content-Type 头推断 parseAs 值。
 */
export const getParseAs = (contentType: string | null): Exclude<Config["parseAs"], "auto"> => {
  if (!contentType) {
    // 如果没有提供 Content-Type 头，我们最多能做的就是返回原始响应体，
    // 这实际上与 'stream' 选项相同。
    return "stream"
  }

  const cleanContent = contentType.split(";")[0]?.trim()

  if (!cleanContent) {
    return
  }

  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json"
  }

  if (cleanContent === "multipart/form-data") {
    return "formData"
  }

  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob"
  }

  if (cleanContent.startsWith("text/")) {
    return "text"
  }

  return
}

// 检查是否存在
const checkForExistence = (
  options: Pick<RequestOptions, "auth" | "query"> & {
    headers: Headers
  },
  name?: string,
): boolean => {
  if (!name) {
    return false
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true
  }
  return false
}

// 设置认证参数
export const setAuthParams = async ({
  security,
  ...options
}: Pick<Required<RequestOptions>, "security"> &
  Pick<RequestOptions, "auth" | "query"> & {
    headers: Headers
  }) => {
  for (const auth of security) {
    if (checkForExistence(options, auth.name)) {
      continue
    }

    const token = await getAuthToken(auth, options.auth)

    if (!token) {
      continue
    }

    const name = auth.name ?? "Authorization"

    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {}
        }
        options.query[name] = token
        break
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`)
        break
      case "header":
      default:
        options.headers.set(name, token)
        break
    }
  }
}

// 构建 URL
export const buildUrl: Client["buildUrl"] = (options) =>
  getUrl({
    baseUrl: options.baseUrl as string,
    path: options.path,
    query: options.query,
    querySerializer:
      typeof options.querySerializer === "function"
        ? options.querySerializer
        : createQuerySerializer(options.querySerializer),
    url: options.url,
  })

// 合并配置
export const mergeConfigs = (a: Config, b: Config): Config => {
  const config = { ...a, ...b }
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length -1)
  }
  config.headers = mergeHeaders(a.headers, b.headers)
  return config
}

// 合并请求头
export const mergeHeaders = (...headers: Array<Required<Config>["headers"] | undefined>): Headers => {
  const mergedHeaders = new Headers()
  for (const header of headers) {
    if (!header || typeof header !== "object") {
      continue
    }

    const iterator = header instanceof Headers ? header.entries() : Object.entries(header)

    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key)
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v as string)
        }
      } else if (value !== undefined) {
        // 假设对象头应该被 JSON 字符串化，即它们的
        // OpenAPI 规范中的内容值是 'application/json'
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : (value as string))
      }
    }
  }
  return mergedHeaders
}

// 定义错误拦截器类型
type ErrInterceptor<Err, Res, Req, Options> = (
  error: Err,
  response: Res,
  request: Req,
  options: Options,
) => Err | Promise<Err>

// 定义请求拦截器类型
type ReqInterceptor<Req, Options> = (request: Req, options: Options) => Req | Promise<Req>

// 定义响应拦截器类型
type ResInterceptor<Res, Req, Options> = (response: Res, request: Req, options: Options) => Res | Promise<Res>

// 拦截器类
class Interceptors<Interceptor> {
  _fns: (Interceptor | null)[]

  constructor() {
    this._fns = []
  }

  clear() {
    this._fns = []
  }

  getInterceptorIndex(id: number | Interceptor): number {
    if (typeof id === "number") {
      return this._fns[id] ? id : -1
    } else {
      return this._fns.indexOf(id)
    }
  }
  exists(id: number | Interceptor) {
    const index = this.getInterceptorIndex(id)
    return !!this._fns[index]
  }

  eject(id: number | Interceptor) {
    const index = this.getInterceptorIndex(id)
    if (this._fns[index]) {
      this._fns[index] = null
    }
  }

  update(id: number | Interceptor, fn: Interceptor) {
    const index = this.getInterceptorIndex(id)
    if (this._fns[index]) {
      this._fns[index] = fn
      return id
    } else {
      return false
    }
  }

  use(fn: Interceptor) {
    this._fns = [...this._fns, fn]
    return this._fns.length - 1
  }
}

// `createInterceptors()` 响应，用于外部使用，因为它不
// 暴露内部实现
export interface Middleware<Req, Res, Err, Options> {
  error: Pick<Interceptors<ErrInterceptor<Err, Res, Req, Options>>, "eject" | "use">
  request: Pick<Interceptors<ReqInterceptor<Req, Options>>, "eject" | "use">
  response: Pick<Interceptors<ResInterceptor<Res, Req, Options>>, "eject" | "use">
}

// 不要添加 `Middleware` 作为返回类型，以便我们在内部使用 _fns
export const createInterceptors = <Req, Res, Err, Options>() => ({
  error: new Interceptors<ErrInterceptor<Err, Res, Req, Options>>(),
  request: new Interceptors<ReqInterceptor<Req, Options>>(),
  response: new Interceptors<ResInterceptor<Res, Req, Options>>(),
})

// 默认查询序列化器
const defaultQuerySerializer = createQuerySerializer({
  allowReserved: false,
  array: {
    explode: true,
    style: "form",
  },
  object: {
    explode: true,
    style: "deepObject",
  },
})

// 默认请求头
const defaultHeaders = {
  "Content-Type": "application/json",
}

// 创建配置
export const createConfig = <T extends ClientOptions = ClientOptions>(
  override: Config<Omit<ClientOptions, keyof T> & T> = {},
): Config<Omit<ClientOptions, keyof T> & T> => ({
  ...jsonBodySerializer,
  headers: defaultHeaders,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer,
  ...override,
})
