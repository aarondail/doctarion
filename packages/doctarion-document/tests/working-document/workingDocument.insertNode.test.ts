import { Node, Span, Text, WorkingDocument } from "../../src";
import { docToXmlish } from "../test-utils";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("insertNode", () => {
  it("merges spans that can be merged", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);

    wd.insertNode(wd.getNodeAtPath("1"), new Node(Span, Text.fromString("xyz"), {}), 0);
    wd.insertNode(wd.getNodeAtPath("1"), new Node(Span, Text.fromString("zyx"), {}), 1);
    wd.insertNode(wd.getNodeAtPath("3"), new Node(Span, Text.fromString("zyx"), {}), 1);
    wd.insertNode(wd.getNodeAtPath("3"), new Node(Span, Text.fromString("xyz"), {}), 0);
    wd.insertNode(wd.getNodeAtPath("2"), new Node(Span, Text.fromString("xyz"), {}), 0);

    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<h level=ONE> <s>Header1</s> </h>
      <p> <s styles=9:+B,11:-B>xyzMMNNAABBzyx</s> </p>
      <p> <s>xyz</s> </p>
      <p> <s>xyzCCzyx</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });
});
