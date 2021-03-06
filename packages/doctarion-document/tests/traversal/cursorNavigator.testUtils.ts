/* eslint-disable jest/no-export */
import { DocumentNode } from "../../src";
import { testDoc } from "../test-utils";

export const CursorNavigatorTestUtils = {
  testDocs: {
    basicDoc: testDoc`
<h level=ONE> <s>Header1</s> </h>
<p> <s>Here is some text</s> <s>MORE</s> <s>last</s> </p>
<p> <s>Paragraph 2</s> <lnk url=g.com>GOOG</lnk> <s>final sentence</s> </p>
`,

    basicDocWithEmptyInsertionPoints: testDoc`
<p> </p>
<p> <s>A</s> <s></s> <s>B</s> </p>
<h level=ONE> </h>
<p> <s>C</s> </p>
`,

    basicDocWithBetweenInsertionPoints: testDoc`
<p> <lnk url=g.com></lnk> <lnk url=h.com>abc</lnk> <lnk url=i.com>d</lnk> </p>
<p> <s>A</s> <lnk url=j.com>B</lnk> <s>C</s> </p>
<p> <s>D</s> </p>
`,
  },

  coreScenariosForInlines: {
    forNext: [
      ["A", "00<,00>"],
      ["B", "0N"],
      ["C", "0<,00<,00>,0>"],
      ["D", "0<,0N,0>"],
      ["A,A", "00<,00>,10>"],
      ["A,B", "00<,00>,1N"],
      ["B,A", "0N,10<,10>"],
      ["B,B", "0N,1N"],
      ["C,A", "0<,00<,00>,10<,10>"],
      ["A,C", "00<,00>,10<,10>,1>"],
      ["C,B", "0<,00<,00>,1N"],
      ["B,C", "0N,10<,10>,1>"],
      ["C,C", "0<,00<,00>,0>,10<,10>,1>"], // Dont just flip cursor orientation between Links
      ["D,A", "0<,0N,10<,10>"],
      ["A,D", "00<,00>,1N,1>"],
      ["D,B", "0<,0N,1N"],
      ["B,D", "0N,1N,1>"],
      ["D,C", "0<,0N,0>,10<,10>,1>"],
      ["C,D", "0<,00<,00>,0>,1N,1>"], // Navigate ON empty Link after a regular one
      ["D,D", "0<,0N,0>,1N,1>"], // Navigate ON empty Link after an empty one
    ],

    get forPreceding(): any[] {
      return CursorNavigatorTestUtils.coreScenariosForInlines.forNext.map(([desc, expectation]) => [
        desc,
        expectation.split(",").reverse().join(","),
      ]);
    },

    parseConciseDescription(d: string): DocumentNode {
      const s = d
        .split(",")
        .map((c) => {
          if (c === "A") {
            return "<s>A</s>";
          } else if (c === "B") {
            return "<s></s>";
          } else if (c === "C") {
            return "<lnk url=c.com>C</lnk>";
          } else if (c === "D") {
            return "<lnk url=d.com></lnk>";
          } else {
            throw new Error("Bad concise test description");
          }
        })
        .join();
      return testDoc`<p> ${s} </p>`;
    },

    parseConciseExpectation(s: string): any[] {
      return s.split(",").map((s2) => {
        let r = "";
        let orientation = "";
        if (s2.length === 3) {
          const [contentIndex, cpIndex] = s2;
          orientation = s2[2];
          r = `0/${contentIndex}/${cpIndex}`;
        } else if (s2.length === 2) {
          const contentIndex = s2[0];
          orientation = s2[1];
          r = `0/${contentIndex}`;
        }
        if (orientation === "<") {
          return "BEFORE " + r;
        } else if (orientation === ">") {
          return "AFTER " + r;
        } else {
          return "ON " + r;
        }
      });
    },
  },
};
