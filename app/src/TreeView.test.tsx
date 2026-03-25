// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import TreeView from "./TreeView.tsx";
import { useHighlightStore } from "./lib/highlightStore.ts";
import type { TreeNode } from "./lib/kaitai.ts";

const sampleTree: TreeNode = {
  name: "simple_packet",
  type: "object",
  className: "SimplePacket",
  range: { start: 0, end: 9 },
  children: [
    { name: "magic", type: "primitive", value: 0xcafe, hexValue: "0xCAFE", range: { start: 0, end: 2 } },
    { name: "length", type: "primitive", value: 4, hexValue: "0x0004", range: { start: 2, end: 4 } },
    { name: "payload", type: "bytes", bytesPreview: "de ad be ef", bytesLength: 4, range: { start: 4, end: 8 } },
    { name: "checksum", type: "primitive", value: 0xff, hexValue: "0xFF", range: { start: 8, end: 9 } },
  ],
};

describe("TreeView selection", () => {
  beforeEach(() => {
    useHighlightStore.setState({ hoveredRange: null, selectedRange: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("clicking a leaf node sets selectedRange to its byte range", () => {
    render(<TreeView root={sampleTree} />);

    fireEvent.click(screen.getByText("magic"));
    expect(useHighlightStore.getState().selectedRange).toEqual({ start: 0, end: 2 });
  });

  it("clicking a different node updates selectedRange", () => {
    render(<TreeView root={sampleTree} />);

    fireEvent.click(screen.getByText("magic"));
    expect(useHighlightStore.getState().selectedRange).toEqual({ start: 0, end: 2 });

    fireEvent.click(screen.getByText("checksum"));
    expect(useHighlightStore.getState().selectedRange).toEqual({ start: 8, end: 9 });
  });

  it("clicking the root object node sets selectedRange to full range", () => {
    render(<TreeView root={sampleTree} />);

    fireEvent.click(screen.getByText("simple_packet"));
    expect(useHighlightStore.getState().selectedRange).toEqual({ start: 0, end: 9 });
  });

  it("clicking a bytes node sets selectedRange", () => {
    render(<TreeView root={sampleTree} />);

    fireEvent.click(screen.getByText("payload"));
    expect(useHighlightStore.getState().selectedRange).toEqual({ start: 4, end: 8 });
  });

  it("hovering a node sets hoveredRange, leaving clears it", () => {
    render(<TreeView root={sampleTree} />);

    const row = screen.getByText("magic").closest(".tree-row")!;
    fireEvent.mouseEnter(row);
    expect(useHighlightStore.getState().hoveredRange).toEqual({ start: 0, end: 2 });

    fireEvent.mouseLeave(row);
    expect(useHighlightStore.getState().hoveredRange).toBeNull();
  });

  it("selected node gets tree-row-highlighted CSS class", () => {
    useHighlightStore.setState({ selectedRange: { start: 0, end: 2 } });

    render(<TreeView root={sampleTree} />);

    const magicRow = screen.getByText("magic").closest(".tree-row")!;
    expect(magicRow).toHaveClass("tree-row-highlighted");

    const checksumRow = screen.getByText("checksum").closest(".tree-row")!;
    expect(checksumRow).not.toHaveClass("tree-row-highlighted");
  });
});
