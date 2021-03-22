import lodash from "lodash";

import * as Models from "../models";

import { Chain, ChainLink, ChainLinkNotFirst } from "./chain";
import { Node, NodeHandlersForSwitch } from "./node";
import { Path, PathPart, PathString } from "./path";

/**
 * This class helps with navigating between nodes of a document. It does not
 * understand (text) cursor navigation which is more complicated than just
 * moving between code points. For that see the CursorNavigator class.
 *
 * The NodeNavigator maintains its own state, and methods on the class mutate
 * that state. That said, any data returned from the class won't be mutated by
 * future method calls (as the typescript type definitions say).
 *
 * For the DFS related methods in this class, see the image on this page to get
 * a clear idea of the order in which the DFS visits nodes:
 * https://en.wikipedia.org/wiki/Depth-first_search
 */
export class NodeNavigator {
  // Note this is mutable (can be changed) but the chain itself is immutable
  private currentChain: Chain;

  public constructor(public readonly document: Models.Document) {
    // The document is always at the root of the chain
    this.currentChain = [ChainLink.document(document)];
  }

  public get chain(): Chain {
    return this.currentChain;
  }

  public get tip(): ChainLink {
    return Chain.getTip(this.currentChain);
  }

  public get grandParent(): ChainLink | undefined {
    return this.currentChain[this.currentChain.length - 3];
  }

  public get parent(): ChainLink | undefined {
    return this.currentChain[this.currentChain.length - 2];
  }

  public get path(): Path {
    return Chain.getPath(this.currentChain);
  }

  public get nextSiblingNode(): Node | undefined {
    const result = Chain.getParentAndTipIfPossible(this.currentChain);
    if (!result) {
      return undefined;
    }
    const [parent, tip] = result;

    return navigateToSiblingHelpers.next(parent, tip.pathPart);
  }

  public get precedingSiblingNode(): Node | undefined {
    const result = Chain.getParentAndTipIfPossible(this.currentChain);
    if (!result) {
      return undefined;
    }
    const [parent, tip] = result;

    return navigateToSiblingHelpers.preceding(parent, tip.pathPart);
  }

  public get nextParentSiblingNode(): Node | undefined {
    const result = Chain.getGrandParentToTipIfPossible(this.currentChain);
    if (!result) {
      return undefined;
    }
    const [grandParent, parent] = result;

    return navigateToSiblingHelpers.next(grandParent, parent.pathPart);
  }

  public get precedingParentSiblingNode(): Node | undefined {
    const result = Chain.getGrandParentToTipIfPossible(this.currentChain);
    if (!result) {
      return undefined;
    }
    const [grandParent, parent] = result;

    return navigateToSiblingHelpers.preceding(grandParent, parent.pathPart);
  }

  public clone(): NodeNavigator {
    const navigator = new NodeNavigator(this.document);
    navigator.currentChain = this.currentChain;
    return navigator;
  }

  public cloneWithoutTip(): NodeNavigator {
    const navigator = new NodeNavigator(this.document);
    navigator.currentChain = Chain.dropTipIfPossible(this.currentChain) || this.currentChain;
    return navigator;
  }

  public hasNextSibling(): boolean {
    return this.nextSiblingNode !== undefined;
  }

  public hasPrecedingSibling(): boolean {
    return this.precedingSiblingNode !== undefined;
  }

  public isAtSamePositionAs(other: NodeNavigator): boolean {
    return Path.isEqual(this.path, other.path);
  }

  /**
   * This will do a DFS backwards from the end of the document.  It is
   * different than just doing forwards DFS because it will visit parents
   * before children during its traversal, just like the forwards DFS.
   *
   * The navigateReverseForwardsInDfs method can be used to exactly iterate the
   * forwards DFS in reverse.
   */
  public navigateBackwardsInDfs(options?: { readonly skipDescendants?: boolean }): boolean {
    // In some cases you want to skip navigating through any descendants of the
    // current node
    if (!options?.skipDescendants) {
      const children = Node.getChildren(this.tip.node);
      if (children?.length || 0 > 0) {
        return this.navigateToLastChild();
      }
    }

    const backup = this.currentChain;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.navigateToPrecedingSibling()) {
        return true;
      }

