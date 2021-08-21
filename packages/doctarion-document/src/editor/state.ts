import { Draft } from "immer";

import { WorkingDocument } from "../working-document";

import { Interactor, InteractorId } from "./interactor";

export interface EditorState {
  readonly document2: Draft<WorkingDocument>;

  readonly focusedInteractorId: InteractorId | undefined;
  /**
   * This should only be updated by using the EditorInteractorService.
   */
  readonly interactors: { readonly [id: string /* InteractorId */]: Interactor };
}
