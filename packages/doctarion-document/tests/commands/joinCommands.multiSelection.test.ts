import { Commands, CursorOrientation, FlowDirection, InteractorStatus, InteractorTargets, JoinType } from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument } from "../test-utils";

import { CommandsTestUtils } from "./commands.testUtils";

const { Before, On, After } = CursorOrientation;

describe("join blocks with selections and multiple interactors", () => {
  describe("backwards", () => {
    it("works when the selections overlap", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
      // selection 1
      editor.execute(
        Commands.addInteractor({
          at: { path: "0/0/4", orientation: Before },
          selectTo: { path: "3/2/0", orientation: Before },
          focused: true,
          name: "α",
        })
      );
      // selection 2
      editor.execute(
        Commands.addInteractor({
          at: { path: "2", orientation: On },
          selectTo: { path: "3/2/1", orientation: After },
          name: "β",
        })
      );
      // other interactor 1 (inactive)
      editor.execute(
        Commands.addInteractor({
          at: { path: "3/1/1", orientation: After },
          status: InteractorStatus.Inactive,
          name: "γ",
        })
      );
      // other interactor 2 (inactive)
      editor.execute(
        Commands.addInteractor({
          at: { path: "0/0/0", orientation: Before },
          selectTo: { path: "3/0/0", orientation: After },
          status: InteractorStatus.Inactive,
          name: "δ",
        })
      );

      editor.execute(
        Commands.joinInto({
          type: JoinType.Blocks,
          target: InteractorTargets.AllActive,
          direction: FlowDirection.Backward,
          allowNodeTypeCoercion: true,
        })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
        `"<h level=ONE> <s styles=13:+B,15:-B>Header1MMNNAABBCC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </h>"`
      );
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: α-MAIN AFTER (Span:d)0/0⁙3 intr: α 
        Anchor: α-SELECTION BEFORE (Span:D)0/2⁙0 intr: α 
        Anchor: β-MAIN AFTER (Span:B)0/0⁙14 intr: β 
        Anchor: β-SELECTION AFTER (Span:D)0/2⁙1 intr: β 
        Anchor: γ-MAIN AFTER (Link:O)0/1⁙1 intr: γ 
        Anchor: δ-MAIN BEFORE (Span:H)0/0⁙0 intr: δ 
        Anchor: δ-SELECTION AFTER (Span:C)0/0⁙15 intr: δ "
      `);
    });
  });

  describe("forwards", () => {
    it("works when the selections overlap", () => {
      const editor = CommandsTestUtils.getEditorForBasicDoc({ omitDefaultInteractor: true });
      // selection 1
      editor.execute(
        Commands.addInteractor({
          at: { path: "0/0/4", orientation: Before },
          selectTo: { path: "3/2/0", orientation: Before },
          focused: true,
          name: "α",
        })
      );
      // selection 2
      editor.execute(
        Commands.addInteractor({
          at: { path: "2", orientation: On },
          selectTo: { path: "3/2/1", orientation: After },
          name: "β",
        })
      );
      // other interactor 1 (inactive)
      editor.execute(
        Commands.addInteractor({
          at: { path: "3/1/1", orientation: After },
          status: InteractorStatus.Inactive,
          name: "γ",
        })
      );
      // other interactor 2 (inactive)
      editor.execute(
        Commands.addInteractor({
          at: { path: "0/0/0", orientation: Before },
          selectTo: { path: "3/0/0", orientation: After },
          status: InteractorStatus.Inactive,
          name: "δ",
        })
      );

      editor.execute(
        Commands.joinInto({
          type: JoinType.Blocks,
          target: InteractorTargets.AllActive,
          direction: FlowDirection.Forward,
          allowNodeTypeCoercion: true,
        })
      );

      expect(docToXmlish(editor.state.document)).toMatchInlineSnapshot(
        `"<p> <s styles=13:+B,15:-B>Header1MMNNAABBCC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"`
      );
      expect(dumpAnchorsFromWorkingDocument(editor.state)).toMatchInlineSnapshot(`
        "Anchor: α-MAIN AFTER (Span:d)0/0⁙3 intr: α 
        Anchor: α-SELECTION BEFORE (Span:D)0/2⁙0 intr: α 
        Anchor: β-MAIN AFTER (Span:B)0/0⁙14 intr: β 
        Anchor: β-SELECTION AFTER (Span:D)0/2⁙1 intr: β 
        Anchor: γ-MAIN AFTER (Link:O)0/1⁙1 intr: γ 
        Anchor: δ-MAIN BEFORE (Span:H)0/0⁙0 intr: δ 
        Anchor: δ-SELECTION AFTER (Span:C)0/0⁙15 intr: δ "
      `);
    });
  });
});
