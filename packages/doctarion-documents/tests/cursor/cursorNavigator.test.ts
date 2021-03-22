import { CursorAffinity } from "../../src/cursor/cursor";
import { CursorNavigator } from "../../src/cursor/cursorNavigator";
import * as Models from "../../src/models";
import { debugCursorNavigator, debugPath, doc, header, inlineText, inlineUrlLink, paragraph } from "../utils";

const testDoc1 = doc(
  header(Models.HeaderLevel.One, inlineText("Header1")),
  paragraph(inlineText("Here is some text"), inlineText("MORE"), inlineText("last")),
  paragraph(inlineText("Paragraph 2"), inlineUrlLink("http://google.com", "GOOG"), inlineText("final sentence"))
);

// Has empty insertion points
const testDoc2 = doc(
  paragraph(),
  paragraph(inlineText("A"), inlineText(""), inlineText("B")),
  header(Models.HeaderLevel.One),
  paragraph(inlineText("C"))
);

// Has between insertion points
const testDoc3 = doc(
  paragraph(inlineUrlLink("g.com", ""), inlineUrlLink("h.com", "abc"), inlineUrlLink("i.com", "d")),
  paragraph(inlineText("A"), inlineUrlLink("j.com", "B"), inlineText("C")),
  paragraph(inlineText("D"))
);

const coreInlineToInlineScenariosForNext = [
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
  ["C,C", "0<,00<,00>,0>,10<,10>,1>"],
  ["D,A", "0<,0N,10<,10>"],
  ["A,D", "00<,00>,1N,1>"],
  ["D,B", "0<,0N,1N"],
  ["B,D", "0N,1N,1>"],
  ["D,C", "0<,0N,0>,10<,10>,1>"],
  ["C,D", "0<,00<,00>,0>,1N,1>"],
  ["D,D", "0<,0N,0>,1N,1>"],
];

const coreInlineToInlineScenariosForPreceding = coreInlineToInlineScenariosForNext.map(([desc, excp]) => [
  desc,
  excp.split(",").reverse().join(","),
]);

const TestHelpers = {
  parseConciseDescription(d: string) {
    return d.split(",").map((c) => {
      if (c === "A") {
        return inlineText("A");
      } else if (c === "B") {
        return inlineText("");
      } else if (c === "C") {
        return inlineUrlLink("c.com", "C");
      } else if (c === "D") {
        return inlineUrlLink("d.com", "");
      } else {
        throw new Error("Bad concise test description");
      }
    });
  },

  parseConciseExpectation(s: string) {
    return s.split(",").map((s2) => {
      let r = "";
      let affinity = "";
      if (s2.length === 3) {
        const [contentIndex, cpIndex] = s2;
        affinity = s2[2];
        r = `block:0/content:${contentIndex}/cp:${cpIndex}`;
      } else if (s2.length === 2) {
        const contentIndex = s2[0];
        affinity = s2[1];
        r = `block:0/content:${contentIndex}`;
      }
      if (affinity === "<") {
        return "<| " + r;
      } else if (affinity === ">") {
        return r + " |>";
      } else {
        return r;
      }
    });
  },
};

