import { CursorAffinity } from "../../src/cursor";
import { Editor, Ops } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { Neutral, After } = CursorAffinity;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugCurrentBlock = DebugEditorHelpers.debugCurrentBlock;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD")),
  header(HeaderLevel.One)
);

describe("deleteBackwards", () => {
  it("basically works", () => {
    const editor = new Editor({ document: testDoc1 });
    // Jump to L in the "GOOGLE" text of the url link
    // Note the cursor would be at: GOOG|LE
    editor.update(Ops.jumpTo("3/1/3", After));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/2 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOOLE"`);

    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/1 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GOLE"`);
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 3/1/0 |>
SLICE:  PARAGRAPH > URL_LINK g.com > "GLE"`);
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "LE"`);

    // This should be a no-op
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: <| 3/1/0
SLICE:  PARAGRAPH > URL_LINK g.com > "LE"`);
  });

  it("deletes through InlineText and removes empty InlineText", () => {
    const editor = new Editor({ document: testDoc1 });
    // Jumps here: G|OOGLE
    editor.update(Ops.jumpTo("1/3/1", After));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/3/0 |>
SLICE:  PARAGRAPH > TEXT {} > "A"`);

    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/2/1 |>
SLICE:  PARAGRAPH > TEXT {} > "NN"`);

    editor.update(Ops.deleteBackwards);
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {BOLD} > "BB"`);
  });

  it("from an empty inline text it works ok", () => {
    const editor = new Editor({ document: testDoc1 });

    editor.update(Ops.jumpTo("1/1", Neutral));
    expect(debugState(editor)).toEqual(`
CURSOR: 1/1
SLICE:  PARAGRAPH > TEXT {} > ""`);

    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/1 |>
SLICE:  PARAGRAPH > TEXT {} > "MM"`);

    // Note A was deleted
    expect(debugCurrentBlock(editor)).toEqual(`
PARAGRAPH > TEXT {} > "MM"
PARAGRAPH > TEXT {} > "NN"
PARAGRAPH > TEXT {} > "AA"
PARAGRAPH > TEXT {BOLD} > "BB"`);
  });

  it("will delete empty paragraph block for cursor with before affinity", () => {
    const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph());
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("1", After));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });

  it("will delete empty paragraph block after empty inline text", () => {
    const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("")));
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("1/0", Neutral));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });

  it("will delete empty paragraph block after empty inline url link", () => {
    const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineUrlLink("g.com", "")));
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("1/0", Neutral));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1
SLICE:  PARAGRAPH`);

    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });

  it("will delete empty header block", () => {
    const d = doc(header(HeaderLevel.One, inlineText("H1")), header(HeaderLevel.Two));
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("1", Neutral));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 0/0/1 |>
SLICE:  HEADER ONE > TEXT {} > "H1"`);

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });

  it("will delete empty inline url link", () => {
    const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("ASD"), inlineUrlLink("g.com", "")));
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("1/1", Neutral));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });

  it("will delete empty inline text", () => {
    const d = doc(header(HeaderLevel.One, inlineText("H1")), paragraph(inlineText("ASD"), inlineText("")));
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("1/1", Neutral));
    editor.update(Ops.deleteBackwards);
    expect(debugState(editor)).toEqual(`
CURSOR: 1/0/2 |>
SLICE:  PARAGRAPH > TEXT {} > "ASD"`);

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });

  it("will not delete document", () => {
    const d = doc();
    const editor = new Editor({ document: d });
    editor.update(Ops.jumpTo("", Neutral));

    // Make sure there is nothing to the right
    editor.resetHistory();
    editor.update(Ops.moveForward);
    expect(editor.history).toHaveLength(0);
  });
});

// describe("deleteSelection", () => {
//   it("basically works", () => {
//     const editor = new Editor({ document : testDoc1 });
//     // Delete the OOG from GOOGLE
//     editor.update(Ops.select("3/1/1", "3/1/3"));
//     editor.update(Ops.deleteSelection);
//     expect(debugState(editor)).toEqual(`
// SELECTION: <| 3/1/0 -- 3/1/0
// ELEMENTS:
// 3/1/0`);
//     expect(debugCurrentBlock(editor)).toEqual(`
// PARAGRAPH > TEXT {} > "CC"
// PARAGRAPH > URL_LINK g.com > "GLE"
// PARAGRAPH > TEXT {} > "DD"`);
//   });
// });
