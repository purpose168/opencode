// 窗口自定义模块，包含窗口相关的定制功能
mod window_customizer;

use std::{
    collections::VecDeque,           // 双端队列，用于存储日志条目
    net::{SocketAddr, TcpListener},   // 网络相关，用于获取空闲端口和检查服务器状态
    sync::{Arc, Mutex},               // 同步原语，用于线程安全的状态管理
    time::{Duration, Instant},        // 时间相关，用于超时处理和计时
};
// Tauri 核心库导入
use tauri::{AppHandle, LogicalSize, Manager, RunEvent, WebviewUrl, WebviewWindow, path::BaseDirectory};
// 剪贴板插件，用于复制日志到剪贴板
use tauri_plugin_clipboard_manager::ClipboardExt;
// 对话框插件，用于显示错误消息和用户交互
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogResult};
// Shell 插件，用于启动和管理子进程
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
// Tokio 网络库，用于异步检查服务器状态
use tokio::net::TcpSocket;

// 导入窗口自定义插件，用于禁用捏合缩放功能
use crate::window_customizer::PinchZoomDisablePlugin;

/// 服务器状态结构体，用于管理子进程
/// 包装了一个可选的 CommandChild，使用 Arc<Mutex> 实现线程安全
#[derive(Clone)]
struct ServerState(Arc<Mutex<Option<CommandChild>>>);

/// 日志状态结构体，用于存储和管理日志条目
/// 使用 VecDeque 实现有限容量的日志存储，保持最新的日志条目
#[derive(Clone)]
struct LogState(Arc<Mutex<VecDeque<String>>>);

/// 最大日志条目数，超过这个数量会自动移除最旧的日志
const MAX_LOG_ENTRIES: usize = 200;

/// 终止侧边车进程的命令处理函数
/// 从应用状态中获取服务器状态，然后终止子进程
#[tauri::command]
fn kill_sidecar(app: AppHandle) {
    let Some(server_state) = app.try_state::<ServerState>() else {
        println!("服务器未运行");
        return;
    };

    let Some(server_state) = server_state
        .0
        .lock()
        .expect("获取互斥锁失败")
        .take()
    else {
        println!("服务器状态缺失");
        return;
    };

    let _ = server_state.kill();

    println!("已终止服务器");
}

/// 将日志复制到剪贴板的命令处理函数
/// 从应用状态中获取日志状态，然后将所有日志条目复制到剪贴板
#[tauri::command]
async fn copy_logs_to_clipboard(app: AppHandle) -> Result<(), String> {
    let log_state = app.try_state::<LogState>().ok_or("未找到日志状态")?;

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "获取日志锁失败")?;

    let log_text = logs.iter().cloned().collect::<Vec<_>>().join("");

    app.clipboard()
        .write_text(log_text)
        .map_err(|e| format!("复制到剪贴板失败: {}", e))?;

    Ok(())
}

/// 获取日志的命令处理函数
/// 从应用状态中获取日志状态，然后返回所有日志条目的字符串
#[tauri::command]
async fn get_logs(app: AppHandle) -> Result<String, String> {
    let log_state = app.try_state::<LogState>().ok_or("未找到日志状态")?;

    let logs = log_state
        .0
        .lock()
        .map_err(|_| "获取日志锁失败")?;

    Ok(logs.iter().cloned().collect::<Vec<_>>().join(""))
}

/// 获取侧边车服务器端口
/// 优先使用环境变量中的端口，如果没有则自动获取一个空闲端口
fn get_sidecar_port() -> u32 {
    option_env!("OPENCODE_PORT")
        .map(|s| s.to_string())
        .or_else(|| std::env::var("OPENCODE_PORT").ok())
        .and_then(|port_str| port_str.parse().ok())
        .unwrap_or_else(|| {
            TcpListener::bind("127.0.0.1:0")
                .expect("绑定获取空闲端口失败")
                .local_addr()
                .expect("获取本地地址失败")
                .port()
        }) as u32
}

/// 获取用户的默认 shell
/// 优先使用环境变量中的 SHELL，如果没有则使用 /bin/sh
fn get_user_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
}

