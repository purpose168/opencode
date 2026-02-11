// 防止 Windows 发布版本中出现额外的控制台窗口，请勿删除！！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 代码来源：https://github.com/skyline69/balatro-mod-manager
#[cfg(target_os = "linux")]
/// 配置显示后端，处理 Linux 上的 Wayland/X11 显示问题
/// 返回一个可选的字符串，包含显示后端配置的说明
fn configure_display_backend() -> Option<String> {
    use std::env;

    // 如果环境变量不存在，则设置它
    let set_env_if_absent = |key: &str, value: &str| {
        if env::var_os(key).is_none() {
            // 安全性：在启动期间调用，此时还没有创建任何线程，因此修改
            // 进程环境是安全的。
            unsafe { env::set_var(key, value) };
        }
    };

    // 检测是否在 Wayland 会话中
    let on_wayland = env::var_os("WAYLAND_DISPLAY").is_some()
        || matches!(
            env::var("XDG_SESSION_TYPE"),
            Ok(v) if v.eq_ignore_ascii_case("wayland")
        );
    if !on_wayland {
        return None;
    }

    // 允许用户在知道其设置稳定的情况下明确保留 Wayland
    let allow_wayland = matches!(
        env::var("OC_ALLOW_WAYLAND"),
        Ok(v) if matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes")
    );
    if allow_wayland {
        return Some("检测到 Wayland 会话；尊重 OC_ALLOW_WAYLAND=1 设置".into());
    }

    // 当 XWayland 可用时优先使用它，以避免启动期间出现的 Wayland 协议错误
    if env::var_os("DISPLAY").is_some() {
        set_env_if_absent("WINIT_UNIX_BACKEND", "x11");
        set_env_if_absent("GDK_BACKEND", "x11");
        set_env_if_absent("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        return Some(
            "检测到 Wayland 会话；强制使用 X11 后端以避免合成器协议错误。 \
               设置 OC_ALLOW_WAYLAND=1 以保留原生 Wayland。"
                .into(),
        );
    }

    set_env_if_absent("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    Some(
        "检测到没有 X11 的 Wayland 会话；保持启用 Wayland（如果需要，请手动设置 WINIT_UNIX_BACKEND/GDK_BACKEND）。"
            .into(),
    )
}

/// 应用程序的主入口点
/// 配置显示后端（仅 Linux）并启动 OpenCode 应用
fn main() {
    #[cfg(target_os = "linux")]
    {
        if let Some(backend_note) = configure_display_backend() {
            eprintln!("{backend_note:?}");
        }
    }

    // 调用库中的 run 函数启动应用
    opencode_lib::run()
}
