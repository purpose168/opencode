import { $ } from "bun"
import path from "path"

export namespace Archive {
  export async function extractZip(zipPath: string, destDir: string) {
    if (process.platform === "win32") {
      const winZipPath = path.resolve(zipPath)
      const winDestDir = path.resolve(destDir)
      // $global:ProgressPreference抑制PowerShell的蓝色进度条弹出窗口
      const cmd = `$global:ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path '${winZipPath}' -DestinationPath '${winDestDir}' -Force`
      await $`powershell -NoProfile -NonInteractive -Command ${cmd}`.quiet()
    } else {
      await $`unzip -o -q ${zipPath} -d ${destDir}`.quiet()
    }
  }
}

// Archive命名空间提供压缩文件解压功能
// extractZip函数：解压ZIP文件到指定目录
// 参数：
//   zipPath: ZIP文件路径
//   destDir: 解压目标目录
// 功能：
//   - 在Windows平台使用PowerShell的Expand-Archive命令解压
//   - 在其他平台使用unzip命令解压
//   - -o参数：覆盖已存在的文件
//   - -q参数：静默模式，不显示输出
//   - .quiet()：抑制命令输出
