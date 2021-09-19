// -----------------------------------------------------------------------------
// You can think of a document as a tree like structure of Nodes. The Nodes
// are just the different objects that make up the Document.
// -----------------------------------------------------------------------------

import { FancyText, Text } from "../text-model-rd4";

import { FacetMap } from "./facets";

export enum NodeCategory {
  Block = "BLOCK",
  Inline = "INLINE",
  Annotation = "ANNOTATION",
  Lateral = "LATERAL",
  SuperBlock = "SUPER_BLOCK",
  Intermediate = "INTERMEDIATE",
}

export enum NodeChildrenType {
  None = "NONE",
  Text = "TEXT",
  FancyText = "FANCY_TEXT",
  Inlines = "INLINES",
  Blocks = "BLOCKS",
  Intermediates = "INTERMEDIATES",
  BlocksAndSuperBlocks = "BLOCKS_AND_SUPER_BLOCKS",
}

export interface NodeType {
  readonly category: NodeCategory;
  readonly childrenType: NodeChildrenType;
  readonly facets: FacetMap;
  readonly nodeName: string;
  readonly specificIntermediateChildType?: NodeType;
}

export abstract class Node {
  public abstract children?: readonly Node[] | Text | FancyText;
  public abstract nodeType: NodeType;
}