describe("navigateTo", () => {
  it("navigates to code points in a fleshed out doc", () => {
    const nav = new CursorNavigator(testDoc1);
    nav.navigateTo("block:1/content:1/cp:2", CursorAffinity.After);
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1/cp:2 |>");
    expect(nav.tip.node).toEqual("R");

    nav.navigateTo("block:0/content:0/cp:0", CursorAffinity.Before);
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:0/cp:0");
    expect(nav.tip.node).toEqual("H");

    nav.navigateTo("block:2/content:2/cp:0", CursorAffinity.Before);
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:2/cp:0");
    expect(nav.tip.node).toEqual("f");

    nav.navigateTo("block:2/content:2/cp:13", CursorAffinity.After);
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:2/cp:13 |>");
    expect(nav.tip.node).toEqual("e");

    // Note that affinity is not honored in some cases
    nav.navigateTo("block:2/content:2/cp:0", CursorAffinity.Before);
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:2/cp:0");
    expect(nav.tip.node).toEqual("f");

    const nav2 = new CursorNavigator(doc(paragraph(inlineText("A"), inlineUrlLink("a.com", ""), inlineText("B"))));
    nav2.navigateTo("block:0/content:2/cp:0", CursorAffinity.Before);
    expect(nav2.tip.node).toEqual("B");
  });

  it("navigates to code points and changes affinity in some cases", () => {
    const nav = new CursorNavigator(testDoc1);
    expect(nav.navigateTo("block:2/content:2/cp:3", CursorAffinity.Before)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:2/cp:2 |>");
    expect(nav.tip.node).toEqual("n");

    expect(nav.navigateTo("block:1/content:1/cp:0", CursorAffinity.Before)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:16 |>");
    expect(nav.tip.node).toEqual("t");
  });

  it("navigates to empty insertion points", () => {
    const nav = new CursorNavigator(testDoc2);
    expect(nav.navigateTo("block:0", CursorAffinity.Neutral)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:0");

    expect(nav.navigateTo("block:1/content:1", CursorAffinity.Neutral)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1");

    expect(nav.navigateTo("block:2", CursorAffinity.Neutral)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:2");
  });

  it("navigates to between insertion points", () => {
    const nav = new CursorNavigator(testDoc3);

    expect(nav.navigateTo("block:0/content:0", CursorAffinity.Before)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:0");
    expect(nav.navigateTo("block:0/content:0", CursorAffinity.After)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0 |>");
    expect(nav.navigateTo("block:0/content:1", CursorAffinity.Before)).toBeTruthy();
    // Note the change because the navigator prefers after affinity to before affinity
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0 |>");
    expect(nav.navigateTo("block:0/content:2", CursorAffinity.Before)).toBeTruthy();
    // Note the change because the navigator prefers after affinity to before affinity
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:1 |>");
    expect(nav.navigateTo("block:0/content:2", CursorAffinity.After)).toBeTruthy();
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:2 |>");
  });

  it("autocorrects navigation in some cases", () => {
    const nav = new CursorNavigator(doc(paragraph(inlineText("ASD"), inlineUrlLink("g.com", ""))));
    nav.navigateTo("block:0/content:1", CursorAffinity.Before);
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0/cp:2 |>");
  });
});

describe("navigateToNextCursorPosition", () => {
  const nextPrime = (nav: CursorNavigator, n: number) => {
    for (let i = 0; i < n; i++) {
      expect(nav.navigateToNextCursorPosition()).toBe(true);
    }
  };

  describe("goes through core inline to inline scenarios", () => {
    it.each(coreInlineToInlineScenariosForNext)("%p", (input, output) => {
      const nav = new CursorNavigator(doc(paragraph(...TestHelpers.parseConciseDescription(input))));

      const paths = [];
      let i = 10;
      while (nav.navigateToNextCursorPosition()) {
        paths.push(debugCursorNavigator(nav));
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }
      expect(paths).toEqual(TestHelpers.parseConciseExpectation(output));
    });
  });

  it("should navigate through code points", () => {
    const nav = new CursorNavigator(testDoc1);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:0/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual("e");
    next(5);
    expect(nav.tip.node).toEqual("1");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:0/cp:0");
    expect(nav.tip.node).toEqual("H");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:0 |>");
    expect(nav.tip.node).toEqual("H");
    next(16);
    expect(nav.tip.node).toEqual("t");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:16 |>");
    next(1);
    expect(nav.tip.node).toEqual("M");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1/cp:0 |>");
    next(4);
    expect(nav.tip.node).toEqual("l");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:2/cp:0 |>");
    next(4);
    expect(nav.tip.node).toEqual("P");
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:0/cp:0");
    next(11);
    expect(nav.tip.node).toEqual("2");
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:0/cp:10 |>");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:1/cp:0");
    expect(nav.tip.node).toEqual("G");
    next(1);
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:1/cp:0 |>");
    expect(nav.tip.node).toEqual("G");
    next(3);
    expect(nav.tip.node).toEqual("G");
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:1/cp:3 |>");
    next(1);
    expect(nav.tip.node).toEqual("f");
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:2/cp:0");
    next(14);
    expect(nav.tip.node).toEqual("e");
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:2/cp:13 |>");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through empty insertion points", () => {
    const nav = new CursorNavigator(testDoc2);
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual(paragraph()); // of final sentence
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:0/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineText(""));
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:2/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:2/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual(header(Models.HeaderLevel.One));
    expect(debugCursorNavigator(nav)).toEqual("block:2");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("<| block:3/content:0/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("block:3/content:0/cp:0 |>");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });

  it("should navigate through between insertion points", () => {
    const nav = new CursorNavigator(testDoc3);
    // TODO deal with naviginat thorugh empty inline url link at start of firs tblock
    const next = nextPrime.bind(undefined, nav);
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", ""));
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:0");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", ""));
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("g.com", ""));
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0 |>");
    next(1);
    expect(nav.tip.node).toEqual("a");
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:1/cp:0");
    next(3);
    expect(nav.tip.node).toEqual("c");
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:1/cp:2 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("h.com", "abc"));
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:1 |>");
    next(1);
    expect(nav.tip.node).toEqual("d");
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:2/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("d");
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:2/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual(inlineUrlLink("i.com", "d"));
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:0/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:1/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:2/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("C");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:2/cp:0 |>");
    next(1);
    expect(nav.tip.node).toEqual("D");
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:0/cp:0");
    next(1);
    expect(nav.tip.node).toEqual("D");
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:0/cp:0 |>");

    expect(nav.navigateToNextCursorPosition()).toBeFalsy();
  });
});

describe("navigateToPrecedingCursorPosition", () => {
  const backPrime = (nav: CursorNavigator, n: number) => {
    for (let i = 0; i < n; i++) {
      expect(nav.navigateToPrecedingCursorPosition()).toBe(true);
    }
  };

  describe("goes through core inline to inline scenarios", () => {
    it.each(coreInlineToInlineScenariosForPreceding)("%p", (input, output) => {
      const nav = new CursorNavigator(doc(paragraph(...TestHelpers.parseConciseDescription(input))));

      let i = 20;
      while (nav.navigateToNextCursorPosition()) {
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }

      const paths = [];
      paths.push(debugCursorNavigator(nav));

      while (nav.navigateToPrecedingCursorPosition()) {
        if (nav.parent === undefined) {
          break;
        }
        paths.push(debugCursorNavigator(nav));
        i--;
        if (i === 0) {
          throw new Error("looks like an infinite loop");
        }
      }
      expect(paths).toEqual(TestHelpers.parseConciseExpectation(output));
    });
  });

  it("should navigate through code points", () => {
    const nav = new CursorNavigator(testDoc1);
    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("block:2/content:2/cp:1", CursorAffinity.After);
    expect(nav.tip.node).toEqual("i"); // of final sentence
    back(1);
    // Note this flips affinity intentionally as we always prefer after
    // affinity when possible
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:2/cp:0 |>");
    expect(nav.tip.node).toEqual("f");
    back(2);
    expect(nav.tip.node).toEqual("G"); // GOOG
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:1/cp:3 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:1/cp:2 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:1/cp:1 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:1/cp:0 |>");
    expect(nav.tip.node).toEqual("G");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:2/content:1/cp:0");
    expect(nav.tip.node).toEqual("G");
    back(1);
    expect(nav.tip.node).toEqual("2"); // Here is some text
    back(10);
    expect(nav.tip.node).toEqual("P");
    expect(debugCursorNavigator(nav)).toEqual("block:2/content:0/cp:0 |>");
    back(2);
    expect(nav.tip.node).toEqual("t");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:2/cp:3 |>");
    back(4);
    expect(nav.tip.node).toEqual("E");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1/cp:3 |>");
    back(4);
    expect(nav.tip.node).toEqual("t");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:16 |>");
    back(1);
    expect(nav.tip.node).toEqual("x");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:15 |>");
    back(14);
    expect(nav.tip.node).toEqual("e");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:1 |>");
    back(1);
    expect(nav.tip.node).toEqual("H"); // Here is some text
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:0 |>");
    back(1);
    expect(nav.tip.node).toEqual("H"); // Here is some text
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:0/cp:0");
    back(1);
    expect(nav.tip.node).toEqual("1"); // Header1
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0/cp:6 |>");
    back(6);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0/cp:0 |>");
    back(1);
    expect(nav.tip.node).toEqual("H");
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:0/cp:0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through empty insertion points", () => {
    const nav = new CursorNavigator(testDoc2);

    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("block:3/content:0/cp:0", CursorAffinity.Before);
    expect(nav.tip.node).toEqual("C"); // of final sentence
    back(1);
    expect(nav.tip.node).toEqual(header(Models.HeaderLevel.One));
    expect(debugCursorNavigator(nav)).toEqual("block:2");
    back(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:2/cp:0 |>");
    back(1);
    expect(nav.tip.node).toEqual("B");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:2/cp:0");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1");
    expect(nav.tip.node).toEqual(inlineText(""));
    back(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:0 |>");
    back(1);
    expect(nav.tip.node).toEqual("A");
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:0/cp:0");
    back(1);
    expect(nav.tip.node).toEqual(paragraph()); // Here is some text
    expect(debugCursorNavigator(nav)).toEqual("block:0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });

  it("should navigate through between insertion points", () => {
    const nav = new CursorNavigator(testDoc3);
    const back = backPrime.bind(undefined, nav);
    nav.navigateTo("block:2/content:0/cp:0", CursorAffinity.Before);
    expect(nav.tip.node).toEqual("D"); // of final sentence
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:2/cp:0 |>");
    expect(nav.tip.node).toEqual("C");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:2/cp:0");
    expect(nav.tip.node).toEqual("C");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:1/cp:0 |>");
    expect(nav.tip.node).toEqual("B");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:1/cp:0");
    expect(nav.tip.node).toEqual("B");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:1/content:0/cp:0 |>");
    expect(nav.tip.node).toEqual("A");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:1/content:0/cp:0");
    expect(nav.tip.node).toEqual("A");
    back(1);
    // An in-between (at end) insertion point
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:2 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:2/cp:0 |>");
    expect(nav.tip.node).toEqual("d");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:2/cp:0");
    expect(nav.tip.node).toEqual("d");
    back(1);

    // An in-between insertion point
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:1 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:1/cp:2 |>");
    expect(nav.tip.node).toEqual("c");
    back(3);
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:1/cp:0");
    expect(nav.tip.node).toEqual("a");
    back(1);
    // An in-between insertion point
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0 |>");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0");
    back(1);
    expect(debugCursorNavigator(nav)).toEqual("<| block:0/content:0");

    expect(nav.navigateToPrecedingCursorPosition()).toBeFalsy();
  });
});

describe("navigateToLastDescendantCursorPosition", () => {
  it("should handle empty insertion points", () => {
    const nav = new CursorNavigator(doc(paragraph(inlineText(""))));
    nav.navigateToUnchecked("block:0/content:0", CursorAffinity.After);
    nav.navigateToLastDescendantCursorPosition();
    expect(debugCursorNavigator(nav)).toEqual("block:0/content:0");
  });
});