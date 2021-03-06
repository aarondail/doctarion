import { Mutable, Nullable } from "../shared-utils";

export enum TextStyleSemanticPurpose {
  Quote,
  Emphasis,
  Subtle,
  InternalThinking,
  TechnicalTerm,
  Code,
  Unusual,
}

export interface TextStyle {
  readonly bold?: true;
  readonly italic?: true;
  readonly underline?: true;
  readonly strikeThrough?: true;
  readonly purpose?: TextStyleSemanticPurpose;
  readonly foregroundColor?: string;
  readonly backgroundColor?: string;
}

export type TextStyleModifier = Nullable<TextStyle>;

export const TextStyle = {
  applyModifier(style: Mutable<TextStyle>, modifier: TextStyleModifier): void {
    for (const propertyName of Object.keys(modifier)) {
      const styleAsAny = style as any;
      const value = (modifier as any)[propertyName];
      if (value === null) {
        delete styleAsAny[propertyName];
      } else {
        styleAsAny[propertyName] = value;
      }
    }
  },
  createModifierToResetStyleToDefaults(style: TextStyle): TextStyleModifier {
    const result: any = {};
    for (const propertyName of Object.keys(style)) {
      result[propertyName] = null;
    }
    return result;
  },
};
