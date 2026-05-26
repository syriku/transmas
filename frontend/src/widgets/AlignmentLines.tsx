import React, { useEffect, useState } from 'react'
import Quill from 'quill'
import { getParagraphBlocks } from '../utils/quillUtils'

interface AlignmentLinesProps {
  sourceQuill: Quill | null
  targetQuill: Quill | null
  isMatched: boolean
  containerRef: React.RefObject<HTMLDivElement>
}

interface LineCoordinates {
  x1: number
  y1: number
  x2: number
  y2: number
  isDashed?: boolean
}

const AlignmentLines: React.FC<AlignmentLinesProps> = ({
  sourceQuill,
  targetQuill,
  isMatched,
  containerRef,
}) => {
  const [lines, setLines] = useState<LineCoordinates[]>([])
  const [svgHeight, setSvgHeight] = useState<number>(0)

  useEffect(() => {
    if (!isMatched || !sourceQuill || !targetQuill || !containerRef.current) {
      setLines([])
      setSvgHeight(0)
      return
    }

    const updateLines = () => {
      const sourceBlocks = getParagraphBlocks(sourceQuill)
      const targetBlocks = getParagraphBlocks(targetQuill)

      if (sourceBlocks.length !== targetBlocks.length) {
        setLines([])
        setSvgHeight(0)
        return
      }

      const newLines: LineCoordinates[] = []
      const containerRect = containerRef.current!.getBoundingClientRect()

      const sourceEditorNode = sourceQuill.container
      const targetEditorNode = targetQuill.container

      const sourceEditorRect = sourceEditorNode.getBoundingClientRect()
      const targetEditorRect = targetEditorNode.getBoundingClientRect()

      // Calculate SVG height based on the taller editor
      const contentHeight = Math.max(sourceEditorRect.height, targetEditorRect.height)
      setSvgHeight(contentHeight)

      const x1 = sourceEditorRect.right - containerRect.left
      const x2 = targetEditorRect.left - containerRect.left
      const scrollTop = containerRef.current!.scrollTop

      for (let i = 0; i < sourceBlocks.length; i++) {
        const sBlock = sourceBlocks[i]
        const tBlock = targetBlocks[i]

        const sourceStartIndex = sourceQuill.getIndex(sBlock.lines[0])
        const sourceEndIndex = sourceQuill.getIndex(sBlock.lines[sBlock.lines.length - 1])

        const targetStartIndex = targetQuill.getIndex(tBlock.lines[0])
        const targetEndIndex = targetQuill.getIndex(tBlock.lines[tBlock.lines.length - 1])

        const sourceStartBounds = sourceQuill.getBounds(sourceStartIndex)
        const sourceEndBounds = sourceQuill.getBounds(sourceEndIndex)

        const targetStartBounds = targetQuill.getBounds(targetStartIndex)
        const targetEndBounds = targetQuill.getBounds(targetEndIndex)

        if (!sourceStartBounds || !sourceEndBounds || !targetStartBounds || !targetEndBounds)
          continue

        const y1 =
          sourceEditorRect.top -
          containerRect.top +
          scrollTop +
          (sourceStartBounds.top + sourceEndBounds.top + sourceEndBounds.height) / 2
        const y2 =
          targetEditorRect.top -
          containerRect.top +
          scrollTop +
          (targetStartBounds.top + targetEndBounds.top + targetEndBounds.height) / 2

        newLines.push({
          x1,
          y1,
          x2,
          y2,
          isDashed: sBlock.isEmpty && tBlock.isEmpty,
        })
      }

      setLines(newLines)
    }

    // Give it a small delay initially to let the DOM settle
    setTimeout(updateLines, 50)

    const handleTextChange = () => {
      setTimeout(updateLines, 0)
    }

    sourceQuill.on('text-change', handleTextChange)
    targetQuill.on('text-change', handleTextChange)
    window.addEventListener('resize', updateLines)

    const resizeObserver = new ResizeObserver(() => {
      updateLines()
    })

    resizeObserver.observe(sourceQuill.container)
    resizeObserver.observe(targetQuill.container)

    return () => {
      sourceQuill.off('text-change', handleTextChange)
      targetQuill.off('text-change', handleTextChange)
      window.removeEventListener('resize', updateLines)
      resizeObserver.disconnect()
    }
  }, [sourceQuill, targetQuill, isMatched, containerRef])

  if (!isMatched || lines.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: svgHeight ? `${svgHeight}px` : '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {lines.map((line, i) => {
        const midX = (line.x1 + line.x2) / 2
        return (
          <path
            key={i}
            d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
            fill="transparent"
            stroke="#b3d4ff"
            strokeWidth="2"
            strokeOpacity="0.6"
            strokeDasharray={line.isDashed ? '4 4' : undefined}
          />
        )
      })}
    </svg>
  )
}

export default AlignmentLines
