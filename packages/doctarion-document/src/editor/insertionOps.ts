import * as immer from "immer";

import { NodeNavigator } from "../basic-traversal";
import { CursorNavigator, CursorOrientation } from "../cursor";
import { Document, InlineContainingNode, InlineText, InlineUrlLink, NodeUtils, ParagraphBlock, Text } from "../models";

import { delete_ } from "./deletionOps";
import { createCoreOperation } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import { getCursorNavigatorAndValidate, ifLet } from "./utils";

const castDraft = immer.castDraft;

export const insertText = createCoreOperation<string | Text>("insert/text", (state, services, payload): void => {
  const graphemes = typeof payload === "string" ? Text.fromString(payload) : payload;

  if (state.getAllInteractors()[0].isSelection) {
    services.execute(state, delete_({ target: { interactorId: state.getAllInteractors()[0].id } }));
  }

  let nav = getCursorNavigatorAndValidate(state, services, 0);
  const node = castDraft(nav.tip.node);

  if (NodeUtils.isGrapheme(node)) {
    ifLet(nav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
      if (!NodeUtils.isTextContainer(parent.node)) {
        throw new Error("Found a grapheme whole parent that apparently does not have text which should be impossible");
      }

      const offset = nav.cursor.orientation === CursorOrientation.Before ? 0 : 1;

      castDraft(parent.node.text).splice(tip.pathPart.index + offset, 0, ...graphemes);
      for (let i = 0; i < graphemes.length; i++) {
        nav.navigateToNextCursorPosition();
      }

      state.updateInteractor(state.getAllInteractors()[0].id, {
        to: services.interactors.cursorNavigatorToAnchorPosition(nav),
        selectTo: undefined,
        lineMovementHorizontalVisualPosition: undefined,
      });
    });
  } else if (NodeUtils.getChildren(node)?.length === 0) {
    if (NodeUtils.isTextContainer(node)) {
      castDraft(node.text).push(...graphemes);
      nav.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      state.updateInteractor(state.getAllInteractors()[0].id, {
        to: services.interactors.cursorNavigatorToAnchorPosition(nav),
      });
    } else if (NodeUtils.isInlineContainer(node)) {
      const newInline = new InlineText(graphemes);
      castDraft(node.children).push(castDraft(newInline));
      state.processNodeCreated(newInline, node);
      nav.navigateToLastDescendantCursorPosition(); // Move into the InlineContent
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      state.updateInteractor(state.getAllInteractors()[0].id, {
        to: services.interactors.cursorNavigatorToAnchorPosition(nav),
      });
    } else if (node instanceof Document) {
      const newInline = new InlineText(graphemes);
      const newParagraph = new ParagraphBlock(newInline);
      state.processNodeCreated(newParagraph, node);
      state.processNodeCreated(newInline, newParagraph);
      castDraft(node.children).push(castDraft(newParagraph));
      nav.navigateToLastDescendantCursorPosition(); // Move to the last Grapheme
      state.updateInteractor(state.getAllInteractors()[0].id, {
        to: services.interactors.cursorNavigatorToAnchorPosition(nav),
        selectTo: undefined,
        lineMovementHorizontalVisualPosition: undefined,
      });
    } else {
      throw new Error("Cursor is on an empty insertion point where there is no way to insert text somehow");
    }
  } else if (nav.cursor.orientation === CursorOrientation.Before) {
    ifLet(nav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
      if (NodeUtils.isInlineContainer(parent.node)) {
        const newInline = new InlineText(graphemes);
        castDraft(parent.node.children).splice(tip.pathPart.index, 0, castDraft(newInline));
        state.processNodeCreated(newInline, parent.node);
        // refreshNavigator(nav);
        const oldNav = nav;
        nav = new CursorNavigator(state.document, services.layout);
        nav.navigateToUnchecked(oldNav.cursor);
        nav.navigateToLastDescendantCursorPosition();
        state.updateInteractor(state.getAllInteractors()[0].id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(nav),
          selectTo: undefined,
          lineMovementHorizontalVisualPosition: undefined,
        });
      } else {
        throw new Error("Cursor is on an in-between insertion point where there is no way to insert text somehow");
      }
    });
  } else if (nav.cursor.orientation === CursorOrientation.After) {
    ifLet(nav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
      if (NodeUtils.isInlineContainer(parent.node)) {
        const newInline = new InlineText(graphemes);
        castDraft(parent.node.children).splice(tip.pathPart.index + 1, 0, castDraft(newInline));
        state.processNodeCreated(newInline, parent.node);
        nav.navigateToNextSiblingLastDescendantCursorPosition();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        state.updateInteractor(state.getAllInteractors()[0].id, {
          to: services.interactors.cursorNavigatorToAnchorPosition(nav),
          selectTo: undefined,
          lineMovementHorizontalVisualPosition: undefined,
        });
      } else {
        throw new Error("Cursor is on an in-between insertion point where there is no way to insert text somehow");
      }
    });
  } else {
    throw new Error("Cursor is at a position where text cannot be inserted");
  }
});