      if (!this.navigateToParent()) {
        this.currentChain = backup;
        return false;
      }
    }
  }

  public navigateForwardsInDfs(options?: { readonly skipDescendants?: boolean }): boolean {
    // In some cases you want to skip navigating through any descendants of the
    // current node
    if (!options?.skipDescendants) {
      const children = Node.getChildren(this.tip.node);
      if (children?.length || 0 > 0) {
        return this.navigateToFirstChild();
      }
    }

    const backup = this.currentChain;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.navigateToNextSibling()) {
        return true;
      }

      if (!this.navigateToParent()) {
        this.currentChain = backup;
        return false;
      }
    }
  }

  /**
   * This is slightly different than backwards as in backwards DFS will visit
   * parents before children just like the forwards DFS.  Reverse forwards will
   * visit children before parents, making it an exact reverse of the iteration
   * of the forwards DFS navigation.
   */
  public navigateReverseForwardsInDfs(): boolean {
    const backup = this.currentChain;
    if (this.navigateToPrecedingSibling()) {
      while (this.navigateToLastChild()) {
        // no-op?
      }
      return true;
    }

    if (this.navigateToParent()) {
      return true;
    }
    this.currentChain = backup;
    return false;
  }

  public navigateTo(path: PathString | Path): boolean {
    if (typeof path === "string") {
      return this.navigateTo(Path.parse(path));
    }

    const newChain = Chain.from(this.document, path);
    if (newChain) {
      this.currentChain = newChain;
      return true;
    }
    return false;
  }

  public navigateToChild(index: number): boolean {
    return this.navigateToChildPrime(Node.getChildren(this.tip.node), index);
  }

  public navigateToEndOfDfs(): boolean {
    // Jump to the document at the root
    this.navigateToStartOfDfs();

    while (this.navigateToLastChild()) {
      // Just keep going to the last child
    }
    return true;
  }

  public navigateToFirstChild(): boolean {
    return this.navigateToChildPrime(Node.getChildren(this.tip.node), 0);
  }

  public navigateToLastChild(): boolean {
    const children = Node.getChildren(this.tip.node);
    return this.navigateToChildPrime(children, (children?.length || 0) - 1);
  }

  /**
   * This navigates to a sibling after the current node, if there is one.
   * This will not jump to a different parent node.
   */
  public navigateToNextSibling(): boolean {
    const result = Chain.getParentAndTipIfPossible(this.currentChain);
    if (!result) {
      return false;
    }
    const [parent, tip] = result;

    const sibling = navigateToSiblingHelpers.nextLink(parent, tip.pathPart);
    if (sibling) {
      const newChain = Chain.replaceTipIfPossible(this.currentChain, sibling);
      if (newChain) {
        this.currentChain = newChain;
        return true;
      }
    }
    return false;
  }

  public navigateToParent(): boolean {
    // This won't ever drop the document link at the start of the chain
    const newChain = Chain.dropTipIfPossible(this.currentChain);
    if (newChain) {
      this.currentChain = newChain;
      return true;
    }
    return false;
  }

  /**
   * This navigates to a sibling before the current node, if there is one.
   * This will not jump to a different parent node.
   */
  public navigateToPrecedingSibling(): boolean {
    const result = Chain.getParentAndTipIfPossible(this.currentChain);
    if (!result) {
      return false;
    }
    const [parent, tip] = result;

    const sibling = navigateToSiblingHelpers.precedingLink(parent, tip.pathPart);
    if (sibling) {
      const newChain = Chain.replaceTipIfPossible(this.currentChain, sibling);
      if (newChain) {
        this.currentChain = newChain;
        return true;
      }
    }
    return false;
  }

  public navigateToRoot(): boolean {
    return this.navigateToStartOfDfs();
  }

  /**
   * This ALWAYS means navigating to the document at the root of the node
   * hierarchy.
   */
  public navigateToStartOfDfs(): boolean {
    while (this.navigateToParent()) {
      // Keep going up
    }
    return true;
  }

  private createLinkForChild(child: Node, index: number): ChainLinkNotFirst | undefined {
    const p = ChainLink;

    return Node.switch(child, {
      onDocument: () => undefined,
      onCodePoint: (cp: Models.CodePoint) => p.codePoint(cp, index),
      onHeaderBlock: (b: Models.HeaderBlock) => p.block(b, index),
      onParagraphBlock: (b: Models.ParagraphBlock) => p.block(b, index),
      onInlineText: (e: Models.InlineText) => p.content(e, index),
      onInlineUrlLink: (e: Models.InlineUrlLink) => p.content(e, index),
    });
  }

  private navigateToChildPrime(children: readonly Node[] | undefined, index: number): boolean {
    const child = children?.[index];
    if (child) {
      const link = this.createLinkForChild(child, index);
      // Link would only be undefined if someone the child was the document
      // which should obviously never happen
      if (!link) {
        return false;
      }
      this.currentChain = Chain.append(this.currentChain, link);
      return true;
    }
    return false;
  }
}

