import Quill from 'quill'

export interface ParagraphBlock {
  isEmpty: boolean
  lines: any[]
}

export function getParagraphBlocks(quill: Quill): ParagraphBlock[] {
  const lines = quill.getLines()
  const blocks: ParagraphBlock[] = []

  if (lines.length === 0) return blocks

  let currentBlock: ParagraphBlock | null = null
  let currentIndex = 0

  for (const line of lines) {
    const length = line.length()
    // Quill lines always end with a newline, so we check the text before it
    const text = quill.getText(currentIndex, length > 0 ? length - 1 : 0)

    // A line is empty if it contains only whitespace and no embeds (like images)
    const hasEmbeds = !!line.domNode?.querySelector('img, video, iframe')
    const isEmpty = text.trim() === '' && !hasEmbeds

    if (!currentBlock) {
      currentBlock = { isEmpty, lines: [line] }
    } else if (currentBlock.isEmpty === isEmpty) {
      currentBlock.lines.push(line)
    } else {
      blocks.push(currentBlock)
      currentBlock = { isEmpty, lines: [line] }
    }
    currentIndex += length
  }

  if (currentBlock) {
    blocks.push(currentBlock)
  }

  return blocks
}
