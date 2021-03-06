/* eslint-disable @typescript-eslint/unbound-method */
import { Node, NodeCategory, NodeChildrenType, NodeType } from "../document-model";
import { FlowDirection, SimpleComparison } from "../shared-utils";
import {
  Chain,
  CursorNavigator,
  CursorOrientation,
  CursorPath,
  NodeNavigator,
  Path,
  PseudoNode,
  Range,
  ReadonlyCursorNavigator,
  ReadonlyNodeNavigator,
} from "../traversal";
import {
  AnchorParameters,
  InteractorId,
  InteractorStatus,
  ReadonlyWorkingInteractor,
  ReadonlyWorkingNode,
  WorkingDocument,
} from "../working-document";

import { CommandError } from "./error";
import { InteractorInputPosition, InteractorTargets, Target } from "./payloads";

export type SelectTargetsResult = {
  readonly interactor: ReadonlyWorkingInteractor;
  readonly mainAnchorCursor: CursorPath;
  readonly mainAnchorNavigator: CursorNavigator<ReadonlyWorkingNode>;
  readonly selectionAnchorCursor?: CursorPath;
  readonly selectionAnchorNavigator?: CursorNavigator<ReadonlyWorkingNode>;
  // This could be lazily calculated...
  readonly selectionRange?: Range;
  readonly isMainCursorFirst: boolean;
};

export enum SelectTargetsSort {
  Unsorted = "UNSORTED",
  Forward = "FORWARD",
  Reversed = "REVERSED",
}

