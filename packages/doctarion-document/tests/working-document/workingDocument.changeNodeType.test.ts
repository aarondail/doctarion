import { Header, HeaderLevel, Paragraph, WorkingDocument } from "../../src";
import { docToXmlish } from "../test-utils";

import { WorkingDocumentTestUtils } from "./workingDocument.testUtils";

describe("changeNodeType", () => {
  it("changes block types", () => {
    const wd = new WorkingDocument(WorkingDocumentTestUtils.testDocs.basicDoc);

    wd.changeNodeType(wd.getNodeAtPath("0"), Paragraph, {});
    wd.changeNodeType(wd.getNodeAtPath("1"), Header, { level: HeaderLevel.One });
    wd.changeNodeType(wd.getNodeAtPath("2"), Header, { level: HeaderLevel.Two });

    expect(docToXmlish(wd.document)).toMatchInlineSnapshot(`
      "<p> <s>Header1</s> </p>
      <h level=ONE> <s styles=6:+B>MMNNAABB</s> </h>
      <h level=TWO> </h>
      <p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> <s>DD</s> </p>"
    `);
  });
});
