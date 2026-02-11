#!/usr/bin/env bun
/**
 * opencode 发布脚本
 * 用于更新不同包管理器仓库的配置文件
 */

import { $ } from "bun"
import { Script } from "@opencode-ai/script"

// 仅在非预览版本时执行发布操作
if (!Script.preview) {
  // 计算不同平台二进制文件的 SHA256 哈希值
  const arm64Sha = await $`sha256sum ./dist/opencode-linux-arm64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const x64Sha = await $`sha256sum ./dist/opencode-linux-x64.tar.gz | cut -d' ' -f1`.text().then((x) => x.trim())
  const macX64Sha = await $`sha256sum ./dist/opencode-darwin-x64.zip | cut -d' ' -f1`.text().then((x) => x.trim())
  const macArm64Sha = await $`sha256sum ./dist/opencode-darwin-arm64.zip | cut -d' ' -f1`.text().then((x) => x.trim())

  // 解析版本号，分离主版本号和子版本号（如 -alpha、-beta 等）
  const [pkgver, _subver = ""] = Script.version.split(/(-.*)/, 2)

  // 生成 Arch Linux 的二进制版本 PKGBUILD 文件
  const binaryPkgbuild = [
    "# Maintainer: dax",
    "# Maintainer: adam",
    "",
    "pkgname='opencode-bin'",
    `pkgver=${pkgver}`,
    `_subver=${_subver}`,
    "options=('!debug' '!strip')",
    "pkgrel=1",
    "pkgdesc='专为终端打造的 AI 编码助手。'",
    "url='https://github.com/sst/opencode'",
    "arch=('aarch64' 'x86_64')",
    "license=('MIT')",
    "provides=('opencode')",
    "conflicts=('opencode')",
    "depends=('ripgrep')",
    "",
    `source_aarch64=("\${pkgname}_\${pkgver}_aarch64.tar.gz::https://github.com/sst/opencode/releases/download/v\${pkgver}\${_subver}/opencode-linux-arm64.tar.gz")`,
    `sha256sums_aarch64=('${arm64Sha}')`,

    `source_x86_64=("\${pkgname}_\${pkgver}_x86_64.tar.gz::https://github.com/sst/opencode/releases/download/v\${pkgver}\${_subver}/opencode-linux-x64.tar.gz")`,
    `sha256sums_x86_64=('${x64Sha}')`,
    "",
    "package() {",
    '  install -Dm755 ./opencode "${pkgdir}/usr/bin/opencode"',
    "}",
    "",
  ].join("\n")

  // 生成 Arch Linux 的源码版本 PKGBUILD 文件
  const sourcePkgbuild = [
    "# Maintainer: dax",
    "# Maintainer: adam",
    "",
    "pkgname='opencode'",
    `pkgver=${pkgver}`,
    `_subver=${_subver}`,
    "options=('!debug' '!strip')",
    "pkgrel=1",
    "pkgdesc='专为终端打造的 AI 编码助手。'",
    "url='https://github.com/sst/opencode'",
    "arch=('aarch64' 'x86_64')",
    "license=('MIT')",
    "provides=('opencode')",
    "conflicts=('opencode-bin')",
    "depends=('ripgrep')",
    "makedepends=('git' 'bun-bin' 'go')",
    "",
    `source=("opencode-\${pkgver}.tar.gz::https://github.com/sst/opencode/archive/v\${pkgver}\${_subver}.tar.gz")`,
    `sha256sums=('SKIP')`,
    "",
    "build() {",
    `  cd "opencode-\${pkgver}"`,
    `  bun install`,
    "  cd ./packages/opencode",
    `  OPENCODE_CHANNEL=latest OPENCODE_VERSION=${pkgver} bun run ./script/build.ts --single`,
    "}",
    "",
    "package() {",
    `  cd "opencode-\${pkgver}/packages/opencode"`,
    '  mkdir -p "${pkgdir}/usr/bin"',
    '  target_arch="x64"',
    '  case "$CARCH" in',
    '    x86_64) target_arch="x64" ;;',
    '    aarch64) target_arch="arm64" ;;',
    '    *) printf "不支持的架构: %s\\n" "$CARCH" >&2 ; return 1 ;;',
    "  esac",
    '  libc=""',
    "  if command -v ldd >/dev/null 2>&1; then",
    "    if ldd --version 2>&1 | grep -qi musl; then",
    '      libc="-musl"',
    "    fi",
    "  fi",
    '  if [ -z "$libc" ] && ls /lib/ld-musl-* >/dev/null 2>&1; then',
    '    libc="-musl"',
    "  fi",
    '  base=""',
    '  if [ "$target_arch" = "x64" ]; then',
    "    if ! grep -qi avx2 /proc/cpuinfo 2>/dev/null; then",
    '      base="-baseline"',
    "    fi",
    "  fi",
    '  bin="dist/opencode-linux-${target_arch}${base}${libc}/bin/opencode"',
    '  if [ ! -f "$bin" ]; then',
    '    printf "找不到 %s%s%s 的二进制文件\\n" "$target_arch" "$base" "$libc" >&2',
    "    return 1",
    "  fi",
    '  install -Dm755 "$bin" "${pkgdir}/usr/bin/opencode"',
    "}",
    "",
  ].join("\n")

  // 更新 Arch Linux AUR 仓库
  for (const [pkg, pkgbuild] of [
    ["opencode-bin", binaryPkgbuild], // 二进制版本
    ["opencode", sourcePkgbuild], // 源码版本
  ]) {
    // 尝试最多 30 次，防止网络或权限问题导致失败
    for (let i = 0; i < 30; i++) {
      try {
        // 清理旧目录
        await $`rm -rf ./dist/aur-${pkg}`
        // 克隆 AUR 仓库
        await $`git clone ssh://aur@aur.archlinux.org/${pkg}.git ./dist/aur-${pkg}`
        // 切换到 master 分支
        await $`cd ./dist/aur-${pkg} && git checkout master`
        // 写入新的 PKGBUILD 文件
        await Bun.file(`./dist/aur-${pkg}/PKGBUILD`).write(pkgbuild)
        // 生成 .SRCINFO 文件
        await $`cd ./dist/aur-${pkg} && makepkg --printsrcinfo > .SRCINFO`
        // 添加文件到暂存区
        await $`cd ./dist/aur-${pkg} && git add PKGBUILD .SRCINFO`
        // 提交更改
        await $`cd ./dist/aur-${pkg} && git commit -m "更新到 v${Script.version}"`
        // 推送更改
        await $`cd ./dist/aur-${pkg} && git push`
        // 成功后跳出循环
        break
      } catch (e) {
        // 失败后继续尝试
        continue
      }
    }
  }

  // 生成 Homebrew formula 文件
  const homebrewFormula = [
    "# typed: false",
    "# frozen_string_literal: true",
    "",
    "# 此文件由 GoReleaser 生成。请勿编辑。",
    "class Opencode < Formula",
    `  desc "专为终端打造的 AI 编码助手。"`,
    `  homepage "https://github.com/sst/opencode"`,
    `  version "${Script.version.split("-")[0]}"`,
    "",
    `  depends_on "ripgrep"`,
    "",
    "  on_macos do",
    "    if Hardware::CPU.intel?",
    `      url "https://github.com/sst/opencode/releases/download/v${Script.version}/opencode-darwin-x64.zip"`,
    `      sha256 "${macX64Sha}"`,
    "",
    "      def install",
    '        bin.install "opencode"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm?",
    `      url "https://github.com/sst/opencode/releases/download/v${Script.version}/opencode-darwin-arm64.zip"`,
    `      sha256 "${macArm64Sha}"`,
    "",
    "      def install",
    '        bin.install "opencode"',
    "      end",
    "    end",
    "  end",
    "",
    "  on_linux do",
    "    if Hardware::CPU.intel? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/sst/opencode/releases/download/v${Script.version}/opencode-linux-x64.tar.gz"`,
    `      sha256 "${x64Sha}"`,
    "      def install",
    '        bin.install "opencode"',
    "      end",
    "    end",
    "    if Hardware::CPU.arm? and Hardware::CPU.is_64_bit?",
    `      url "https://github.com/sst/opencode/releases/download/v${Script.version}/opencode-linux-arm64.tar.gz"`,
    `      sha256 "${arm64Sha}"`,
    "      def install",
    '        bin.install "opencode"',
    "      end",
    "    end",
    "  end",
    "end",
    "",
    "",
  ].join("\n")

  // 更新 Homebrew tap 仓库
  await $`rm -rf ./dist/homebrew-tap`
  // 克隆 homebrew-tap 仓库（使用 GitHub token 进行认证）
  await $`git clone https://${process.env["GITHUB_TOKEN"]}@github.com/sst/homebrew-tap.git ./dist/homebrew-tap`
  // 写入新的 formula 文件
  await Bun.file("./dist/homebrew-tap/opencode.rb").write(homebrewFormula)
  // 添加文件到暂存区
  await $`cd ./dist/homebrew-tap && git add opencode.rb`
  // 提交更改
  await $`cd ./dist/homebrew-tap && git commit -m "更新到 v${Script.version}"`
  // 推送更改
  await $`cd ./dist/homebrew-tap && git push`
}
