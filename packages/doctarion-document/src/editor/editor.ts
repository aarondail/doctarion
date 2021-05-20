import { FriendlyIdGenerator } from "doctarion-utils";
import * as immer from "immer";
import lodash from "lodash";

import { NodeNavigator, Path } from "../basic-traversal";
import { Cursor, CursorOrientation } from "../cursor";
import { Interactor, InteractorSet } from "../interactor";
import { Document } from "../models";

import { moveBack, moveForward } from "./cursorOps";
import { EditorEventEmitter, EditorEvents } from "./events";
import { CORE_OPERATIONS, EditorOperation, EditorOperationCommand } from "./operation";
import { EditorOperationError, EditorOperationErrorCode } from "./operationError";
import {
  EditorNodeLookupService,
  EditorNodeTrackingService,
  EditorOperationServices,
  EditorProvidableServices,
  EditorProvidedServices,
  EditorServices,
} from "./services";
import { EditorState } from "./state";

export interface EditorConfig {
  readonly document: Document;
  readonly cursor?: Cursor;
  readonly provideService?: (
    services: EditorProvidedServices,
    events: EditorEvents
  ) => Partial<EditorProvidableServices>;
}

export class Editor {
  public readonly events: EditorEvents;
  public readonly services: EditorServices;

  private readonly eventEmitters: EditorEventEmitter;
  private futureList: EditorState[];
  private historyList: EditorState[];
  private readonly operationRegistry: Map<string, EditorOperation<unknown, string>>;
  private readonly operationServices: EditorOperationServices;
  private state: EditorState;

  public constructor({ document: initialDocument, cursor: initialCursor, provideService }: EditorConfig) {
    const idGenerator = new FriendlyIdGenerator();
    const primaryInteractorId = idGenerator.generateId("INTERACTOR");
    const interactors = new InteractorSet()
      .addInteractor(
        new Interactor(primaryInteractorId, initialCursor || new Cursor(new Path([]), CursorOrientation.On))
      )
      .setFocused(primaryInteractorId);

    this.state = {
      // Clone because we are going to assign ids which techncially is a
      // mutation
      document: lodash.cloneDeep(initialDocument),
      interactors,
      nodeParentMap: {},
    };
    this.historyList = [];
    this.futureList = [];

    this.eventEmitters = new EditorEventEmitter();
    this.events = this.eventEmitters;

    this.operationServices = {
      idGenerator,
      lookup: new EditorNodeLookupService(this.state, this.events),
      // Note the tracking service is supposed to be used only during
      // operations, which is why it wants mutable state
      tracking: new EditorNodeTrackingService(idGenerator, this.events),
    };

    if (provideService) {
      this.operationServices = {
        ...this.operationServices,
        ...provideService(this.operationServices, this.events),
      };
    }

    this.services = this.operationServices;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.operationRegistry = new Map();
    for (const op of CORE_OPERATIONS) {
      this.operationRegistry.set(op.id, op);
    }

    // Assign initial ids... note this must happen before the calls to update
    // because after that the objects in the state are no longer extensible (and
    // we can't assign ids to them). I think this is something immer does.
    const n = new NodeNavigator(this.state.document);
    n.navigateToStartOfDfs();
    this.operationServices.tracking.register(n.tip.node, undefined);
    n.traverseDescendants((node, parent) => this.operationServices.tracking.register(node, parent), {
      skipGraphemes: true,
    });

    if (initialCursor === undefined) {
      // Adjust the cursor so its on a valid position
      try {
        this.update(moveForward());
        this.update(moveBack());
      } catch {
        // Intentionally ignore problems
        // Maybe we should throw?
      }
    }
  }

  public get focusedCursor(): Cursor | undefined {
    if (this.state.interactors.focusedId !== undefined) {
      return this.state.interactors.byId[this.state.interactors.focusedId]?.mainCursor;
    }
    return undefined;
  }

  public get document(): Document {
    return this.state.document;
  }

  public get history(): readonly EditorState[] {
    return this.historyList;
  }

  public redo(): void {
    const futureButNowState = this.futureList.pop();
    if (futureButNowState) {
      this.historyList.push(this.state);
      this.state = futureButNowState;
    }
  }
  public resetHistory(): void {
    this.historyList = [];
    this.futureList = [];
  }

  public undo(): void {
    const oldButNewState = this.historyList.pop();
    if (oldButNewState) {
      this.futureList.push(this.state);
      this.state = oldButNewState;
    }
  }

  public update(command: EditorOperationCommand<unknown, string>): void {
    const op = this.operationRegistry.get(command.id);
    if (!op) {
      throw new EditorOperationError(EditorOperationErrorCode.UnknownOperation);
    }

    const oldState = this.state;
    const newState = immer.produce(this.state, (draft) => {
      this.eventEmitters.updateStart.emit(draft);
      op.run(draft, this.operationServices, command.payload);
    });

    // if (op.postRun) {
    //   newState = op.postRun(oldState, newState);
    // }

    // If there were no changes, don't do anything
    if (newState !== this.state) {
      // This is far too basic...
      this.historyList.push(this.state);
      this.state = newState;
      // Reset future
      this.futureList.splice(0, this.futureList.length);
    }
    this.eventEmitters.updateDone.emit(this.state);
    if (newState.document !== oldState.document) {
      this.eventEmitters.documentUpdated.emit(this.state.document);
    }
  }
}
