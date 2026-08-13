import { useState, useCallback } from 'react'
import { Upload, FileText, X } from 'lucide-react'

interface FileDropZoneProps {
  /** Called when a file is selected (either by drop or by dialog) */
  onFileSelected: (filePath: string, fileName: string) => void
  /** Currently selected file name (to show a "clear" button) */
  selectedFile?: string | null
}

/**
 * Drag-and-drop file upload zone.
 *
 * Users can:
 * 1. Drag a file from their file explorer onto this zone
 * 2. Click the zone to open a system file picker dialog
 */
export default function FileDropZone({ onFileSelected, selectedFile }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // In Electron with contextIsolation, we can't get the full path
      // from the drop event. Instead, use the file name as a hint and
      // prompt the user through the dialog.
      // For Electron, we always go through the IPC dialog for security.
      handleClickOpen()
    }
  }, [])

  async function handleClickOpen() {
    try {
      const filePath = await window.api.openFileDialog()
      if (filePath) {
        const fileName = filePath.split(/[/\\]/).pop() ?? filePath
        onFileSelected(filePath, fileName)
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err)
    }
  }

  function handleClear() {
    onFileSelected('', '')
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={selectedFile ? undefined : handleClickOpen}
        className={`
          relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-16
          transition-all cursor-pointer
          ${isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : selectedFile
              ? 'border-green-400 bg-green-50/50'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
          }
        `}
      >
        <div className={`mb-4 rounded-full p-4 ${
          selectedFile ? 'bg-green-100' : 'bg-primary/10'
        }`}>
          {selectedFile ? (
            <FileText className="h-8 w-8 text-green-600" />
          ) : (
            <Upload className="h-8 w-8 text-primary" />
          )}
        </div>

        {selectedFile ? (
          <>
            <h2 className="mb-1 text-lg font-semibold text-green-700">
              文件已选择
            </h2>
            <p className="mb-2 text-sm font-medium text-green-600">
              {selectedFile}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              清除选择
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-semibold">
              拖拽文件到此处，或点击选择文件
            </h2>
            <p className="text-sm text-muted-foreground">
              支持 CSV、Excel (.xlsx/.xls)、TXT、JSON、PDF 格式
            </p>
          </>
        )}
      </div>

    </div>
  )
}
