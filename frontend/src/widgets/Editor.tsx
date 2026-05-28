import React, {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useImperativeHandle,
  useState,
} from 'react'
import Quill from 'quill'
import type { Delta, Range } from 'quill'
import 'quill/dist/quill.snow.css'

interface EditorProps {
  readOnly?: boolean
  plainTextOnly?: boolean
  defaultValue?: Delta | string
  onTextChange?: (delta: Delta, oldDelta: Delta, source: string) => void
  onSelectionChange?: (range: Range, oldRange: Range, source: string) => void
  className?: string
  style?: React.CSSProperties
  autoExpand?: boolean
}

// Editor is an uncontrolled React component
const Editor = forwardRef<Quill | null, EditorProps>(
  (
    {
      readOnly,
      plainTextOnly,
      defaultValue,
      onTextChange,
      onSelectionChange,
      className,
      style,
      autoExpand,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [quill, setQuill] = useState<Quill | null>(null)
    const onTextChangeRef = useRef(onTextChange)
    const onSelectionChangeRef = useRef(onSelectionChange)

    useImperativeHandle(ref, () => quill as Quill, [quill])

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange
      onSelectionChangeRef.current = onSelectionChange
    })

    useEffect(() => {
      if (quill) {
        quill.enable(!readOnly)
      }
    }, [quill, readOnly])

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const editorContainer = container.ownerDocument.createElement('div')
      editorContainer.style.display = 'flex'
      editorContainer.style.flexDirection = 'column'
      if (autoExpand) {
        editorContainer.style.flex = '1 0 auto'
      } else {
        editorContainer.style.flex = '1'
        editorContainer.style.minHeight = '0'
      }
      container.appendChild(editorContainer)

      const quillInstance = new Quill(editorContainer, {
        theme: 'snow',
        modules: plainTextOnly ? { toolbar: false } : undefined,
        formats: plainTextOnly ? [] : undefined,
      })

      // Explicitly override Quill defaults on the DOM elements to prevent sharp corners and borders
      editorContainer.style.setProperty('border', 'none', 'important')
      editorContainer.style.borderRadius = 'inherit'
      editorContainer.style.setProperty('background', 'transparent', 'important')

      const qlEditor = editorContainer.querySelector('.ql-editor') as HTMLElement | null
      if (qlEditor) {
        qlEditor.style.borderRadius = 'inherit'
        qlEditor.style.setProperty('border', 'none', 'important')
        qlEditor.style.setProperty('background', 'transparent', 'important')
      }

      setQuill(quillInstance)

      if (defaultValue) {
        if (typeof defaultValue === 'string') {
          quillInstance.setText(defaultValue)
        } else {
          quillInstance.setContents(defaultValue)
        }
      }

      quillInstance.enable(!readOnly)

      quillInstance.on('text-change', (delta, oldDelta, source) => {
        onTextChangeRef.current?.(delta, oldDelta, source)
      })

      quillInstance.on('selection-change', (range, oldRange, source) => {
        onSelectionChangeRef.current?.(range, oldRange, source)
      })

      return () => {
        setQuill(null)
        container.innerHTML = ''
      }
    }, [])

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
      >
        <style>
          {`
            .ql-container.ql-snow {
              display: flex;
              flex-direction: column;
              border: none !important;
              border-radius: inherit !important;
              background: transparent !important;
              ${autoExpand ? 'flex: 1 0 auto; overflow: visible;' : 'flex: 1; overflow: hidden;'}
            }
            .ql-container.ql-snow .ql-editor {
              border-radius: inherit !important;
              background: transparent !important;
              border: none !important;
              user-select: text !important;
              -webkit-user-select: text !important;
              cursor: text;
              ${autoExpand ? 'flex: 1 0 auto; overflow-y: visible;' : 'flex: 1; overflow-y: auto;'}
            }
            .ql-disabled .ql-editor {
              cursor: default;
            }
          `}
        </style>
      </div>
    )
  },
)

Editor.displayName = 'Editor'

export default Editor
