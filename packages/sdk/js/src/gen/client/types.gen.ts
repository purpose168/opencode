// 本文件由 @hey-api/openapi-ts 自动生成

// 导入认证相关类型
import type { Auth } from "../core/auth.gen.js"
// 导入服务器发送事件相关类型
import type { ServerSentEventsOptions, ServerSentEventsResult } from "../core/serverSentEvents.gen.js"
// 导入核心客户端和配置类型
import type { Client as CoreClient, Config as CoreConfig } from "../core/types.gen.js"
// 导入中间件类型
import type { Middleware } from "./utils.gen.js"

// 定义响应样式类型
export type ResponseStyle = "data" | "fields"

// 定义配置接口
export interface Config<T extends ClientOptions = ClientOptions>
  extends Omit<RequestInit, "body" | "headers" | "method">,
    CoreConfig {
  /**
   * 此客户端发出的所有请求的基础 URL。
   */
  baseUrl?: T["baseUrl"]
  /**
   * Fetch API 实现。您可以使用此选项提供自定义
   * fetch 实例。
   *
   * @default globalThis.fetch
   */
  fetch?: (request: Request) => ReturnType<typeof fetch>
  /**
   * 请不要将 Fetch 客户端用于 Next.js 应用程序。`next`
   * 选项不会有任何效果。
   *
   * 请改用 {@link https://www.npmjs.com/package/@hey-api/client-next `@hey-api/client-next`}。
   */
  next?: never
  /**
   * 返回以指定格式解析的响应数据。默认情况下，`auto`
   * 将从 `Content-Type` 响应头推断适当的方法。
   * 您可以使用任何 {@link Body} 方法覆盖此行为。
   * 如果您根本不想解析响应数据，请选择 `stream`。
   *
   * @default 'auto'
   */
  parseAs?: "arrayBuffer" | "auto" | "blob" | "formData" | "json" | "stream" | "text"
  /**
   * 我们应该只返回数据还是返回多个字段（data、error、response 等）？
   *
   * @default 'fields'
   */
  responseStyle?: ResponseStyle
  /**
   * 抛出错误而不是在响应中返回它？
   *
   * @default false
   */
  throwOnError?: T["throwOnError"]
}

// 定义请求选项接口
export interface RequestOptions<
  TData = unknown,
  TResponseStyle extends ResponseStyle = "fields",
  ThrowOnError extends boolean = boolean,
  Url extends string = string,
> extends Config<{
      responseStyle: TResponseStyle
      throwOnError: ThrowOnError
    }>,
    Pick<
      ServerSentEventsOptions<TData>,
      "onSseError" | "onSseEvent" | "sseDefaultRetryDelay" | "sseMaxRetryAttempts" | "sseMaxRetryDelay"
    > {
  /**
   * 您想要添加到请求中的任何请求体。
   *
   * {@link https://developer.mozilla.org/docs/Web/API/fetch#body}
   */
  body?: unknown
  path?: Record<string, unknown>
  query?: Record<string, unknown>
  /**
   * 用于请求的安全机制。
   */
  security?: ReadonlyArray<Auth>
  url: Url
}

// 定义已解析的请求选项接口
export interface ResolvedRequestOptions<
  TResponseStyle extends ResponseStyle = "fields",
  ThrowOnError extends boolean = boolean,
  Url extends string = string,
> extends RequestOptions<unknown, TResponseStyle, ThrowOnError, Url> {
  serializedBody?: string
}

// 定义请求结果类型
export type RequestResult<
  TData = unknown,
  TError = unknown,
  ThrowOnError extends boolean = boolean,
  TResponseStyle extends ResponseStyle = "fields",
> = ThrowOnError extends true
  ? Promise<
      TResponseStyle extends "data"
        ? TData extends Record<string, unknown>
          ? TData[keyof TData]
          : TData
        : {
            data: TData extends Record<string, unknown> ? TData[keyof TData] : TData
            request: Request
            response: Response
          }
    >
  : Promise<
      TResponseStyle extends "data"
        ? (TData extends Record<string, unknown> ? TData[keyof TData] : TData) | undefined
        : (
            | {
                data: TData extends Record<string, unknown> ? TData[keyof TData] : TData
                error: undefined
              }
            | {
                data: undefined
                error: TError extends Record<string, unknown> ? TError[keyof TError] : TError
              }
          ) & {
            request: Request
            response: Response
          }
    >

