import { useRef, useEffect, useCallback } from "react";
import { useHighlightStore } from "./lib/highlightStore.ts";

/**
 * Read-only hex viewer with CSS Highlight API support.
 * Displays a hex string with bidirectional highlighting to the tree view.
 */
export default function HexViewer({ hex }: { hex: string }) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const hoveredRange = useHighlightStore((s) => s.hoveredRange);
  const setSelectedRange = useHighlightStore((s) => s.setSelectedRange);

  // Build byte-to-char map for the hex string
  const byteCharMap = useRef<{ start: number; end: number }[]>([]);

  useEffect(() => {
    const map: { start: number; end: number }[] = [];
    let i = 0;
    const s = hex;
    while (i < s.length) {
      if (/[\s:,]/.test(s[i])) {
        i++;
        continue;
      }
      if (s[i] === "0" && s[i + 1]?.toLowerCase() === "x") {
        i += 2;
        continue;
      }
      if (
        i + 1 < s.length &&
        /[0-9a-fA-F]/.test(s[i]) &&
        /[0-9a-fA-F]/.test(s[i + 1])
      ) {
        map.push({ start: i, end: i + 2 });
        i += 2;
      } else {
        i++;
      }
    }
    byteCharMap.current = map;
  }, [hex]);

  // Apply CSS Highlight API
  useEffect(() => {
    if (!CSS.highlights || !mirrorRef.current) return;
    CSS.highlights.delete("hex-highlight");
    if (!hoveredRange || byteCharMap.current.length === 0) return;

    const textNode = mirrorRef.current.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    const ranges: Range[] = [];
    for (let b = hoveredRange.start; b < hoveredRange.end; b++) {
      const charRange = byteCharMap.current[b];
      if (!charRange) continue;
      let end = charRange.end;
      if (b < hoveredRange.end - 1) {
        const next = byteCharMap.current[b + 1];
        if (next) end = next.start;
      }
      const r = new Range();
      r.setStart(textNode, charRange.start);
      r.setEnd(textNode, Math.min(end, hex.length));
      ranges.push(r);
    }

    if (ranges.length > 0) {
      const merged = new Range();
      merged.setStart(ranges[0].startContainer, ranges[0].startOffset);
      const last = ranges[ranges.length - 1];
      merged.setEnd(last.endContainer, last.endOffset);
      CSS.highlights.set("hex-highlight", new Highlight(merged));
    }
  }, [hoveredRange, hex]);

  // Handle text selection → byte range
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectedRange(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    let minByte = Infinity;
    let maxByte = -Infinity;
    byteCharMap.current.forEach((charRange, byteIdx) => {
      if (charRange.end > startOffset && charRange.start < endOffset) {
        minByte = Math.min(minByte, byteIdx);
        maxByte = Math.max(maxByte, byteIdx);
      }
    });

    if (minByte <= maxByte) {
      setSelectedRange({ start: minByte, end: maxByte + 1 });
    } else {
      setSelectedRange(null);
    }
  }, [setSelectedRange]);

  return (
    <div className="hex-viewer" onMouseUp={handleMouseUp}>
      <div ref={mirrorRef} className="hex-viewer-content">
        {hex}
      </div>
    </div>
  );
}
