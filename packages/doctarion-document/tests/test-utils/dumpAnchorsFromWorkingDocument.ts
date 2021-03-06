import { ReadonlyWorkingDocument } from "../../src";

export function dumpAnchorsFromWorkingDocument(wd: ReadonlyWorkingDocument): string {
  let s = "";
  for (const [, anchor] of wd.anchors.entries()) {
    if (s) {
      s += "\n";
    }
    s += `Anchor: ${anchor.name ?? "∅"} ${anchor.orientation} (${anchor.node.nodeType.name}${
      anchor.graphemeIndex !== undefined ? ":" + anchor.node.children[anchor.graphemeIndex] : ""
    })${wd.getNodePath(anchor.node).toString()}${
      anchor.graphemeIndex !== undefined ? "⁙" + anchor.graphemeIndex + " " : " "
    }${
      anchor.relatedInteractor
        ? anchor.relatedInteractor.name
          ? "intr: " + anchor.relatedInteractor.name + " "
          : "intr: ∅"
        : ""
    }${
      anchor.relatedOriginatingNode
        ? "from: (" + anchor.relatedOriginatingNode.nodeType.name + ")" + wd.getNodePath(anchor.relatedOriginatingNode)
        : ""
    }`;
  }
  return s;
}
