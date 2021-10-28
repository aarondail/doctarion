import { Node, Span } from "../document-model-rd4";
import {
  CursorNavigator,
  CursorOrientation,
  NodeNavigator,
  PseudoNode,
  ReadonlyCursorNavigator,
} from "../traversal-rd4";
import { AnchorPullDirection } from "../working-document-rd4";

import { JoinType, join } from "./joinCommands";
import { Direction, TargetPayload } from "./payloads";
import { coreCommand } from "./types";
import { CommandUtils } from "./utils";

interface DeleteOptions {
  /**
   * By default when an interactor is positioned somewhere where the next node
   * to delete has a different parent node (e.g., the interactor is positioned
   * before the first grapheme in an `InlineText`), the deletion is a no-op. If
   * this is set to true, no deletion will happen but the interactor will be
   * moved to the next logical cursor position. Note that for cross InlineText
   * cases, `allowAdjacentInlineTextDeletion`  takes precedence over this.
   */
  readonly allowMovementInBoundaryCases: boolean;
  /**
   * In cases where the cursor is at the edge of a block, deletion can be made
   * to instead behave like a joining operation.
   */
  readonly allowJoiningBlocksInBoundaryCases: boolean;
  readonly direction: Direction;
}

export type DeletePayload = TargetPayload & Partial<DeleteOptions>;

export const deleteImplementation = coreCommand<DeletePayload>("delete", (state, services, payload) => {
  const options: DeleteOptions = {
    allowMovementInBoundaryCases: payload.allowMovementInBoundaryCases ?? false,
    allowJoiningBlocksInBoundaryCases: payload.allowJoiningBlocksInBoundaryCases ?? false,
    direction: payload.direction ?? Direction.Backward,
  };

  const targets = CommandUtils.selectTargets(state, payload.target);
  targets.reverse();
  for (const target of targets) {
    if (target.selectionRange) {
      state.deleteNodesInRange(
        target.selectionRange,
        target.isMainCursorFirst ? AnchorPullDirection.Backward : AnchorPullDirection.Forward
      );
      // Clear selection
      state.updateInteractor(target.interactor.id, { selectionAnchor: undefined });
    } else {
      const { interactor, mainAnchorNavigator } = target;

      const result = findNodeRelativeToCursorForDeletion(mainAnchorNavigator, options);
      if (result?.nodeToDelete) {
        // Individual node deletion
        state.deleteNodeAtPath(
          result.nodeToDelete.path,
          options.direction === Direction.Backward ? AnchorPullDirection.Backward : AnchorPullDirection.Forward
        );
      } else if (result?.justMoveTo) {
        // Just move the anchor/interactor
        state.updateInteractor(interactor.id, {
          mainAnchor: state.getAnchorParametersFromCursorNavigator(result.justMoveTo),
        });
      } else if (result?.joinInstead) {
        // Join instead of delete
        services.execute(
          join({ type: JoinType.Blocks, target: { interactorId: interactor.id }, direction: options.direction })
        );
      }
    }
  }
});

/**
 * This function identifies the proper node to delete based on the passed in
 * navigator, which comes from an interactor's `mainCursor`.
 *
 * Depending on the passed in `DeleteAtOptions` instead of a deletion sometimes
 * movement can occur. In this case a CursorNavigator representing the new
 * position for the interactor is returned.
 *
 * Also undefined can be returned, indicating there is nothing to delete and the
 * interactor does not need to be moved.
 */
function findNodeRelativeToCursorForDeletion(
  navigator: ReadonlyCursorNavigator,
  options: DeleteOptions
):
  | { readonly justMoveTo?: CursorNavigator; readonly nodeToDelete?: NodeNavigator; readonly joinInstead?: boolean }
  | undefined {
  const isBack = options.direction === Direction.Backward;
  const nodeToDelete = navigator.toNodeNavigator();
  const orientation = navigator.cursor.orientation;

  const currentNode = navigator.tip.node;
  if (PseudoNode.isGraphemeOrFancyGrapheme(currentNode)) {
    const parentAndTip = navigator.chain.getParentAndTipIfPossible();
    if (!parentAndTip) {
      return undefined;
    }
    const [parent, tip] = parentAndTip;

    if (!(parent.node as Node).nodeType.hasTextOrFancyTextChildren) {
      return undefined;
    }

    let index = tip.pathPart?.index || 0;
    if (isBack) {
      if (orientation === CursorOrientation.Before) {
        index--;
      }
    } else {
      if (orientation === CursorOrientation.After) {
        index++;
        nodeToDelete.navigateToNextSibling();
      }
    }

    // Are we at the edge of the text containing Node
    if ((isBack && index === -1) || (!isBack && index === (parent.node as Node).children?.length)) {
      const navPrime = navigator.clone();
      const parentHasPrecedingOrFollowingSibling =
        navPrime.navigateFreelyToParent() &&
        (isBack ? navPrime.navigateFreelyToPrecedingSibling() : navPrime.navigateFreelyToNextSibling());

      // In the code here, we just handle the case where we are deleting
      // backwards (or forwards) from one InlineText to another inside the
      // same block (e.g. ParagraphBlock)
      if (parent.node instanceof Span && parentHasPrecedingOrFollowingSibling && navPrime.tip.node instanceof Span) {
        isBack ? navPrime.navigateToLastDescendantCursorPosition() : navPrime.navigateToFirstDescendantCursorPosition();
        if (isBack && navPrime.cursor.orientation === CursorOrientation.Before) {
          navPrime.changeCursorOrientationFreely(CursorOrientation.After);
        } else if (!isBack && navPrime.cursor.orientation === CursorOrientation.After) {
          navPrime.changeCursorOrientationFreely(CursorOrientation.Before);
        }
        return findNodeRelativeToCursorForDeletion(navPrime, options);
      }

      // Joining logic should probably be added here in the future
      if (options.allowJoiningBlocksInBoundaryCases) {
        return { joinInstead: true };
      }

      // Fall through to movement logic (which sometimes but not always is
      // applied) below...
    } else {
      // TODO we should join spans too...
      if (parent.node instanceof Span && parent.node.children.length === 1) {
        // In this case we are about to remove the last character in an
        // inline text In this case, we prefer to delete the inline text.
        const navPrime = navigator.toNodeNavigator();
        navPrime.navigateToParent();
        return { nodeToDelete: navPrime };
      } else {
        // In this case, the nodeToDelete is already on the right node
        return { nodeToDelete };
      }
    }
  } else if (orientation === CursorOrientation.On) {
    return { nodeToDelete };
  }

  // Non-deletion potential movement logic
  if (options.allowMovementInBoundaryCases) {
    const navPrime = navigator.clone();
    isBack ? navPrime.navigateToPrecedingCursorPosition() : navPrime.navigateToNextCursorPosition();
    return { justMoveTo: navPrime };
  }
  return undefined;
}
