import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { List } from "@opencode-ai/ui/list"
import { getDirectory, getFilename } from "@opencode-ai/util/path"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"
import { useLayout } from "@/context/layout"
import { useLocal } from "@/context/local"

export function DialogSelectFile() {
  const layout = useLayout()
  const local = useLocal()
  const dialog = useDialog()
  const params = useParams()
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey()))
  return (
    <Dialog title="选择文件">
      <List
        search={{ placeholder: "搜索文件", autofocus: true }}
        emptyMessage="未找到文件"
        items={local.file.searchFiles}
        key={(x) => x}
        onSelect={(path) => {
          if (path) {
            tabs().open("file://" + path)
          }
          dialog.close()
        }}
      >
        {(i) => (
          <div class="w-full flex items-center justify-between rounded-md">
            <div class="flex items-center gap-x-3 grow min-w-0">
              <FileIcon node={{ path: i, type: "file" }} class="shrink-0 size-4" />
              <div class="flex items-center text-14-regular">
                <span class="text-text-weak whitespace-nowrap overflow-hidden overflow-ellipsis truncate min-w-0">
                  {getDirectory(i)}
                </span>
                <span class="text-text-strong whitespace-nowrap">{getFilename(i)}</span>
              </div>
            </div>
          </div>
        )}
      </List>
    </Dialog>
  )
}
