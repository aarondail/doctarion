import {
  Chain,
  EditorEvents,
  HorizontalAnchor,
  Node,
  NodeLayoutReporter as NodeLayoutReporterInterface,
  NodeNavigator,
  NodeUtils,
  Side,
} from "doctarion-document";
import memoizee from "memoizee/weak";

import { NodeLayoutProvider } from "./nodeLayoutProvider";
import { NodeLayoutProviderRegistry } from "./nodeLayoutProviderRegistry";
import { NodeTextLayoutAnalyzer } from "./nodeTextLayoutAnalyzer";
import { areRectsOnSameLine, buildGraphemeToCodeUnitMap } from "./utils";

export interface NodeGraphemeInfo {
  readonly codeUnitCount: number;
  readonly graphemeCount: number;
  readonly graphemeToCodeUnitIndecies: number[];
}

export class NodeLayoutReporter implements NodeLayoutReporterInterface {
  private getNodeGraphemeInfo: ((node: Node) => NodeGraphemeInfo | null) &
    memoizee.Memoized<(node: Node) => NodeGraphemeInfo | null>;

  /**
   * This is cleared whenever a document update finishes.  So any analyzers
   * added to it have a very short lifetime and can expect that both the
   * document and HTML rendered for the document are constant.
   *
   * Note that if this was to be preserved over the course of document updates,
   * since Nodes are immutable, we'd probably want to index this by NodeId
   * rather than Node.
   */
  private temporaryNodeTextLayoutAnalyzers: Map<Node, NodeTextLayoutAnalyzer>;

  public constructor(private readonly registry: NodeLayoutProviderRegistry, private readonly events: EditorEvents) {
    // This weakly holds onto a reference to the node
    this.getNodeGraphemeInfo = memoizee((node: Node) => {
      if (NodeUtils.isTextContainer(node)) {
        const { map, codeUnitCount } = buildGraphemeToCodeUnitMap(node.text);
        return { codeUnitCount, graphemeCount: node.text.length, graphemeToCodeUnitIndecies: map };
      }
      return null;
    }, {});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.temporaryNodeTextLayoutAnalyzers = new Map();

    this.events.updateDone.addListener(this.clearPerUpdateCachedInfo);
  }

  public detectHorizontalDistanceFromTargetHorizontalAnchor(
    subject: NodeNavigator | Chain,
    subjectSide: Side,
    target: HorizontalAnchor
  ): { distance: number; estimatedSubjectSiblingsToTarget?: number } | undefined {
    let estimatedSubjectSiblingsToTarget = undefined;
    if (
      subject.parent?.node &&
      NodeUtils.isTextContainer(subject.parent.node) &&
      NodeUtils.isGrapheme(subject.tip.node)
    ) {
      const provider = this.getProvider(subject);
      const ta = provider && provider.node && this.getNodeTextAnalyzer(provider.node, provider);
      // Fast mode?
      if (ta) {
        estimatedSubjectSiblingsToTarget = ta.findGraphemeOnSameLineButAt(target, subject.tip.pathPart.index);
      }
    }

    const left = this.getLayout(subject);

    if (!left) {
      return undefined;
    }

    const leftSide = subjectSide === Side.Left ? left.left : left.right;

    const distance = target - leftSide;

    return { distance, estimatedSubjectSiblingsToTarget };
  }

  public detectLineWrapOrBreakBetweenNodes(
    preceeding: NodeNavigator | Chain,
    subsequent: NodeNavigator | Chain
  ): boolean | undefined {
    if (
      preceeding.parent?.node === subsequent.parent?.node &&
      NodeUtils.isGrapheme(preceeding.tip.node) &&
      NodeUtils.isGrapheme(subsequent.tip.node)
    ) {
      const provider = this.getProvider(preceeding);
      const ta = provider && provider.node && this.getNodeTextAnalyzer(provider.node, provider);
      // Fast mode?
      if (ta) {
        const leftIndex = preceeding.tip.pathPart.index;
        const rightIndex = subsequent.tip.pathPart.index;
        const lineWraps = ta.getAllGraphemeLineWraps();
        if (lineWraps) {
          // Note the line wraps indecies PRECEED a line wrap
          for (const index of lineWraps) {
            if (index >= leftIndex && index <= rightIndex) {
              return true;
            }
          }
          return false;
        }
      }
    }

    const left = this.getLayout(preceeding);
    const right = this.getLayout(subsequent);
    if (left && right) {
      return !areRectsOnSameLine(left, right);
    }
    return undefined;
  }

  public dispose(): void {
    this.events.updateDone.removeListener(this.clearPerUpdateCachedInfo);
  }

  public getTargetHorizontalAnchor(target: NodeNavigator | Chain, side: Side): HorizontalAnchor | undefined {
    const rect = this.getLayout(target);
    if (!rect) {
      return undefined;
    }
    return side === Side.Left ? rect.left : rect.right;
  }

  private clearPerUpdateCachedInfo = () => {
    this.temporaryNodeTextLayoutAnalyzers.clear();
  };

  private getLayout(at: NodeNavigator | Chain): ClientRect | undefined {
    const provider = this.getProvider(at);
    if (!provider || !provider.node) {
      return undefined;
    }

    const tip = at.tip;
    if (NodeUtils.isGrapheme(tip.node)) {
      if (!tip.pathPart) {
        return undefined;
      }
      const gIndex = tip.pathPart.index;
      const ta = this.getNodeTextAnalyzer(provider.node, provider);
      return ta?.getGraphemeRect(gIndex) || undefined;
    } else {
      return provider.getLayout();
    }
  }

  private getNodeTextAnalyzer(node: Node, provider: NodeLayoutProvider): NodeTextLayoutAnalyzer | null {
    let analyzer = this.temporaryNodeTextLayoutAnalyzers.get(node);
    if (!analyzer) {
      const info = this.getNodeGraphemeInfo(node);
      if (!info) {
        return null;
      }
      analyzer = new NodeTextLayoutAnalyzer(provider.getCodeUnitLayoutProvider(), info);
      this.temporaryNodeTextLayoutAnalyzers.set(node, analyzer);
    }
    return analyzer;
  }

  private getProvider(at: NodeNavigator | Chain): NodeLayoutProvider | undefined {
    const chain: Chain = at instanceof NodeNavigator ? at.chain : at;
    const tip = chain.tip;
    let nodeWithProvider = tip.node;
    const isGrapheme = NodeUtils.isGrapheme(nodeWithProvider);

    if (isGrapheme) {
      const parent = chain.parent;
      if (!parent) {
        return undefined;
      }
      nodeWithProvider = parent.node;
    }

    return this.registry.getProviderForNode(nodeWithProvider);
  }
}