import * as immer from "immer";

import { NodeNavigator, Path, PathString } from "../basic-traversal";
import { CursorNavigator, CursorOrientation } from "../cursor";
import { EditorOperationServices, EditorState } from "../editor";
import { Side } from "../layout-reporting";

import { createCoreCommonOperation } from "./coreOperations";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";

const castDraft = immer.castDraft;

export const moveBack = createCoreCommonOperation("cursor/moveBack", ({ state, navigator }): void => {
  if (navigator.navigateToPrecedingCursorPosition()) {
    state.cursor = castDraft(navigator.cursor);
  }
});

export const moveForward = createCoreCommonOperation("cursor/moveForward", ({ state, navigator }): void => {
  if (navigator.navigateToNextCursorPosition()) {
    state.cursor = castDraft(navigator.cursor);
  }
});

// TODO hint
export const moveVisualDown = createCoreCommonOperation(
  "cursor/moveVisualDown",
  ({ state, services, navigator }) => {
    moveVisualUpOrDownHelper(state, services, "DOWN", navigator);
  },
  { preserveCursorVisualLineMovementHorizontalAnchor: true }
);

// export function moveLineDown(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const moveVisualUp = createCoreCommonOperation(
  "cursor/moveVisualUp",
  ({ state, services, navigator }) => {
    moveVisualUpOrDownHelper(state, services, "UP", navigator);
  },
  { preserveCursorVisualLineMovementHorizontalAnchor: true }
);

// export function moveLineUp(state: immer.Draft<EditorState>): void {
//   const nav = getCursorNavigatorAndValidate(state);
//   if (nav.navigateToPrecedingCursorPosition()) {
//     state.cursor = castDraft(nav.cursor);
//     clearSelection(state);
//     resetCursorMovementHints(state);
//   }
// }

export const jumpTo = createCoreCommonOperation<{ path: PathString | Path; orientation: CursorOrientation }>(
  "cursor/jumpTo",
  ({ state, payload, navigator }) => {
    if (navigator.navigateTo(payload.path, payload.orientation)) {
      state.cursor = castDraft(navigator.cursor);
    } else {
      throw new EditorOperationError(EditorOperationErrorCode.InvalidArgument, "path is invalid");
    }
  }
);

// An alternative implementation of this might use:
// https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
// or
// https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint
function moveVisualUpOrDownHelper(
  state: immer.Draft<EditorState>,
  services: EditorOperationServices,
  direction: "UP" | "DOWN",
  currentNavigator: CursorNavigator
): void {
  if (!services.layout) {
    return;
  }
  const layout = services.layout;

  const startNavigator = currentNavigator.clone().toNodeNavigator();

  const targetAnchor =
    state.cursorVisualLineMovementHorizontalAnchor ??
    services.layout.getTargetHorizontalAnchor(
      startNavigator,
      currentNavigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left
    );
  if (targetAnchor === undefined) {
    return;
  }

  const advance = () =>
    direction === "DOWN"
      ? currentNavigator.navigateToNextCursorPosition()
      : currentNavigator.navigateToPrecedingCursorPosition();
  const retreat = () =>
    direction === "DOWN"
      ? currentNavigator.navigateToPrecedingCursorPosition()
      : currentNavigator.navigateToNextCursorPosition();
  const didLineWrap = (anchor: NodeNavigator) =>
    direction === "DOWN"
      ? layout.detectLineWrapOrBreakBetweenNodes(anchor, currentNavigator.toNodeNavigator())
      : layout.detectLineWrapOrBreakBetweenNodes(currentNavigator.toNodeNavigator(), anchor);

  let foundNewLine = false;
  while (advance()) {
    // TODO do something like what we are doing in the second loop to find the
    // EOL in terms of siblings from current or if there is NO EOL among the
    // siblings so we can skip ahead
    //
    // Also...  probably consider changing the way the doctarion-browser-utils
    // works so that it doesn't have to compute all the line breaks in a
    // InlineText to do its work

    // console.log("cursorOps:loop1:advance ", currentNavigator.tip.node, currentNavigator.tip.pathPart.index);
    if (didLineWrap(startNavigator)) {
      foundNewLine = true;
      break;
    }
  }
  // console.log("cursorOps:lopp1:done ", currentNavigator.tip.node, currentNavigator.tip.pathPart.index);

  if (!foundNewLine) {
    return;
  }

  // console.log("found new line", currentLayoutRect, nav.tip.node);
  // Now that we think we are on the next line...
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let distance = layout.detectHorizontalDistanceFromTargetHorizontalAnchor(
    currentNavigator.toNodeNavigator(),
    currentNavigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
    targetAnchor
  );

  if (!distance) {
    return;
  }

  // console.log(distance);
  if (distance.estimatedSubjectSiblingsToTarget) {
    currentNavigator.navigateToRelativeSibling(
      distance.estimatedSubjectSiblingsToTarget,
      distance.estimatedSubjectSiblingSideClosestToTarget === Side.Left
        ? CursorOrientation.Before
        : CursorOrientation.After
    );
  } else {
    const newLineStartNavigator = currentNavigator.toNodeNavigator();

    while (advance()) {
      // console.log("curos:loop2:advance");
      if (didLineWrap(newLineStartNavigator)) {
        // console.log("curos:loop2:line wrap detected");
        retreat();
        break;
      }

      const newDistance = layout.detectHorizontalDistanceFromTargetHorizontalAnchor(
        currentNavigator.toNodeNavigator(),
        currentNavigator.cursor.orientation === CursorOrientation.After ? Side.Right : Side.Left,
        targetAnchor
      );
      if (!newDistance) {
        // console.log("curos:loop2:dist null");
        retreat();
        break;
      }
      if (Math.abs(newDistance.distance) > Math.abs(distance.distance)) {
        // console.log("curos:loop2:dist ok");
        retreat();
        break;
      }
      if (newDistance.estimatedSubjectSiblingsToTarget) {
        currentNavigator.navigateToRelativeSibling(
          newDistance.estimatedSubjectSiblingsToTarget,
          newDistance.estimatedSubjectSiblingSideClosestToTarget === Side.Left
            ? CursorOrientation.Before
            : CursorOrientation.After
        );
        break;
      }

      distance = newDistance;
    }
  }

  state.cursor = castDraft(currentNavigator.cursor);
  if (state.cursorVisualLineMovementHorizontalAnchor === undefined) {
    state.cursorVisualLineMovementHorizontalAnchor = targetAnchor;
  }
}
