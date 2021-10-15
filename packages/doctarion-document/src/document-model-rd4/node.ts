import lodash from "lodash";

import { FancyText, Text, TextStyleStrip } from "../text-model-rd4";

import { Anchor, AnchorRange } from "./anchor";
import { Facet, FacetMap, FacetType } from "./facets";

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

export class NodeType {
  public constructor(
    public readonly nodeName: string,
    public readonly category: NodeCategory,
    public readonly childrenType: NodeChildrenType,
    public readonly facets: FacetMap,
    public readonly specificIntermediateChildType?: NodeType
  ) {
    // eslint-disable @typescript-eslint/unbound-method
    this.canContainChildrenOfType = lodash.once(this.canContainChildrenOfType);
    this.doesNotHaveChildren = lodash.once(this.doesNotHaveChildren);
    this.getFacetsThatAreAnchors = lodash.once(this.getFacetsThatAreAnchors);
    this.getFacetsThatAreNodeArrays = lodash.once(this.getFacetsThatAreNodeArrays);
    this.hasFancyTextChildren = lodash.once(this.hasFancyTextChildren);
    this.hasTextOrFancyTextChildren = lodash.once(this.hasTextOrFancyTextChildren);
    this.hasNodeChildren = lodash.once(this.hasNodeChildren);
    // eslint-enable @typescript-eslint/unbound-method
  }

  public canContainChildrenOfType = (nodeType: NodeType): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.Inlines:
        return nodeType.category === NodeCategory.Inline;
      case NodeChildrenType.Blocks:
        return nodeType.category === NodeCategory.Block;
      case NodeChildrenType.BlocksAndSuperBlocks:
        return nodeType.category === NodeCategory.Block || nodeType.category === NodeCategory.SuperBlock;
      case NodeChildrenType.Intermediates:
        return (
          nodeType.category === NodeCategory.Intermediate &&
          (this.specificIntermediateChildType === undefined || this.specificIntermediateChildType === nodeType)
        );
    }
    return false;
  };

  public doesNotHaveChildren = (): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.None:
        return true;
      default:
        return false;
    }
  };

  public getFacetsThatAreAnchors = (): Facet[] => {
    const result: Facet[] = [];
    for (const facet of this.facets) {
      switch (facet.type) {
        case FacetType.Anchor:
        case FacetType.AnchorOrAnchorRange:
        case FacetType.AnchorRange:
          result.push(facet);
      }
    }
    return result;
  };

  public getFacetsThatAreNodeArrays = (): Facet[] => {
    const result: Facet[] = [];
    for (const facet of this.facets) {
      switch (facet.type) {
        case FacetType.NodeArray:
          result.push(facet);
      }
    }
    return result;
  };

  public getFacetsThatAreTextStyleStrips = (): Facet[] => {
    const result: Facet[] = [];
    for (const facet of this.facets) {
      switch (facet.type) {
        case FacetType.TextStyleStrip:
          result.push(facet);
      }
    }
    return result;
  };

  public hasFancyTextChildren = (): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.FancyText:
        return true;
      default:
        return true;
    }
  };

  public hasNodeChildren = (): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
      case NodeChildrenType.None:
        return false;
      default:
        return true;
    }
  };

  public hasTextOrFancyTextChildren = (): boolean => {
    switch (this.childrenType) {
      case NodeChildrenType.FancyText:
      case NodeChildrenType.Text:
        return true;
      default:
        return true;
    }
  };
}

export abstract class Node {
  public abstract children?: readonly Node[] | Text | FancyText;
  public abstract nodeType: NodeType;

  getAllFacetAnchors(): readonly [Facet, Anchor | AnchorRange][] {
    const result: [Facet, Anchor | AnchorRange][] = [];
    for (const facet of this.nodeType.getFacetsThatAreAnchors()) {
      const value = this.getFacetValue(facet) as Anchor | AnchorRange;
      if (value) {
        result.push([facet, value]);
      }
    }
    return result;
  }

  getAllFacetNodes(): readonly [Facet, readonly Node[]][] {
    const result: [Facet, readonly Node[]][] = [];
    for (const facet of this.nodeType.getFacetsThatAreNodeArrays()) {
      const array = this.getFacetValue(facet) as readonly Node[];
      if (array) {
        result.push([facet, array]);
      }
    }
    return result;
  }

  getAllFacetTextStyleStrips(): readonly [Facet, TextStyleStrip][] {
    const result: [Facet, TextStyleStrip][] = [];
    for (const facet of this.nodeType.getFacetsThatAreTextStyleStrips()) {
      const value = this.getFacetValue(facet) as TextStyleStrip;
      if (value) {
        result.push([facet, value]);
      }
    }
    return result;
  }

  getFacetValue(facet: Facet): unknown | undefined {
    return (this as any)[facet.name];
  }
}
