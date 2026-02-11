#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import os from "os"
import { ZenData } from "../src/model"

// 计算项目根目录路径
const root = path.resolve(process.cwd(), "..", "..", "..")
// 读取所有密钥信息
const models = await $`bun sst secret list`.cwd(root).text()

// 读取以 "ZEN_MODELS" 开头的行
const lines = models.split("\n")
const oldValue1 = lines.find((line) => line.startsWith("ZEN_MODELS1"))?.split("=")[1]
const oldValue2 = lines.find((line) => line.startsWith("ZEN_MODELS2"))?.split("=")[1]
const oldValue3 = lines.find((line) => line.startsWith("ZEN_MODELS3"))?.split("=")[1]
const oldValue4 = lines.find((line) => line.startsWith("ZEN_MODELS4"))?.split("=")[1]
const oldValue5 = lines.find((line) => line.startsWith("ZEN_MODELS5"))?.split("=")[1]
const oldValue6 = lines.find((line) => line.startsWith("ZEN_MODELS6"))?.split("=")[1]

// 检查密钥是否存在
if (!oldValue1) throw new Error("未找到 ZEN_MODELS1")
if (!oldValue2) throw new Error("未找到 ZEN_MODELS2")
if (!oldValue3) throw new Error("未找到 ZEN_MODELS3")
if (!oldValue4) throw new Error("未找到 ZEN_MODELS4")
if (!oldValue5) throw new Error("未找到 ZEN_MODELS5")
if (!oldValue6) throw new Error("未找到 ZEN_MODELS6")

// 将美化后的 JSON 存储到临时文件
const filename = `models-${Date.now()}.json`
const tempFile = Bun.file(path.join(os.tmpdir(), filename))
await tempFile.write(
  JSON.stringify(JSON.parse(oldValue1 + oldValue2 + oldValue3 + oldValue4 + oldValue5 + oldValue6), null, 2),
)
console.log("临时文件路径", tempFile.name)

// 在 vim 中打开临时文件，关闭后读取文件内容
await $`vim ${tempFile.name}`
const newValue = JSON.stringify(JSON.parse(await tempFile.text()))
// 验证新值的有效性
ZenData.validate(JSON.parse(newValue))

// 更新密钥
const chunk = Math.ceil(newValue.length / 6)
const newValue1 = newValue.slice(0, chunk)
const newValue2 = newValue.slice(chunk, chunk * 2)
const newValue3 = newValue.slice(chunk * 2, chunk * 3)
const newValue4 = newValue.slice(chunk * 3, chunk * 4)
const newValue5 = newValue.slice(chunk * 4, chunk * 5)
const newValue6 = newValue.slice(chunk * 5)

// 依次更新各个密钥片段
await $`bun sst secret set ZEN_MODELS1 ${newValue1}`
await $`bun sst secret set ZEN_MODELS2 ${newValue2}`
await $`bun sst secret set ZEN_MODELS3 ${newValue3}`
await $`bun sst secret set ZEN_MODELS4 ${newValue4}`
await $`bun sst secret set ZEN_MODELS5 ${newValue5}`
await $`bun sst secret set ZEN_MODELS6 ${newValue6}`

console.log("模型配置更新完成！")
