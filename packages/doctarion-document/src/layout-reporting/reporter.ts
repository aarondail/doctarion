import { Chain, NodeNavigator, PathPart } from "../basic-traversal";
import { Node } from "../nodes";

import { NodeLayoutProvider } from "./provider";
import { LayoutRect } from "./rect";

export class NodeLayoutReporter {
  public constructor(private nodeToProviderLookup: (node: Node) => NodeLayoutProvider | undefined) {}

  public doesFollowingRectWrapToNewLine(rect: LayoutRect, followingRect: LayoutRect): boolean {
    return followingRect.left < rect.left || (followingRect.left === rect.left && followingRect.top > rect.top);
  }

  public doesLineWrapAfter(nodeNavigator: NodeNavigator): boolean {
    const nav = nodeNavigator.clone();
    const currentLayoutRect = this.getLayout(nav);
    if (nav.navigateToNextSibling()) {
      const nextLayoutRect = this.getLayout(nav);
      if (currentLayoutRect && nextLayoutRect) {
        if (this.doesFollowingRectWrapToNewLine(currentLayoutRect, nextLayoutRect)) {
          return true;
        }
      }
    }
    return false;
  }

  public doesLineWrapBefore(nodeNavigator: NodeNavigator): boolean {
    const nav = nodeNavigator.clone();
    const currentLayoutRect = this.getLayout(nav);
    if (nav.navigateToPrecedingSibling()) {
      const priorLayoutRect = this.getLayout(nav);
      if (currentLayoutRect && priorLayoutRect) {
        if (this.doesPreceedingRectWrapToNewLine(currentLayoutRect, priorLayoutRect)) {
          return true;
        }
      }
    }
    return false;
  }

  public doesPreceedingRectWrapToNewLine(rect: LayoutRect, preceedingRect: LayoutRect): boolean {
    return preceedingRect.right > rect.right || (preceedingRect.right === rect.right && preceedingRect.top < rect.top);
  }

  public getLayout(at: NodeNavigator | Chain): LayoutRect | undefined {
    const chain: Chain = at instanceof NodeNavigator ? at.chain : at;
    const tip = Chain.getTip(chain);
    let nodeWithProvider = tip.node;
    const isCodePoint = Node.isCodePoint(nodeWithProvider);

    if (isCodePoint) {
      const parent = Chain.getParentIfPossible(chain);
      if (!parent) {
        return undefined;
      }
      nodeWithProvider = parent.node;
    }

    const provider = this.nodeToProviderLookup(nodeWithProvider);
    if (!provider) {
      return undefined;
    }

    if (isCodePoint) {
      if (!tip.pathPart) {
        return undefined;
      }
      const cpIndex = PathPart.getIndex(tip.pathPart);
      const cp = provider.getCodePointLayout(cpIndex, cpIndex);
      if (cp) {
        return cp[0];
      }
      return undefined;
    } else {
      return provider.getLayout();
    }
  }
}