export const CommandUtils = {
  /**
   * There definitely could be more situations in which we want to dedupe
   * interactors, but for right now we only dedupe interactors that aren't a
   * selection AND have the same status AND their mainCursor is equal.
   *
   * This must be called after the interactorOrdering has been sorted.
   */
  dedupeInteractors(state: WorkingDocument): InteractorId[] | undefined {
    const interactors = state.interactors;
    if (interactors.size < 2) {
      return;
    }

    // Try to remove any interactors that are exact matches for another
    // interactor, but only consider NON-selections. Its unclear at this
    // point what the best behavior for selections would be.
    let dupeIds: InteractorId[] | undefined;
    const seenKeys = new Set<string>();
    for (const [, i] of interactors) {
      if (i.selectionAnchor) {
        continue;
      }
      const key = `${i.mainAnchor.node.id}${i.mainAnchor.orientation}${i.mainAnchor.graphemeIndex || ""}${i.status}`;
      if (seenKeys.has(key)) {
        if (!dupeIds) {
          dupeIds = [];
        }
        dupeIds.push(i.id);
      }
      seenKeys.add(key);
    }

    if (dupeIds) {
      for (const id of dupeIds) {
        state.deleteInteractor(id);
      }
    }
    return dupeIds;
  },

  doesNodeTypeHaveBlockChildren(type: NodeType): boolean {
    return type.childrenType === NodeChildrenType.Blocks || type.childrenType === NodeChildrenType.BlocksAndSuperBlocks;
  },

  // This is a copy of a function from the working document utils... I am not
  // sure where it would be best to share the function so I am duplicating it
  // for now.
  doesNodeTypeHaveNodeChildren(type: NodeType): boolean {
    switch (type.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
      case NodeChildrenType.None:
        return false;
      default:
        return true;
    }
  },

  // This is a copy of a function from the working document utils... I am not
  // sure where it would be best to share the function so I am duplicating it
  // for now.
  doesNodeTypeHaveTextOrFancyText(type: NodeType): boolean {
    switch (type.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
        return true;
      default:
        return false;
    }
  },

  findAncestorNodeWithNavigator(
    startingNavigator: ReadonlyNodeNavigator<ReadonlyWorkingNode> | ReadonlyCursorNavigator<ReadonlyWorkingNode>,
    predicateOrNode: PseudoNode | ((node: PseudoNode) => boolean)
  ): { path: Path; node: ReadonlyWorkingNode } | undefined {
    const n: NodeNavigator<ReadonlyWorkingNode> =
      startingNavigator instanceof NodeNavigator
        ? startingNavigator.clone()
        : (startingNavigator as ReadonlyCursorNavigator<ReadonlyWorkingNode>).toNodeNavigator();

    if (typeof predicateOrNode === "function") {
      if (n.navigateToAncestorMatchingPredicate(predicateOrNode)) {
        // if (CommandUtils.isPseudoNodeABlock(n.tip.node)) {
        return { path: n.path, node: n.tip.node as ReadonlyWorkingNode };
      }
    } else {
      if (n.navigateToAncestor(predicateOrNode)) {
        // if (CommandUtils.isPseudoNodeABlock(n.tip.node)) {
        return { path: n.path, node: n.tip.node as ReadonlyWorkingNode };
      }
    }
    return undefined;
  },

  findAncestorBlockNodeWithNavigator(
    startingNavigator: ReadonlyNodeNavigator<ReadonlyWorkingNode> | ReadonlyCursorNavigator<ReadonlyWorkingNode>
  ): { path: Path; node: ReadonlyWorkingNode } | undefined {
    return this.findAncestorNodeWithNavigator(
      startingNavigator,
      (x) => PseudoNode.isNode(x) && x.nodeType.category === NodeCategory.Block
    );
  },

  findAncestorInlineNodeWithNavigator(
    startingNavigator: ReadonlyNodeNavigator<ReadonlyWorkingNode> | ReadonlyCursorNavigator<ReadonlyWorkingNode>
  ): { path: Path; node: ReadonlyWorkingNode } | undefined {
    return this.findAncestorNodeWithNavigator(
      startingNavigator,
      (x) => PseudoNode.isNode(x) && x.nodeType.category === NodeCategory.Inline
    );
  },

  getAnchorParametersFromInteractorInputPosition(
    state: WorkingDocument,
    position: InteractorInputPosition
  ): AnchorParameters {
    const n = new CursorNavigator(state.document);
    const cursor =
      position instanceof CursorPath
        ? position
        : new CursorPath(
            position.path instanceof Path ? position.path : Path.parse(position.path),
            position.orientation
          );
    if (!cursor || !n.navigateTo(cursor)) {
      throw new CommandError("Invalid InteractorInputPosition");
    }
    return state.getAnchorParametersFromCursorNavigator(n);
  },

  isCursorNavigatorAtEdgeOfBlock(
    navigator: ReadonlyCursorNavigator<ReadonlyWorkingNode>,
    direction: FlowDirection
  ): boolean {
    const block = CommandUtils.findAncestorBlockNodeWithNavigator(navigator);
    if (!block) {
      return false;
    }

    const n = navigator.clone();
    if (
      (direction === FlowDirection.Backward && !n.navigateToPrecedingCursorPosition()) ||
      (direction === FlowDirection.Forward && !n.navigateToNextCursorPosition())
    ) {
      return true;
    }

    const newBlockMaybe = CommandUtils.findAncestorBlockNodeWithNavigator(n);
    return block !== newBlockMaybe;
  },

  isCursorNavigatorAtEdgeOfContainingNode(
    navigator: ReadonlyCursorNavigator<ReadonlyWorkingNode>,
    containingNode: ReadonlyWorkingNode,
    direction: FlowDirection
  ): boolean {
    const firstFind = CommandUtils.findAncestorNodeWithNavigator(navigator, containingNode);
    if (!firstFind) {
      return false;
    }

    const n = navigator.clone();
    if (
      (direction === FlowDirection.Backward && !n.navigateToPrecedingCursorPosition()) ||
      (direction === FlowDirection.Forward && !n.navigateToNextCursorPosition())
    ) {
      return true;
    }
    const secondFind = CommandUtils.findAncestorNodeWithNavigator(n, containingNode);
    return firstFind.node !== secondFind?.node;
  },

  selectTargets(state: WorkingDocument, target: Target, sort: SelectTargetsSort): SelectTargetsResult[] {
    const results: SelectTargetsResult[] = getTargetedInteractors(target, state).map(
      (interactor: ReadonlyWorkingInteractor) => {
        const navigators = state.getCursorNavigatorsForInteractor(interactor);
        const mainAnchorCursor = navigators.mainAnchor.cursor;
        const selectionAnchorCursor = navigators.selectionAnchor ? navigators.selectionAnchor.cursor : undefined;
        const isMainCursorFirst = selectionAnchorCursor
          ? mainAnchorCursor.compareTo(selectionAnchorCursor) !== SimpleComparison.After
          : true;
        const selectionRange = navigators.selectionAnchor
          ? getRangeForSelection(
              isMainCursorFirst ? navigators.mainAnchor : navigators.selectionAnchor,
              isMainCursorFirst ? navigators.selectionAnchor : navigators.mainAnchor
            )
          : undefined;
        return {
          interactor,
          mainAnchorCursor,
          mainAnchorNavigator: navigators.mainAnchor,
          selectionAnchorCursor,
          selectionAnchorNavigator: navigators.selectionAnchor,
          selectionRange,
          isMainCursorFirst,
        };
      }
    );

    if (sort !== SelectTargetsSort.Unsorted && results.length > 1) {
      results.sort((left, right) => {
        const leftFirstCursor = left.isMainCursorFirst ? left.mainAnchorCursor : left.selectionAnchorCursor!;
        const rightFirstCursor = right.isMainCursorFirst ? right.mainAnchorCursor : right.selectionAnchorCursor!;
        const cmp = leftFirstCursor.compareTo(rightFirstCursor);
        switch (cmp) {
          case SimpleComparison.Before:
            return sort === SelectTargetsSort.Forward ? -1 : 1;
          case SimpleComparison.After:
            return sort === SelectTargetsSort.Forward ? 1 : -1;
          default:
            return 0;
        }
      });
    }
    return results;
  },

  walkBlocksInSelectionTarget(
    state: WorkingDocument,
    target: SelectTargetsResult,
    callback: (
      navigator: NodeNavigator<ReadonlyWorkingNode>,
      context: {
        readonly start: ReadonlyWorkingNode;
        readonly end: ReadonlyWorkingNode;
      }
    ) => void
  ): void {
    if (target.selectionAnchorNavigator === undefined) {
      return undefined;
    }

    const [startNav, endNav] = target.isMainCursorFirst
      ? [target.mainAnchorNavigator, target.selectionAnchorNavigator]
      : [target.selectionAnchorNavigator, target.mainAnchorNavigator];

    const start = CommandUtils.findAncestorBlockNodeWithNavigator(startNav);
    const end = CommandUtils.findAncestorBlockNodeWithNavigator(endNav);
    if (!start || !end) {
      return;
    }
    const context = { start: start.node, end: end.node };

    const pickThese = (x: PseudoNode) => x instanceof Node && x.nodeType.category === NodeCategory.Block;
    const ignoreThese = (x: PseudoNode) =>
      PseudoNode.isGrapheme(x) || (x as Node).nodeType.category === NodeCategory.Inline;

    new Range(start.path, end.path).walk<ReadonlyWorkingNode>(
      state.document,
      (n) => callback(n, context),
      pickThese,
      ignoreThese
    );
  },

  walkInlinesInSelectionTarget(
    state: WorkingDocument,
    target: SelectTargetsResult,
    callback: (
      navigator: NodeNavigator<ReadonlyWorkingNode>,
      context: {
        readonly start: ReadonlyWorkingNode;
        readonly end: ReadonlyWorkingNode;
      }
    ) => void
  ): void {
    if (target.selectionAnchorNavigator === undefined) {
      return undefined;
    }

    const [startNav, endNav] = target.isMainCursorFirst
      ? [target.mainAnchorNavigator, target.selectionAnchorNavigator]
      : [target.selectionAnchorNavigator, target.mainAnchorNavigator];

    const start = CommandUtils.findAncestorInlineNodeWithNavigator(startNav);
    const end = CommandUtils.findAncestorInlineNodeWithNavigator(endNav);
    if (!start || !end) {
      return;
    }
    const context = { start: start.node, end: end.node };

    const pickThese = (x: PseudoNode) => x instanceof Node && x.nodeType.category === NodeCategory.Inline;

    new Range(start.path, end.path).walk<ReadonlyWorkingNode>(
      state.document,
      (n) => callback(n, context),
      pickThese,
      PseudoNode.isGrapheme
    );
  },

  walkInlineGraphemeRangesInSelectionTarget(
    state: WorkingDocument,
    target: SelectTargetsResult,
    callback: (
      inlineNodeChain: Chain<ReadonlyWorkingNode>,
      /**
       * This is undefined if the grapheme range is in the children of the node.
       */
      facet: string | undefined,
      graphemeRangeInclusive: [number, number] | undefined
    ) => void
  ): void {
    if (target.selectionRange === undefined) {
      return undefined;
    }
    target.selectionRange.walkInlineGraphemeRanges<ReadonlyWorkingNode>(state.document, callback);
  },
};

