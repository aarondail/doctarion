import * as htmlparser from "htmlparser2";

import {
  Anchor,
  Document,
  DocumentNode,
  FacetDictionary,
  Header,
  Hyperlink,
  Node,
  NodeChildrenType,
  NodeType,
  Paragraph,
  Span,
} from "../../src/document-model-rd5";
import { Mutable } from "../../src/miscUtils";
import { Text, TextStyleModifier, TextStyleStrip, TextStyleStripEntry } from "../../src/text-model-rd4";

/**
 * Create a test Document for the tests.
 *
 * This is so simple that it probably doesn't need to really be a tagged
 * template at this point.
 */
export function testDoc(literals: TemplateStringsArray, ...placeholders: string[]): DocumentNode {
  let result = "";

  // interleave the literals with the placeholders
  for (let i = 0; i < placeholders.length; i++) {
    result += literals[i];
    result += placeholders[i];
  }
  result += literals[literals.length - 1];
  return docFromXmlish(result);
}

const tagToNodeTypes: Record<string, NodeType> = {
  h: Header,
  p: Paragraph,
  s: Span,
  hyperlink: Hyperlink,
};

const nodeTypesToTag = new Map(Object.entries(tagToNodeTypes).map(([key, value]) => [value, key]));

function docFromXmlish(xmlish: string): DocumentNode {
  const rootKids: Node[] = [];
  const currentStack: { type: NodeType; facets: FacetDictionary; kids: Node[] }[] = [];
  const currentNode = (): { type: NodeType; facets: FacetDictionary; kids: Node[] } | undefined => {
    return currentStack.length > 0 ? currentStack[currentStack.length - 1] : undefined;
  };
  let currentNodeText: string | undefined = undefined;

  const parser = new htmlparser.Parser(
    {
      onopentag(name, attributes) {
        const type = tagToNodeTypes[name];
        if (!type) {
          throw new Error(`Could not find NodeType for tag '${name}'`);
        }
        currentStack.push({ type, facets: attributes, kids: [] });
        if (type.childrenType === NodeChildrenType.Text || type.childrenType === NodeChildrenType.FancyText) {
          currentNodeText = "";
        }
      },
      ontext(text) {
        const n = currentNode();
        if (
          n &&
          (n.type.childrenType === NodeChildrenType.Text || n.type.childrenType === NodeChildrenType.FancyText)
        ) {
          currentNodeText = (currentNodeText || "") + text;
        }
      },
      onclosetag(name) {
        const n = currentNode();
        if (n) {
          const type = tagToNodeTypes[name];
          if (!type) {
            throw new Error(`Could not find NodeType for tag '${name}'`);
          } else if (type !== n.type) {
            throw new Error(`Mismatched NodeType at closing tag ${name}`);
          }
          currentStack.pop();
          const kidsArray = currentNode()?.kids || rootKids;

          // Fill in default facets
          const f = n.facets as any;
          if (n.type === Span && f.styles) {
            f.styles = textStyleStripFromXmlish(f.styles);
          }

          kidsArray.push(
            new Node(n.type, currentNodeText !== undefined ? Text.fromString(currentNodeText) : n.kids, f)
          );
        }
        currentNodeText = undefined;
      },
    },
    { recognizeSelfClosing: true }
  );

  parser.parseComplete(xmlish);

  return new Node(Document, rootKids, { laterals: [], annotations: [] });
}

export function docToXmlish(doc: DocumentNode, { includeIds }: { includeIds?: boolean } = {}): string {
  const padAndAddNewline = (text: string, indentation: number) => {
    let s = "";
    for (let i = 0; i < indentation; i++) {
      s += " ";
    }
    s += text + "\n";
    return s;
  };

  const nodeToXmlPrime = (node: Node, indentation: number) => {
    let s = "";
    const tag = nodeTypesToTag.get(node.nodeType);
    if (!tag) {
      throw new Error(`Could not find tag for NodeType ${node.nodeType.name}`);
    }

    const attributes = node.facets as any;

    if (includeIds && (node as any).id) {
      attributes.id = (node as any).id;
    }

    let attributesString = "";
    if (Object.values(attributes).length > 0) {
      for (const key of Object.keys(attributes).sort()) {
        let value = attributes[key];
        if (value instanceof TextStyleStrip) {
          if (value.entries.length === 0) {
            continue;
          }
          value = textStyleStripToXmlish(value);
        }

        attributesString += ` ${key}=${value}`;
      }
    }

    const startTag = `<${tag}${attributesString}>`;
    if (
      node.nodeType.childrenType === NodeChildrenType.FancyText ||
      node.nodeType.childrenType === NodeChildrenType.Text
    ) {
      s += padAndAddNewline(`${startTag}${Text.toString(node.children as Text)}</${tag}>`, indentation);
    } else if (node.nodeType.childrenType === NodeChildrenType.Inlines) {
      let kidString = "";
      for (const k of node.children) {
        kidString += nodeToXmlPrime(k as any, 0);
      }
      kidString = kidString.split("\n").join(" ");
      s += padAndAddNewline(`${startTag} ${kidString}</${tag}>`, indentation);
    } else {
      s += padAndAddNewline(startTag, indentation);
      for (const k of node.children) {
        s += nodeToXmlPrime(k as any, indentation + 2);
      }
      s += padAndAddNewline(`</${tag}>`, indentation);
    }
    return s;
  };

  // Skip document
  return doc.children.map((x) => nodeToXmlPrime(x, 0)).join("");
}

function modifierStringToModifiers(s: string) {
  const m: Mutable<TextStyleModifier> = {};
  for (let i = 0; i < s.length; i += 2) {
    const change = s[i] === "+" ? true : null;
    const x = s[i + 1];
    switch (x) {
      case "B":
        m.bold = change;
        break;
      default:
        throw new Error(`Unknown TextStyleModifier ${x}`);
    }
  }
  return m;
}

function modifierStringFromModifiers(m: TextStyleModifier): string {
  let s = "";
  for (const k of Object.keys(m)) {
    if (k === "bold") {
      s += (m[k] === null ? "-" : "+") + "B";
    } else {
      throw new Error(`Unknown TextStyleModifier ${k}`);
    }
  }
  return s;
}

function textStyleStripFromXmlish(s: string): TextStyleStrip {
  const entries: TextStyleStripEntry[] = [];

  for (const e of s.split(",")) {
    const [charIndex, modifiers] = e.split(":");
    const index = parseInt(charIndex, 10);
    entries.push({
      graphemeIndex: index,
      modifier: modifierStringToModifiers(modifiers),
    });
  }

  return new TextStyleStrip(...entries);
}

function textStyleStripToXmlish(strip: TextStyleStrip): string {
  const s = [];
  for (const e of strip.entries) {
    s.push(`${e.graphemeIndex}:${modifierStringFromModifiers(e.modifier)}`);
  }
  return s.join(",");
}
