/* eslint-disable @typescript-eslint/unbound-method */
import { Chain, NodeCategory, Path, PseudoNode, Range } from "../../src";
import { testDoc } from "../test-utils";

const testDoc1 = testDoc`
<h level=ONE> <s>H12</s> </h>
<p> <s>MM</s> <s></s> <s>NN</s> </p>
<p> </p>
<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> </p>
`;

test("getChainsCoveringRange", () => {
  const check = (s1: string, s2: string) => {
    const p = Path.parse;
    const f = (results: readonly Chain[]) => results.map((chain) => chain.path.toString());
    const r = new Range(p(s1), p(s2)).getChainsCoveringRange(testDoc1);
    if (r) {
      return f(r);
    }
    return undefined;
  };

  expect(check("0/0/0", "0/0/0")).toEqual(["0/0/0"]);
  expect(check("0/0/0", "0/0/1")).toEqual(["0/0/0", "0/0/1"]);
  expect(check("0/0/1", "0/0/2")).toEqual(["0/0/1", "0/0/2"]);
  expect(check("0/0/0", "0/0/2")).toEqual(["0"]);
  expect(check("0/0/2", "1/0/0")).toEqual(["0/0/2", "1/0/0"]);
  expect(check("0/0", "1/0/0")).toEqual(["0", "1/0/0"]);
  expect(check("1/0/0", "1/0/1")).toEqual(["1/0"]);
  expect(check("1/0", "1/1")).toEqual(["1/0", "1/1"]);
  expect(check("1/0", "1/2")).toEqual(["1"]);
  expect(check("0/0", "3/1/3")).toEqual(["0", "1", "2", "3/0", "3/1/0", "3/1/1", "3/1/2", "3/1/3"]);
  expect(check("0", "2")).toEqual(["0", "1", "2"]);
  expect(check("2", "3")).toEqual(["2", "3"]);
  expect(check("2", "3/1/3")).toEqual(["2", "3/0", "3/1/0", "3/1/1", "3/1/2", "3/1/3"]);
  expect(check("0", "3")).toEqual([""]);
  expect(check("0/0/0", "3/1/5")).toEqual([""]);
});

test("walk with filter", () => {
  const check = (s1: string, s2: string) => {
    const isBlock = (n: PseudoNode) => PseudoNode.isNode(n) && n.nodeType.category === NodeCategory.Block;
    const p = Path.parse;
    const f = (chain: Chain) => chain.path.toString();
    const r: string[] = [];
    new Range(p(s1), p(s2)).walk(testDoc1, (n) => r.push(f(n.chain)), isBlock, isBlock);
    return r;
  };

  expect(check("0", "1/0/0")).toEqual(["0", "1"]);
  expect(check("0/0", "1/0/0")).toEqual(["1"]);
  expect(check("1/0/0", "1/0/1")).toEqual([]);
  expect(check("1/0", "1/0")).toEqual([]);
  expect(check("1/0", "1/2")).toEqual([]);

  expect(check("0/0", "3/1/3")).toEqual(["1", "2", "3"]);
  expect(check("0", "3/1/3")).toEqual(["0", "1", "2", "3"]);
  expect(check("0", "3")).toEqual(["0", "1", "2", "3"]);
  expect(check("2", "3")).toEqual(["2", "3"]);
  expect(check("2", "3/1/3")).toEqual(["2", "3"]);
});

test("walkInlineGraphemeRanges", () => {
  const testDocForThisTest = testDoc`
<h level=ONE> <s>H12</s> </h>
<p> <s>MM</s> <s></s> <s>NN</s> </p>
<p> </p>
<p> <s>CC</s> <lnk url=g.com>GOOGLE</lnk> </p>
<p> <lnk url=g.com></lnk> <s>ABC</s> </p>
`;

  const check = (s1: string, s2: string) => {
    const p = Path.parse;
    const f = (inlineChain: Chain, facet: string | undefined, graphemeRangeInclusive: [number, number] | undefined) =>
      `${inlineChain.path.toString()}${
        graphemeRangeInclusive ? `::[${graphemeRangeInclusive[0]},${graphemeRangeInclusive[1]}]` : ""
      }`;
    const r: string[] = [];
    new Range(p(s1), p(s2)).walkInlineGraphemeRanges(testDocForThisTest, (a, b, c) => r.push(f(a, b, c)));
    return r;
  };

  expect(check("0", "1/0/0")).toMatchInlineSnapshot(`
    Array [
      "0/0::[0,2]",
      "1/0::[0,0]",
    ]
  `);
  expect(check("0/0", "1/0/0")).toMatchInlineSnapshot(`
    Array [
      "0/0::[0,2]",
      "1/0::[0,0]",
    ]
  `);
  expect(check("1/0/0", "1/0/1")).toMatchInlineSnapshot(`
    Array [
      "1/0::[0,1]",
    ]
  `);
  expect(check("1/0", "1/0")).toMatchInlineSnapshot(`Array []`);
  expect(check("1/0", "1/2")).toMatchInlineSnapshot(`
    Array [
      "1/0::[0,1]",
      "1/1",
    ]
  `);

  expect(check("0/0", "3/1/3")).toMatchInlineSnapshot(`
    Array [
      "0/0::[0,2]",
      "1/0::[0,1]",
      "1/1",
      "1/2::[0,1]",
      "3/0::[0,1]",
      "3/1::[0,3]",
    ]
  `);
  expect(check("0", "3/1/3")).toMatchInlineSnapshot(`
    Array [
      "0/0::[0,2]",
      "1/0::[0,1]",
      "1/1",
      "1/2::[0,1]",
      "3/0::[0,1]",
      "3/1::[0,3]",
    ]
  `);
  expect(check("0", "3")).toMatchInlineSnapshot(`
    Array [
      "0/0::[0,2]",
      "1/0::[0,1]",
      "1/1",
      "1/2::[0,1]",
    ]
  `);
  expect(check("2", "3")).toMatchInlineSnapshot(`Array []`);
  expect(check("2", "3/1/3")).toMatchInlineSnapshot(`
    Array [
      "3/0::[0,1]",
      "3/1::[0,3]",
    ]
  `);

  expect(check("2", "4/1/2")).toMatchInlineSnapshot(`
    Array [
      "3/0::[0,1]",
      "3/1::[0,5]",
      "4/0",
      "4/1::[0,2]",
    ]
  `);
});
