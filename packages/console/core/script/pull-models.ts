#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { ZenData } from "../src/model"

// 获取源阶段参数
const stage = process.argv[2]
if (!stage) throw new Error("需要指定阶段")

// 计算项目根目录路径
const root = path.resolve(process.cwd(), "..", "..", "..")

// 从指定阶段读取密钥信息
const ret = await $`bun sst secret list --stage ${stage}`.cwd(root).text()
const lines = ret.split("\n")
const value1 = lines.find((line) => line.startsWith("ZEN_MODELS1"))?.split("=")[1]
const value2 = lines.find((line) => line.startsWith("ZEN_MODELS2"))?.split("=")[1]
const value3 = lines.find((line) => line.startsWith("ZEN_MODELS3"))?.split("=")[1]
const value4 = lines.find((line) => line.startsWith("ZEN_MODELS4"))?.split("=")[1]
const value5 = lines.find((line) => line.startsWith("ZEN_MODELS5"))?.split("=")[1]
const value6 = lines.find((line) => line.startsWith("ZEN_MODELS6"))?.split("=")[1]

// 检查密钥是否存在
if (!value1) throw new Error("未找到 ZEN_MODELS1")
if (!value2) throw new Error("未找到 ZEN_MODELS2")
if (!value3) throw new Error("未找到 ZEN_MODELS3")
if (!value4) throw new Error("未找到 ZEN_MODELS4")
if (!value5) throw new Error("未找到 ZEN_MODELS5")
if (!value6) throw new Error("未找到 ZEN_MODELS6")

// 验证密钥值的有效性
ZenData.validate(JSON.parse(value1 + value2 + value3 + value4 + value5 + value6))

// 更新当前环境的密钥
await $`bun sst secret set ZEN_MODELS1 ${value1}`
await $`bun sst secret set ZEN_MODELS2 ${value2}`
await $`bun sst secret set ZEN_MODELS3 ${value3}`
await $`bun sst secret set ZEN_MODELS4 ${value4}`
await $`bun sst secret set ZEN_MODELS5 ${value5}`
await $`bun sst secret set ZEN_MODELS6 ${value6}`