/// 启动侧边车服务器进程
/// 根据不同操作系统平台使用不同的启动方式，并设置环境变量和参数
fn spawn_sidecar(app: &AppHandle, port: u32) -> CommandChild {
    let log_state = app.state::<LogState>();
    let log_state_clone = log_state.inner().clone();

    // 获取应用本地数据目录，用于存储状态
    let state_dir = app
        .path()
        .resolve("", BaseDirectory::AppLocalData)
        .expect("解析应用本地数据目录失败");

    // Windows 平台的启动方式
    #[cfg(target_os = "windows")]
    let (mut rx, child) = app
        .shell()
        .sidecar("opencode-cli")
        .unwrap()
        .env("OPENCODE_EXPERIMENTAL_ICON_DISCOVERY", "true")  // 启用实验性图标发现
        .env("OPENCODE_CLIENT", "desktop")                    // 设置客户端类型为桌面
        .env("XDG_STATE_HOME", &state_dir)                     // 设置状态目录
        .args(["serve", &format!("--port={port}")])            // 启动服务并指定端口
        .spawn()
        .expect("启动 opencode 失败");

    // 非 Windows 平台的启动方式
    #[cfg(not(target_os = "windows"))]
    let (mut rx, child) = {
        // 获取当前可执行文件路径，然后找到 opencode-cli 可执行文件
        let sidecar_path = tauri::utils::platform::current_exe()
            .expect("获取当前可执行文件失败")
            .parent()
            .expect("获取父目录失败")
            .join("opencode-cli");
        let shell = get_user_shell();
        app.shell()
            .command(&shell)
            .env("OPENCODE_EXPERIMENTAL_ICON_DISCOVERY", "true")  // 启用实验性图标发现
            .env("OPENCODE_CLIENT", "desktop")                    // 设置客户端类型为桌面
            .env("XDG_STATE_HOME", &state_dir)                     // 设置状态目录
            .args([
                "-il",  // 交互式登录 shell
                "-c",   // 执行命令
                &format!("{} serve --port={}", sidecar_path.display(), port),  // 启动服务并指定端口
            ])
            .spawn()
            .expect("启动 opencode 失败")
    };

    // 异步处理子进程的输出
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    print!("{line}");

                    // 存储日志到共享状态
                    if let Ok(mut logs) = log_state_clone.0.lock() {
                        logs.push_back(format!("[STDOUT] {}", line));
                        // 只保留最新的 MAX_LOG_ENTRIES 条日志
                        while logs.len() > MAX_LOG_ENTRIES {
                            logs.pop_front();
                        }
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    eprint!("{line}");

                    // 存储日志到共享状态
                    if let Ok(mut logs) = log_state_clone.0.lock() {
                        logs.push_back(format!("[STDERR] {}", line));
                        // 只保留最新的 MAX_LOG_ENTRIES 条日志
                        while logs.len() > MAX_LOG_ENTRIES {
                            logs.pop_front();
                        }
                    }
                }
                _ => {}
            }
        }
    });

    child
}

/// 检查服务器是否正在运行
/// 通过尝试连接到指定端口来判断服务器是否启动成功
async fn is_server_running(port: u32) -> bool {
    TcpSocket::new_v4()
        .unwrap()
        .connect(SocketAddr::new(
            "127.0.0.1".parse().expect("解析 IP 失败"),
            port as u16,
        ))
        .await
        .is_ok()
}