// 定义客户端选项接口
export interface ClientOptions {
  baseUrl?: string
  responseStyle?: ResponseStyle
  throwOnError?: boolean
}

// 定义方法函数基础类型
type MethodFnBase = <
  TData = unknown,
  TError = unknown,
  ThrowOnError extends boolean = false,
  TResponseStyle extends ResponseStyle = "fields",
>(
  options: Omit<RequestOptions<TData, TResponseStyle, ThrowOnError>, "method">,
) => RequestResult<TData, TError, ThrowOnError, TResponseStyle>

// 定义服务器发送事件方法函数类型
type MethodFnServerSentEvents = <
  TData = unknown,
  TError = unknown,
  ThrowOnError extends boolean = false,
  TResponseStyle extends ResponseStyle = "fields",
>(
  options: Omit<RequestOptions<TData, TResponseStyle, ThrowOnError>, "method">,
) => Promise<ServerSentEventsResult<TData, TError>>

// 定义方法函数类型
type MethodFn = MethodFnBase & {
  sse: MethodFnServerSentEvents
}

// 定义请求函数类型
type RequestFn = <
  TData = unknown,
  TError = unknown,
  ThrowOnError extends boolean = false,
  TResponseStyle extends ResponseStyle = "fields",
>(
  options: Omit<RequestOptions<TData, TResponseStyle, ThrowOnError>, "method"> &
    Pick<Required<RequestOptions<TData, TResponseStyle, ThrowOnError>>, "method">,
) => RequestResult<TData, TError, ThrowOnError, TResponseStyle>

// 定义构建 URL 函数类型
type BuildUrlFn = <
  TData extends {
    body?: unknown
    path?: Record<string, unknown>
    query?: Record<string, unknown>
    url: string
  },
>(
  options: Pick<TData, "url"> & Options<TData>,
) => string

// 定义客户端类型
export type Client = CoreClient<RequestFn, Config, MethodFn, BuildUrlFn> & {
  interceptors: Middleware<Request, Response, unknown, ResolvedRequestOptions>
}

/**
 * `createClientConfig()` 函数将在客户端初始化时调用，
 * 返回的对象将成为客户端的初始配置。
 *
 * 您可能想要以这种方式初始化客户端，而不是调用
 * `setConfig()`。例如，如果您使用 Next.js，
 * 这很有用，可以确保您的客户端始终具有正确的值。
 */
export type CreateClientConfig<T extends ClientOptions = ClientOptions> = (
  override?: Config<ClientOptions & T>,
) => Config<Required<ClientOptions> & T>

// 定义数据形状接口
export interface TDataShape {
  body?: unknown
  headers?: unknown
  path?: unknown
  query?: unknown
  url: string
}

// 定义省略键类型
type OmitKeys<T, K> = Pick<T, Exclude<keyof T, K>>

// 定义选项类型
export type Options<
  TData extends TDataShape = TDataShape,
  ThrowOnError extends boolean = boolean,
  TResponse = unknown,
  TResponseStyle extends ResponseStyle = "fields",
> = OmitKeys<RequestOptions<TResponse, TResponseStyle, ThrowOnError>, "body" | "path" | "query" | "url"> &
  Omit<TData, "url">

// 定义旧版解析器选项类型
export type OptionsLegacyParser<
  TData = unknown,
  ThrowOnError extends boolean = boolean,
  TResponseStyle extends ResponseStyle = "fields",
> = TData extends { body?: any }
  ? TData extends { headers?: any }
    ? OmitKeys<RequestOptions<unknown, TResponseStyle, ThrowOnError>, "body" | "headers" | "url"> & TData
    : OmitKeys<RequestOptions<unknown, TResponseStyle, ThrowOnError>, "body" | "url"> &
        TData &
        Pick<RequestOptions<unknown, TResponseStyle, ThrowOnError>, "headers">
  : TData extends { headers?: any }
    ? OmitKeys<RequestOptions<unknown, TResponseStyle, ThrowOnError>, "headers" | "url"> &
        TData &
        Pick<RequestOptions<unknown, TResponseStyle, ThrowOnError>, "body">
    : OmitKeys<RequestOptions<unknown, TResponseStyle, ThrowOnError>, "url"> & TData
