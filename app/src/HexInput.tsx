import { useRef, useEffect, useCallback } from "react";
import { useHighlightStore } from "./lib/highlightStore.ts";

/**
 * Hex input with a mirrored backdrop for CSS Highlight API.
 *
 * The textarea is transparent; the mirror div behind it renders the
 * same text and receives CSS custom highlights for byte ranges.
 */
export default function HexInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hoveredRange = useHighlightStore((s) => s.hoveredRange);
  const setSelectedRange = useHighlightStore((s) => s.setSelectedRange);

  // Build a map from byte index → character range in the hex string.
  // Each byte is represented as two hex chars, possibly separated by
  // spaces, colons, "0x" prefixes, etc.
  const byteCharMap = useRef<{ start: number; end: number }[]>([]);

  useEffect(() => {
    const map: { start: number; end: number }[] = [];
    let byteIdx = 0;
    let i = 0;
    const s = value;
    while (i < s.length) {
      // skip whitespace, colons, commas
      if (/[\s:,]/.test(s[i])) {
        i++;
        continue;
      }
      // skip "0x" prefix
      if (s[i] === "0" && s[i + 1]?.toLowerCase() === "x") {
        i += 2;
        continue;
      }
      // expect two hex chars
      if (i + 1 < s.length && /[0-9a-fA-F]/.test(s[i]) && /[0-9a-fA-F]/.test(s[i + 1])) {
        map.push({ start: i, end: i + 2 });
        byteIdx++;
        i += 2;
      } else {
        i++;
      }
    }
    byteCharMap.current = map;
    // suppress unused warning
    void byteIdx;
  }, [value]);

  // Apply CSS Highlight API for hovered byte range
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

      // Also include the separator after this byte (space/colon)
      let end = charRange.end;
      if (b < hoveredRange.end - 1) {
        const next = byteCharMap.current[b + 1];
        if (next) end = next.start;
      }

      const r = new Range();
      r.setStart(textNode, charRange.start);
      r.setEnd(textNode, Math.min(end, value.length));
      ranges.push(r);
    }

    if (ranges.length > 0) {
      // Merge adjacent ranges into one for cleaner highlight
      const merged = new Range();
      merged.setStart(ranges[0].startContainer, ranges[0].startOffset);
      const last = ranges[ranges.length - 1];
      merged.setEnd(last.endContainer, last.endOffset);
      CSS.highlights.set("hex-highlight", new Highlight(merged));
    }
  }, [hoveredRange, value]);

  // Sync textarea scroll to mirror
  const syncScroll = useCallback(() => {
    if (mirrorRef.current && textareaRef.current) {
      mirrorRef.current.scrollTop = textareaRef.current.scrollTop;
      mirrorRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Handle text selection in textarea → byte range → tree highlight
  const handleSelect = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart === selectionEnd) {
      setSelectedRange(null);
      return;
    }

    // Find which bytes overlap the selected character range
    let minByte = Infinity;
    let maxByte = -Infinity;
    byteCharMap.current.forEach((charRange, byteIdx) => {
      if (charRange.end > selectionStart && charRange.start < selectionEnd) {
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
    <div className="hex-input-wrapper">
      <div ref={mirrorRef} className="hex-mirror" aria-hidden="true">
        {value}
      </div>
      <textarea
        ref={textareaRef}
        id="hex-input"
        className="hex-input hex-input-transparent"
        placeholder="Paste hex bytes, e.g.: 89 50 4E 47 0D 0A 1A 0A ..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onSelect={handleSelect}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        spellCheck={false}
      />
    </div>
  );
}
