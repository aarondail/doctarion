import { CursorOrientation } from "../../src/cursor";
import { Editor, OPS } from "../../src/editor";
import { HeaderLevel } from "../../src/models";
import { DebugEditorHelpers, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const { After } = CursorOrientation;
const debugState = DebugEditorHelpers.debugEditorStateSimple;
const debugBlockSimple = DebugEditorHelpers.debugBlockSimple;

const testDoc1 = doc(
  header(HeaderLevel.One, inlineText("H1")),
  paragraph(inlineText("MM"), inlineText(""), inlineText("NN"), inlineText("AA"), inlineText("BB", { bold: true })),
  paragraph(),
  paragraph(inlineText("CC"), inlineUrlLink("g.com", "GOOGLE"), inlineText("DD"))
);

describe("delete selection", () => {
  it("basically works", () => {
    const editor = new Editor({ document: testDoc1 });
    editor.execute(OPS.jump({ to: { path: "0/0/0", orientation: After } }));
    editor.execute(OPS.jump({ to: { path: "3/1/2", orientation: After }, select: true }));
    editor.execute(OPS.deleteAt({}));
    expect(debugState(editor)).toMatchInlineSnapshot(`
      "
      CURSOR: <| 1/0/0
      SLICE:  PARAGRAPH > URL_LINK g.com > \\"GLE\\""
    `);
    expect(debugBlockSimple(editor.document, "1")).toMatchInlineSnapshot(`
      "
      PARAGRAPH > URL_LINK g.com > \\"GLE\\"
      PARAGRAPH > TEXT {} > \\"DD\\""
    `);
  });
});
