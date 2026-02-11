// 本文件由 @hey-api/openapi-ts 自动生成

// 导入服务器发送事件客户端创建函数
import { createSseClient } from "../core/serverSentEvents.gen.js"
// 导入客户端相关类型定义
import type { Client, Config, RequestOptions, ResolvedRequestOptions } from "./types.gen.js"
// 导入工具函数
import {
  buildUrl,
  createConfig,
  createInterceptors,
  getParseAs,
  mergeConfigs,
  mergeHeaders,
  setAuthParams,
} from "./utils.gen.js"

// 定义请求初始化类型
type ReqInit = Omit<RequestInit, "body" | "headers"> & {
  body?: any
  headers: ReturnType<typeof mergeHeaders>
}

// 创建客户端函数
export const createClient = (config: Config = {}): Client => {
  // 合并配置
  let _config = mergeConfigs(createConfig(), config)

  // 获取当前配置
  const getConfig = (): Config => ({ ..._config })

  // 设置配置
  const setConfig = (config: Config): Config => {
    _config = mergeConfigs(_config, config)
    return getConfig()
  }

  // 创建拦截器
  const interceptors = createInterceptors<Request, Response, unknown, ResolvedRequestOptions>()

  // 请求前处理
  const beforeRequest = async (options: RequestOptions) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders(_config.headers, options.headers),
      serializedBody: undefined,
    }

    // 设置认证参数
    if (opts.security) {
      await setAuthParams({
        ...opts,
        security: opts.security,
      })
    }

    // 执行请求验证器
    if (opts.requestValidator) {
      await opts.requestValidator(opts)
    }

    // 序列化请求体
    if (opts.body && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body)
    }

    // 如果请求体为空，则移除 Content-Type 头以避免发送无效请求
    if (opts.serializedBody === undefined || opts.serializedBody === "") {
      opts.headers.delete("Content-Type")
    }

    // 构建请求 URL
    const url = buildUrl(opts)

    return { opts, url }
  }

  // 发送请求
  const request: Client["request"] = async (options) => {
    // @ts-expect-error
    const { opts, url } = await beforeRequest(options)
    const requestInit: ReqInit = {
      redirect: "follow",
      ...opts,
      body: opts.serializedBody,
    }

    let request = new Request(url, requestInit)

    // 执行请求拦截器
    for (const fn of interceptors.request._fns) {
      if (fn) {
        request = await fn(request, opts)
      }
    }

    // fetch 必须在这里赋值，否则会抛出错误：
    // TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
    const _fetch = opts.fetch!
    let response = await _fetch(request)

    // 执行响应拦截器
    for (const fn of interceptors.response._fns) {
      if (fn) {
        response = await fn(response, request, opts)
      }
    }

    const result = {
      request,
      response,
    }

    // 处理成功响应
    if (response.ok) {
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        return opts.responseStyle === "data"
          ? {}
          : {
              data: {},
              ...result,
            }
      }

      const parseAs =
        (opts.parseAs === "auto" ? getParseAs(response.headers.get("Content-Type")) : opts.parseAs) ?? "json"

      let data: any
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "json":
        case "text":
          data = await response[parseAs]()
          break
        case "stream":
          return opts.responseStyle === "data"
            ? response.body
            : {
                data: response.body,
                ...result,
              }
      }

      // 处理 JSON 响应
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data)
        }

        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data)
        }
      }

      return opts.responseStyle === "data"
        ? data
        : {
            data,
            ...result,
          }
    }

    // 处理错误响应
    const textError = await response.text()
    let jsonError: unknown

    try {
      jsonError = JSON.parse(textError)
    } catch {
      // 忽略解析错误
    }

    const error = jsonError ?? textError
    let finalError = error

    // 执行错误拦截器
    for (const fn of interceptors.error._fns) {
      if (fn) {
        finalError = (await fn(error, response, request, opts)) as string
      }
    }

    finalError = finalError || ({} as string)

    if (opts.throwOnError) {
      throw finalError
    }

    // TODO: 我们可能想要返回错误并改进类型
    return opts.responseStyle === "data"
      ? undefined
      : {
          error: finalError,
          ...result,
        }
  }

  // 创建 HTTP 方法
  const makeMethod = (method: Required<Config>["method"]) => {
    const fn = (options: RequestOptions) => request({ ...options, method })
    // 创建服务器发送事件方法
    fn.sse = async (options: RequestOptions) => {
      const { opts, url } = await beforeRequest(options)
      return createSseClient({
        ...opts,
        body: opts.body as BodyInit | null | undefined,
        headers: opts.headers as unknown as Record<string, string>,
        method,
        url,
      })
    }
    return fn
  }

  return {
    buildUrl,
    connect: makeMethod("CONNECT"),
    delete: makeMethod("DELETE"),
    get: makeMethod("GET"),
    getConfig,
    head: makeMethod("HEAD"),
    interceptors,
    options: makeMethod("OPTIONS"),
    patch: makeMethod("PATCH"),
    post: makeMethod("POST"),
    put: makeMethod("PUT"),
    request,
    setConfig,
    trace: makeMethod("TRACE"),
  } as Client
}
