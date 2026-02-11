import { Style, Link } from "@solidjs/meta"
import inter from "../assets/fonts/inter.woff2"
import ibmPlexMonoRegular from "../assets/fonts/ibm-plex-mono.woff2"
import ibmPlexMonoMedium from "../assets/fonts/ibm-plex-mono-medium.woff2"
import ibmPlexMonoBold from "../assets/fonts/ibm-plex-mono-bold.woff2"

import cascadiaCode from "../assets/fonts/cascadia-code-nerd-font.woff2"
import cascadiaCodeBold from "../assets/fonts/cascadia-code-nerd-font-bold.woff2"
import firaCode from "../assets/fonts/fira-code-nerd-font.woff2"
import firaCodeBold from "../assets/fonts/fira-code-nerd-font-bold.woff2"
import hack from "../assets/fonts/hack-nerd-font.woff2"
import hackBold from "../assets/fonts/hack-nerd-font-bold.woff2"
import inconsolata from "../assets/fonts/inconsolata-nerd-font.woff2"
import inconsolataBold from "../assets/fonts/inconsolata-nerd-font-bold.woff2"
import intelOneMono from "../assets/fonts/intel-one-mono-nerd-font.woff2"
import intelOneMonoBold from "../assets/fonts/intel-one-mono-nerd-font-bold.woff2"
import jetbrainsMono from "../assets/fonts/jetbrains-mono-nerd-font.woff2"
import jetbrainsMonoBold from "../assets/fonts/jetbrains-mono-nerd-font-bold.woff2"
import mesloLgs from "../assets/fonts/meslo-lgs-nerd-font.woff2"
import mesloLgsBold from "../assets/fonts/meslo-lgs-nerd-font-bold.woff2"
import robotoMono from "../assets/fonts/roboto-mono-nerd-font.woff2"
import robotoMonoBold from "../assets/fonts/roboto-mono-nerd-font-bold.woff2"
import sourceCodePro from "../assets/fonts/source-code-pro-nerd-font.woff2"
import sourceCodeProBold from "../assets/fonts/source-code-pro-nerd-font-bold.woff2"
import ubuntuMono from "../assets/fonts/ubuntu-mono-nerd-font.woff2"
import ubuntuMonoBold from "../assets/fonts/ubuntu-mono-nerd-font-bold.woff2"

/**
 * 等宽字体类型定义
 * @property family 字体家族名称
 * @property regular 常规字重字体路径
 * @property bold 粗体字重字体路径
 */
type MonoFont = {
  family: string
  regular: string
  bold: string
}

/**
 * Nerd Font 等宽字体配置数组
 * 包含各种支持 Nerd Font 图标的等宽字体
 */
export const MONO_NERD_FONTS = [
  {
    family: "JetBrains Mono Nerd Font",
    regular: jetbrainsMono,
    bold: jetbrainsMonoBold,
  },
  {
    family: "Fira Code Nerd Font",
    regular: firaCode,
    bold: firaCodeBold,
  },
  {
    family: "Cascadia Code Nerd Font",
    regular: cascadiaCode,
    bold: cascadiaCodeBold,
  },
  {
    family: "Hack Nerd Font",
    regular: hack,
    bold: hackBold,
  },
  {
    family: "Source Code Pro Nerd Font",
    regular: sourceCodePro,
    bold: sourceCodeProBold,
  },
  {
    family: "Inconsolata Nerd Font",
    regular: inconsolata,
    bold: inconsolataBold,
  },
  {
    family: "Roboto Mono Nerd Font",
    regular: robotoMono,
    bold: robotoMonoBold,
  },
  {
    family: "Ubuntu Mono Nerd Font",
    regular: ubuntuMono,
    bold: ubuntuMonoBold,
  },
  {
    family: "Intel One Mono Nerd Font",
    regular: intelOneMono,
    bold: intelOneMonoBold,
  },
  {
    family: "Meslo LGS Nerd Font",
    regular: mesloLgs,
    bold: mesloLgsBold,
  },
] satisfies MonoFont[]

/**
 * 生成 Nerd Font 等宽字体的 CSS @font-face 规则
 */
const monoNerdCss = MONO_NERD_FONTS.map(
  (font) => `
        @font-face {
          font-family: "${font.family}";
          src: url("${font.regular}") format("woff2");
          font-display: swap;
          font-style: normal;
          font-weight: 400;
        }
        @font-face {
          font-family: "${font.family}";
          src: url("${font.bold}") format("woff2");
          font-display: swap;
          font-style: normal;
          font-weight: 700;
        }`,
).join("")

/**
 * 字体组件
 * 加载并定义应用中使用的所有字体
 */
export const Font = () => {
  return (
    <>
      <Style>{`
        /* Inter 字体 - 用于正文文本 */
        @font-face {
          font-family: "Inter";
          src: url("${inter}") format("woff2-variations");
          font-display: swap;
          font-style: normal;
          font-weight: 100 900;
        }
        /* Inter 字体的回退方案 */
        @font-face {
          font-family: "Inter Fallback";
          src: local("Arial");
          size-adjust: 100%;
          ascent-override: 97%;
          descent-override: 25%;
          line-gap-override: 1%;
        }
        /* IBM Plex Mono 字体 - 用于代码 */
        @font-face {
          font-family: "IBM Plex Mono";
          src: url("${ibmPlexMonoRegular}") format("woff2");
          font-display: swap;
          font-style: normal;
          font-weight: 400;
        }
        @font-face {
          font-family: "IBM Plex Mono";
          src: url("${ibmPlexMonoMedium}") format("woff2");
          font-display: swap;
          font-style: normal;
          font-weight: 500;
        }
        @font-face {
          font-family: "IBM Plex Mono";
          src: url("${ibmPlexMonoBold}") format("woff2");
          font-display: swap;
          font-style: normal;
          font-weight: 700;
        }
        /* IBM Plex Mono 字体的回退方案 */
        @font-face {
          font-family: "IBM Plex Mono Fallback";
          src: local("Courier New");
          size-adjust: 100%;
          ascent-override: 97%;
          descent-override: 25%;
          line-gap-override: 1%;
        }
${monoNerdCss}
      `}</Style>
      {/* 预加载关键字体，提升性能 */}
      <Link rel="preload" href={inter} as="font" type="font/woff2" crossorigin="anonymous" />
      <Link rel="preload" href={ibmPlexMonoRegular} as="font" type="font/woff2" crossorigin="anonymous" />
    </>
  )
}
