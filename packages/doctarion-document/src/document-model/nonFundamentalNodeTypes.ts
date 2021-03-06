import { FacetValueType } from "./facets";
import { FloaterPlacement, HeaderLevel } from "./misc";
import { NodeCategory, NodeChildrenType, NodeType } from "./nodeType";

import { FacetTextStyleStripName } from ".";

//#region ANNOTATIONS
//
// Annotations appear sorta in place with content in blocks (and such), rather
// than off "to the side",

export const Floater = new NodeType({
  name: "Floater",
  category: NodeCategory.Annotation,
  childrenType: NodeChildrenType.Inlines,
  facets: {
    anchors: FacetValueType.AnchorOrAnchorRange,
    placement: {
      valueType: FacetValueType.Enum,
      options: Object.values(FloaterPlacement),
    },
  },
});

export const Footer = new NodeType({
  name: "Footer",
  category: NodeCategory.Annotation,
  childrenType: NodeChildrenType.Inlines,
  facets: {
    anchor: FacetValueType.Anchor,
  },
});

/**
 * This is more of a above/below the line comment vs to the side (which is the
 * Lateral Comment).
 */
export const AnnotationComment = new NodeType({
  name: "AnnotationComment",
  category: NodeCategory.Annotation,
  childrenType: NodeChildrenType.Inlines,
  facets: {
    anchors: FacetValueType.AnchorRange,
  },
});

//#endregion ANNOTATIONS

//#region BLOCKS

export const BlockQuote = new NodeType({
  name: "BlockQuote",
  category: NodeCategory.Block,
  childrenType: NodeChildrenType.Inlines,
});

export const Hero = new NodeType({
  name: "Hero",
  category: NodeCategory.Block,
  childrenType: NodeChildrenType.Inlines,
});

export const Media = new NodeType({
  name: "Media",
  category: NodeCategory.Block,
  childrenType: NodeChildrenType.None,
});

export const CodeBlock = new NodeType({
  name: "CodeBlock",
  category: NodeCategory.Block,
  childrenType: NodeChildrenType.Inlines,
  facets: {
    language: FacetValueType.Text,
  },
});

export const Header = new NodeType({
  name: "Header",
  category: NodeCategory.Block,
  childrenType: NodeChildrenType.Inlines,
  facets: {
    level: {
      valueType: FacetValueType.Enum,
      options: Object.values(HeaderLevel),
    },
  },
});

//#endregion BLOCKS

//#region INLINES

export const Link = new NodeType({
  name: "Link",
  category: NodeCategory.Inline,
  // TODO Should this be some kind of FancyText TEMPLATE thing?
  childrenType: NodeChildrenType.FancyText,
  facets: {
    url: { valueType: FacetValueType.Text, optional: true },
    entityId: { valueType: FacetValueType.EntityId, optional: true },
    // TODO document id? other ids?
  },
});

// TODO not really sure we want to keep this
export const InlineNote = new NodeType({
  name: "InlineNote",
  category: NodeCategory.Inline,
  childrenType: NodeChildrenType.FancyText,
  facets: {
    [FacetTextStyleStripName]: {
      valueType: FacetValueType.TextStyleStrip,
      optional: true,
    },
  },
});

export const Tag = new NodeType({
  name: "Tag",
  category: NodeCategory.Inline,
  childrenType: NodeChildrenType.FancyText,
});

//#endregion INLINES

//#region LATERALS

export const Sidebar = new NodeType({
  name: "Sidebar",
  category: NodeCategory.Lateral,
  childrenType: NodeChildrenType.Blocks,
  facets: {
    anchor: FacetValueType.Anchor,
  },
});

export const SideComment = new NodeType({
  name: "SideComment",
  category: NodeCategory.Lateral,
  childrenType: NodeChildrenType.Blocks,
  facets: {
    anchors: FacetValueType.AnchorOrAnchorRange,
  },
});

//#endregion LATERALS

//#region INTERMEDIATES

export const ListItem = new NodeType({
  name: "ListItem",
  category: NodeCategory.Intermediate,
  childrenType: NodeChildrenType.BlocksAndSuperBlocks,
});

export const GridCell = new NodeType({
  name: "GridCell",
  category: NodeCategory.Intermediate,
  childrenType: NodeChildrenType.BlocksAndSuperBlocks,
});

export const Column = new NodeType({
  name: "Column",
  category: NodeCategory.Intermediate,
  childrenType: NodeChildrenType.BlocksAndSuperBlocks,
});

//#endregion INTERMEDIATES

//#region SUPERBLOCKS

export const List = new NodeType({
  name: "List",
  category: NodeCategory.SuperBlock,
  childrenType: NodeChildrenType.Intermediates,
  specificIntermediateChildType: ListItem,
});

export const Grid = new NodeType({
  name: "Grid",
  category: NodeCategory.SuperBlock,
  childrenType: NodeChildrenType.Intermediates,
  specificIntermediateChildType: GridCell,
});

export const Columns = new NodeType({
  name: "Columns",
  category: NodeCategory.SuperBlock,
  childrenType: NodeChildrenType.Intermediates,
  specificIntermediateChildType: Column,
});

//#endregion SUPERBLOCKS
