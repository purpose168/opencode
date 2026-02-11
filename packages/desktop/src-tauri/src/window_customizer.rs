use tauri::{plugin::Plugin, Manager, Runtime, Window};

/// 捏合缩放禁用插件
/// 用于禁用 WebKit 中的捏合缩放手势，特别是在 Linux 平台上
pub struct PinchZoomDisablePlugin;

/// 实现 Default trait，用于创建默认实例
impl Default for PinchZoomDisablePlugin {
    fn default() -> Self {
        Self
    }
}

/// 实现 Plugin trait，用于 Tauri 应用
impl<R: Runtime> Plugin<R> for PinchZoomDisablePlugin {
    /// 返回插件名称
    /// 在这个插件中，名称并不重要
    fn name(&self) -> &'static str {
        "Does not matter here"
    }

    /// 当窗口创建时调用的方法
    /// 用于获取 webview 并禁用捏合缩放手势
    fn window_created(&mut self, window: Window<R>) {
        // 获取 webview 窗口
        let Some(webview_window) = window.get_webview_window(window.label()) else {
            return;
        };

        // 操作 webview
        let _ = webview_window.with_webview(|_webview| {
            // 仅在 Linux 平台上执行
            #[cfg(target_os = "linux")]
            unsafe {
                use gtk::glib::ObjectExt;
                use gtk::GestureZoom;
                use webkit2gtk::glib::gobject_ffi;

                // 获取 WebKit 视图的缩放手势
                if let Some(data) = _webview.inner().data::<GestureZoom>("wk-view-zoom-gesture") {
                    // 销毁所有与缩放手势相关的信号处理器，从而禁用捏合缩放
                    gobject_ffi::g_signal_handlers_destroy(data.as_ptr().cast());
                }
            }
        });
    }
}
