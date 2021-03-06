import {
  Anchor,
  AnchorOrientation,
  AnchorRange,
  Document,
  Floater,
  FloaterPlacement,
  Node,
  Sidebar,
  Span,
  Text,
  WorkingDocument,
} from "../../src";
import { docToXmlish, dumpAnchorsFromWorkingDocument, testDoc } from "../test-utils";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("construction", () => {
  it("basically works", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=6:+B>MMNNAABB</s> </p>
      <p> </p>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });

  it("properly creates anchors", () => {
    let doc = WorkingDocumentTestUtils.testDocs.basicDoc;
    doc = new Node(Document, doc.children, {
      annotations: [
        new Node(Floater, [new Node(Span, Text.fromString("test"), {})], {
          anchors: new AnchorRange(
            new Anchor(doc.children[1].children[0] as any, AnchorOrientation.Before, 2),
            new Anchor(doc.children[1].children[0] as any, AnchorOrientation.After, 4)
          ),
          placement: FloaterPlacement.Above,
        }),
      ],
      laterals: [
        new Node(Sidebar, [new Node(Span, Text.fromString("test2"), {})], {
          anchor: new Anchor(doc.children[3].children[2] as any, AnchorOrientation.On),
        }),
      ],
    });
    const wd = new WorkingDocument(doc);
    expect(dumpAnchorsFromWorkingDocument(wd)).toMatchInlineSnapshot(`
      "Anchor: ∅ BEFORE (Span:N)1/0⁙2 from: (Floater)annotations:0
      Anchor: ∅ AFTER (Span:A)1/0⁙4 from: (Floater)annotations:0
      Anchor: ∅ ON (Span)3/2 from: (Sidebar)laterals:0"
    `);
  });

  it("merges spans that can be merged (with anchors being respected)", () => {
    const docWithSpansThatShouldBeMerged = testDoc`
    <h level=ONE> <s>Header1</s> </h>
    <p> <s>AA</s> <s id=1>BB</s> <s>CC</s> </p>
    <floater anchor="AFTER 1/0⁙1" placement=ABOVE><s></s></floater>
    <floater anchor="AFTER 1/1⁙1" placement=ABOVE><s></s></floater>
    <floater anchor="BEFORE 1/2⁙0" placement=ABOVE><s></s></floater>
    <floater anchor="ON 1/2⁙1" placement=ABOVE><s></s></floater>
    `;
    const wd = new WorkingDocument(docWithSpansThatShouldBeMerged);
    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s>AABBCC</s> </p>"
    `);
    expect(dumpAnchorsFromWorkingDocument(wd)).toMatchInlineSnapshot(`
      "Anchor: ∅ AFTER (Span:A)1/0⁙1 from: (Floater)annotations:0
      Anchor: ∅ AFTER (Span:B)1/0⁙3 from: (Floater)annotations:1
      Anchor: ∅ BEFORE (Span:C)1/0⁙4 from: (Floater)annotations:2
      Anchor: ∅ ON (Span:C)1/0⁙5 from: (Floater)annotations:3"
    `);
  });
});