// The code below is flying beyond the type checking capabilites of typescript
// so we have to disable a bunch of rules we normally want on.

/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/ban-ts-comment */
const navigateToSiblingHelpers = (() => {
  const p = lodash.mapValues(ChainLink, (f) => (...args: any[]) =>
    args[0] === undefined ? undefined : (f as any)(...args)
  );

  const createConfigForBuildingLinks = (operand: number) =>
    ({
      // @ts-expect-error
      onDocument: (d, _, idx) => p.block(d.blocks[idx + operand], idx + operand),
      // @ts-expect-error
      onHeaderBlock: (b, _, idx) => p.content(b.content[idx + operand], idx + operand),
      // @ts-expect-error
      onParagraphBlock: (b, _, idx) => p.content(b.content[idx + operand], idx + operand),
      // @ts-expect-error
      onInlineText: (b, _, idx) => p.codePoint(b.text[idx + operand], idx + operand),
      // @ts-expect-error
      onInlineUrlLink: (b, _, idx) => p.codePoint(b.text[idx + operand], idx + operand),
    } as NodeHandlersForSwitch<ChainLinkNotFirst | undefined>);

  const createConfigJustFindingNode = (operand: number) =>
    ({
      // @ts-expect-error
      onDocument: (d, _, idx) => d.blocks[idx + operand],
      // @ts-expect-error
      onHeaderBlock: (b, _, idx) => b.content[idx + operand],
      // @ts-expect-error
      onParagraphBlock: (b, _, idx) => b.content[idx + operand],
      // @ts-expect-error
      onInlineText: (b, _, idx) => b.text[idx + operand],
      // @ts-expect-error
      onInlineUrlLink: (b, _, idx) => b.text[idx + operand],
    } as NodeHandlersForSwitch<Node | undefined>);

  const precedingConfigForLinks = createConfigForBuildingLinks(-1);
  const nextConfigForLinks = createConfigForBuildingLinks(1);
  const precedingConfigForFinding = createConfigJustFindingNode(-1);
  const nextConfigForFinding = createConfigJustFindingNode(1);

  const nodeOrLinkToNode = (a: Node | ChainLink): Node => {
    if ((a as any).node !== undefined) {
      return (a as any).node;
    }
    return a as Node;
  };

  const preceding = (parent: Node | ChainLink, childPath: PathPart): Node | undefined =>
    PathPart.resolve(nodeOrLinkToNode(parent), childPath, precedingConfigForFinding);

  const next = (parent: Node | ChainLink, childPath: PathPart): Node | undefined =>
    PathPart.resolve(nodeOrLinkToNode(parent), childPath, nextConfigForFinding);

  const precedingLink = (parent: Node | ChainLink, childPath: PathPart): ChainLinkNotFirst | undefined =>
    PathPart.resolve(nodeOrLinkToNode(parent), childPath, precedingConfigForLinks);

  const nextLink = (parent: Node | ChainLink, childPath: PathPart): ChainLinkNotFirst | undefined =>
    PathPart.resolve(nodeOrLinkToNode(parent), childPath, nextConfigForLinks);

  return { preceding, next, precedingLink, nextLink };
})();