import { useState, useCallback } from "react";
import type { TreeNode } from "./lib/kaitai.ts";

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = !!node.children?.length;

  const toggle = useCallback(() => {
    if (hasChildren) setOpen((o) => !o);
  }, [hasChildren]);

  return (
    <li className="tree-node">
      <div
        className={`tree-row ${hasChildren ? "expandable" : ""}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={toggle}
      >
        {hasChildren && (
          <span className="tree-toggle">{open ? "\u25BE" : "\u25B8"}</span>
        )}
        {!hasChildren && <span className="tree-toggle-spacer" />}
        <NodeLabel node={node} />
      </div>
      {hasChildren && open && (
        <ul className="tree-children">
          {node.children!.map((child, i) => (
            <TreeNodeRow key={child.name + i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function NodeLabel({ node }: { node: TreeNode }) {
  switch (node.type) {
    case "object":
      return (
        <span>
          <span className="node-name">{node.name}</span>
          {node.className && (
            <>
              {" ["}
              <span className="node-class">{node.className}</span>
              {"]"}
            </>
          )}
        </span>
      );

    case "array":
      return (
        <span>
          <span className="node-name">{node.name}</span>
          <span className="node-meta"> ({node.arrayLength})</span>
        </span>
      );

    case "bytes":
      return (
        <span>
          <span className="node-name">{node.name}</span>
          {" = "}
          <span className="node-bytes">[{node.bytesPreview}]</span>
          <span className="node-meta"> ({node.bytesLength} bytes)</span>
        </span>
      );

    case "primitive": {
      if (node.value === null || node.value === undefined) {
        return (
          <span>
            <span className="node-name">{node.name}</span>
            {" = "}
            <span className="node-null">null</span>
          </span>
        );
      }
      if (typeof node.value === "string") {
        return (
          <span>
            <span className="node-name">{node.name}</span>
            {" = "}
            <span className="node-string">"{node.value}"</span>
          </span>
        );
      }
      if (typeof node.value === "boolean") {
        return (
          <span>
            <span className="node-name">{node.name}</span>
            {" = "}
            <span className="node-bool">{String(node.value)}</span>
          </span>
        );
      }
      // number
      return (
        <span>
          <span className="node-name">{node.name}</span>
          {" = "}
          <span className="node-value">{node.hexValue ?? node.value}</span>
          {node.hexValue && (
            <span className="node-int"> = {node.value}</span>
          )}
        </span>
      );
    }
  }
}

export default function TreeView({ root }: { root: TreeNode }) {
  return (
    <div className="tree-view">
      <ul className="tree-children">
        <TreeNodeRow node={root} depth={0} />
      </ul>
    </div>
  );
}