export const insertUrlLink = createCoreOperation<InlineUrlLink>("insert/urlLink", (state, services, payload): void => {
  if (state.getAllInteractors()[0].isSelection) {
    services.execute(state, delete_({ target: { interactorId: state.getAllInteractors()[0].id } }));
  }
  state.updateInteractor(state.getAllInteractors()[0].id, {
    lineMovementHorizontalVisualPosition: undefined,
  });

  const startingNav = getCursorNavigatorAndValidate(state, services, 0);

  let destinationInsertIndex: number | undefined;
  let destinationBlock: InlineContainingNode | undefined;
  let destinationNavigator: NodeNavigator | undefined;

  if (NodeUtils.isGrapheme(startingNav.tip.node)) {
    ifLet(startingNav.chain.getGrandParentToTipIfPossible(), ([grandParent, parent, tip]) => {
      if (!NodeUtils.isTextContainer(parent.node) || !NodeUtils.isInlineContainer(grandParent.node)) {
        throw new Error(
          "Found grapheme outside of a parent that contains text or a grand parent that contains inline content."
        );
      }

      if (!(parent.node instanceof InlineText)) {
        throw new Error("Cannot insert a URL link inside a non Inline Text node.");
      }

      if (!tip.pathPart || !parent.pathPart) {
        throw new Error("Found a grapheme or inline text without a pathPart");
      }

      const index = tip.pathPart.index + (startingNav.cursor.orientation === CursorOrientation.Before ? 0 : 1);
      const shouldSplitText = index !== 0 && index < parent.node.text.length;
      if (shouldSplitText) {
        // Split the inline text node
        const [leftInlineText, rightInlineText] = parent.node.split(index);
        state.processNodeDeleted(parent.node);
        state.processNodeCreated(leftInlineText, grandParent.node);
        state.processNodeCreated(rightInlineText, grandParent.node);

        castDraft(grandParent.node.children).splice(
          parent.pathPart.index,
          1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...castDraft([leftInlineText, rightInlineText])
        );
      }

      destinationInsertIndex =
        parent.pathPart.index +
        (shouldSplitText ? 1 : startingNav.cursor.orientation === CursorOrientation.Before ? 0 : 1);
      destinationBlock = grandParent.node;
      destinationNavigator = startingNav.toNodeNavigator();
      destinationNavigator.navigateToParent();
      destinationNavigator.navigateToParent();
    });
  } else if (NodeUtils.getChildren(startingNav.tip.node)?.length === 0) {
    if (NodeUtils.isInlineContainer(startingNav.tip.node)) {
      destinationInsertIndex = 0;
      destinationBlock = startingNav.tip.node;
      destinationNavigator = startingNav.toNodeNavigator();
    } else if (startingNav.tip.node instanceof Document) {
      const p = new ParagraphBlock();
      state.processNodeCreated(p, state.document);
      castDraft(state.document.children).push(castDraft(p));
      destinationInsertIndex = 0;
      destinationBlock = p;
      destinationNavigator = startingNav.toNodeNavigator();
      destinationNavigator.navigateToChild(0);
    } else {
      throw new EditorOperationError(
        EditorOperationErrorCode.InvalidCursorPosition,
        "Must be inside a block that can contain inline URLs."
      );
    }
  } else if (
    startingNav.cursor.orientation === CursorOrientation.Before ||
    startingNav.cursor.orientation === CursorOrientation.After
  ) {
    ifLet(startingNav.chain.getParentAndTipIfPossible(), ([parent, tip]) => {
      if (NodeUtils.isInlineContainer(parent.node)) {
        destinationInsertIndex =
          tip.pathPart.index + (startingNav.cursor.orientation === CursorOrientation.Before ? 0 : 1);
        destinationBlock = parent.node;
        destinationNavigator = startingNav.toNodeNavigator();
        destinationNavigator.navigateToParent();
      } else {
        throw new EditorOperationError(
          EditorOperationErrorCode.InvalidCursorPosition,
          "Cannot insert inline url link in a between insertion point in a parent that cannot contain inlines."
        );
      }
    });
  }

  if (destinationBlock !== undefined && destinationInsertIndex !== undefined && destinationNavigator !== undefined) {
    // And insert url link
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    castDraft(destinationBlock.children).splice(destinationInsertIndex, 0, castDraft(payload));
    state.processNodeCreated(payload, destinationBlock);

    // Update the cursor
    destinationNavigator.navigateToChild(destinationInsertIndex);
    const updatedCursorNav = new CursorNavigator(state.document, services.layout);
    updatedCursorNav.navigateToUnchecked(destinationNavigator.path, CursorOrientation.Before);
    updatedCursorNav.navigateToLastDescendantCursorPosition();

    state.updateInteractor(state.getAllInteractors()[0].id, {
      to: services.interactors.cursorNavigatorToAnchorPosition(updatedCursorNav),
      selectTo: undefined,
      lineMovementHorizontalVisualPosition: undefined,
    });
  } else {
    throw new Error("Could not figure out how to insert url link");
  }
});