/// 应用程序的主入口点
/// 配置并启动 Tauri 应用，设置插件、命令处理器和应用状态
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 检查是否启用了自动更新功能（通过环境变量判断）
    let updater_enabled = option_env!("TAURI_SIGNING_PRIVATE_KEY").is_some();

    // 创建 Tauri 应用构建器并配置各种插件
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())                          // 操作系统相关功能
        .plugin(tauri_plugin_window_state::Builder::new().build())  // 窗口状态管理
        .plugin(tauri_plugin_store::Builder::new().build())        // 数据存储功能
        .plugin(tauri_plugin_dialog::init())                       // 对话框功能
        .plugin(tauri_plugin_shell::init())                        // Shell 功能
        .plugin(tauri_plugin_process::init())                      // 进程管理功能
        .plugin(tauri_plugin_opener::init())                       // 文件打开功能
        .plugin(tauri_plugin_clipboard_manager::init())            // 剪贴板管理功能
        .plugin(tauri_plugin_http::init())                         // HTTP 客户端功能
        .plugin(tauri_plugin_notification::init())                 // 通知功能
        .plugin(PinchZoomDisablePlugin)                             // 禁用捏合缩放插件
        .invoke_handler(tauri::generate_handler![                  // 注册命令处理器
            kill_sidecar,
            copy_logs_to_clipboard,
            get_logs
        ])
        .setup(move |app| {
            let app = app.handle().clone();

            // 初始化日志状态
            app.manage(LogState(Arc::new(Mutex::new(VecDeque::new()))));

            // 异步启动服务器和创建窗口
            tauri::async_runtime::spawn(async move {
                let port = get_sidecar_port();

                // 检查服务器是否已经在运行
                let should_spawn_sidecar = !is_server_running(port).await;

                let child = if should_spawn_sidecar {
                    // 启动侧边车服务器进程
                    let child = spawn_sidecar(&app, port);

                    let timestamp = Instant::now();
                    // 等待服务器启动，最多等待 7 秒
                    loop {
                        if timestamp.elapsed() > Duration::from_secs(7) {
                            // 服务器启动失败，显示错误对话框
                            let res = app.dialog()
                              .message("OpenCode 服务器启动失败。使用下方按钮复制日志并发送给团队寻求帮助。")
                              .title("启动失败")
                              .buttons(MessageDialogButtons::OkCancelCustom("复制日志并退出".to_string(), "退出".to_string()))
                              .blocking_show_with_result();

                            // 如果用户选择复制日志
                            if matches!(&res, MessageDialogResult::Custom(name) if name == "复制日志并退出") {
                                match copy_logs_to_clipboard(app.clone()).await {
                                    Ok(()) => println!("日志已成功复制到剪贴板"),
                                    Err(e) => println!("复制日志到剪贴板失败: {}", e),
                                }
                            }

                            // 退出应用
                            app.exit(1);
                            return;
                        }

                        tokio::time::sleep(Duration::from_millis(10)).await;

                        // 检查服务器是否启动成功
                        if is_server_running(port).await {
                            // 给服务器一点时间预热
                            tokio::time::sleep(Duration::from_millis(10)).await;
                            break;
                        }
                    }

                    println!("服务器就绪，耗时 {:?}", timestamp.elapsed());

                    Some(child)
                } else {
                    None
                };

                // 获取主显示器信息，用于设置窗口大小
                let primary_monitor = app.primary_monitor().ok().flatten();
                let size = primary_monitor
                    .map(|m| m.size().to_logical(m.scale_factor()))
                    .unwrap_or(LogicalSize::new(1920, 1080));

                // 创建窗口构建器
                let mut window_builder = 
                    WebviewWindow::builder(&app, "main", WebviewUrl::App("/".into()))
                        .title("OpenCode")
                        .inner_size(size.width as f64, size.height as f64)
                        .decorations(true)
                        .zoom_hotkeys_enabled(true)
                        .disable_drag_drop_handler()
                        .initialization_script(format!(
                            r#"
                          window.__OPENCODE__ ??= {{}};
                          window.__OPENCODE__.updaterEnabled = {updater_enabled};
                          window.__OPENCODE__.port = {port};
                        "#
                        ));

                // macOS 平台的特殊配置
                #[cfg(target_os = "macos")]
                {
                    window_builder = window_builder
                        .title_bar_style(tauri::TitleBarStyle::Overlay)
                        .hidden_title(true);
                }

                // 构建窗口
                window_builder.build().expect("创建窗口失败");

                // 管理服务器状态
                app.manage(ServerState(Arc::new(Mutex::new(child))));
            });

            Ok(())
        });

    // 如果启用了自动更新，添加更新插件
    if updater_enabled {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // 构建并运行应用
    builder
        .build(tauri::generate_context!())
        .expect("运行 tauri 应用时出错")
        .run(|app, event| {
            // 处理退出事件，终止服务器进程
            if let RunEvent::Exit = event {
                println!("收到退出事件");
                kill_sidecar(app.clone());
            }
        });
}
