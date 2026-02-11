import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu"
import { type as ostype } from "@tauri-apps/plugin-os"

import { runUpdater, UPDATER_ENABLED } from "./updater"

/**
 * 创建应用菜单
 * 仅在 macOS 平台上创建菜单，因为其他平台使用系统默认菜单
 */
export async function createMenu() {
  // 仅在 macOS 平台上创建菜单
  if (ostype() !== "macos") return

  // 创建菜单实例
  const menu = await Menu.new({
    items: [
      // OpenCode 菜单
      await Submenu.new({
        text: "OpenCode",
        items: [
          // 关于 OpenCode
          await PredefinedMenuItem.new({
            item: { About: null },
          }),
          // 检查更新
          await MenuItem.new({
            enabled: UPDATER_ENABLED, // 根据更新器是否启用决定菜单项是否可用
            action: () => runUpdater({ alertOnFail: true }), // 执行更新检查
            text: "检查更新...",
          }),
          // 分隔线
          await PredefinedMenuItem.new({
            item: "Separator",
          }),
          // 隐藏 OpenCode
          await PredefinedMenuItem.new({
            item: "Hide",
          }),
          // 隐藏其他应用
          await PredefinedMenuItem.new({
            item: "HideOthers",
          }),
          // 显示所有应用
          await PredefinedMenuItem.new({
            item: "ShowAll",
          }),
          // 分隔线
          await PredefinedMenuItem.new({
            item: "Separator",
          }),
          // 退出 OpenCode
          await PredefinedMenuItem.new({
            item: "Quit",
          }),
        ].filter(Boolean), // 过滤掉无效的菜单项
      }),
      // 文件菜单（暂时注释）
      // await Submenu.new({
      //   text: "File",
      //   items: [
      //     await MenuItem.new({
      //       enabled: false,
      //       text: "Open Project...",
      //     }),
      //     await PredefinedMenuItem.new({
      //       item: "Separator"
      //     }),
      //     await MenuItem.new({
      //       enabled: false,
      //       text: "New Session",
      //     }),
      //     await PredefinedMenuItem.new({
      //       item: "Separator"
      //     }),
      //     await MenuItem.new({
      //       enabled: false,
      //       text: "Close Project",
      //     })
      //   ]
      // }),
      // 编辑菜单
      await Submenu.new({
        text: "编辑",
        items: [
          // 撤销
          await PredefinedMenuItem.new({
            item: "Undo",
          }),
          // 重做
          await PredefinedMenuItem.new({
            item: "Redo",
          }),
          // 分隔线
          await PredefinedMenuItem.new({
            item: "Separator",
          }),
          // 剪切
          await PredefinedMenuItem.new({
            item: "Cut",
          }),
          // 复制
          await PredefinedMenuItem.new({
            item: "Copy",
          }),
          // 粘贴
          await PredefinedMenuItem.new({
            item: "Paste",
          }),
          // 全选
          await PredefinedMenuItem.new({
            item: "SelectAll",
          }),
        ],
      }),
    ],
  })
  
  // 将菜单设置为应用菜单
  menu.setAsAppMenu()
}