function getTargetedInteractors(target: Target, state: WorkingDocument): readonly ReadonlyWorkingInteractor[] {
  const untypedIdentifier = target as any;

  if (target === undefined) {
    if (state.focusedInteractor) {
      return [state.focusedInteractor];
    }
  } else if (typeof target === "string") {
    switch (target) {
      case InteractorTargets.All:
        return Array.from(state.interactors.values());
      case InteractorTargets.AllActive:
        return Array.from(state.interactors.values()).filter((e) => e.status === InteractorStatus.Active);
      case InteractorTargets.Focused:
        if (state.focusedInteractor) {
          return [state.focusedInteractor];
        }
    }
  } else if (untypedIdentifier.interactorId !== undefined) {
    const interactor = state.interactors.get(untypedIdentifier.interactorId);
    if (!interactor) {
      return [];
    }
    return [interactor];
  } else if (untypedIdentifier.interactorIds !== undefined) {
    return Array.from(state.interactors.values()).filter((e) => untypedIdentifier.interactorIds.includes(e.id));
  }
  return [];
}

function getRangeForSelection(from: CursorNavigator, to: CursorNavigator): Range | undefined {
  let fromPath = from.path;
  if (from.cursor.orientation === CursorOrientation.After) {
    const n = from.toNodeNavigator();
    if (n.navigateForwardsByDfs()) {
      fromPath = n.path;
    }
  }

  let toPath = to.path;
  if (to.cursor.orientation === CursorOrientation.Before) {
    const n = to.toNodeNavigator();
    // This is almost doing a reverse forwards DFS but not quite because we can
    // land on a parent of the current (after) node which is not what we want
    if (n.navigateBackwardsByDfs()) {
      n.navigateToLastDescendant();
      toPath = n.path;
    }
  }

  return new Range(fromPath, toPath);
}
