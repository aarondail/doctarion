import * as DoctarionDocument from "doctarion-document";
import lodash from "lodash";
import React from "react";

import { Cursor } from "./Cursor";
import { DocumentNode, DocumentNodeLayoutProvider } from "./DocumentNode";
import { EditorContext } from "./EditorContext";
import { InputInterpreter } from "./InputInterpreter";

import "./Editor.css";

export enum InputMode {
  Command,
  Insert,
}

export enum EditorCommand {
  Undo,
  Redo,
  SwitchToInsertMode,
  SwitchToCommandMode,
  InputCompositionModeStart,
  InputCompositionModeEnd,
}

export interface EditorProps {
  readonly initialDocument: DoctarionDocument.Document;
}

// P1. Perf -- the getLayout getCodePointsLayout stuff used for moving visually up and down doesn't really seem to be that slow.
//             the main prob with moving visually up and down seems to be really in teh NodeNavigator or CursorNavigator.
//             ... maybe lettting those two "jump ahead" by X chars would be a good idea... but that is a lot of work.
//             ... caching the layouts didn't appear to improve things much at all.
// F1. Enter Key --- Need to support it.
// B1. Inserting text near EOL - Doesn't work right
// B2. Keys up in the InputInterpreter get missed sometimes causing wonkyness (due to debugger at least)
// B3. Source maps for typescript LIBRARY code messed up
// B4. Too hard to debug stuff!
// B5. Clicking to place cursor... wrong often.

/**
 * Why aren't we using React state?
 *
 * Well some of the objects like the Editor are mutable, so changes have to go
 * through forceUpdate. Additionally, other objects like the Cursor and the
 * InputInterpreter have to be updated after changes and making it synchronous
 * (i.e. not relying on setState and its callback) has kept things a little
 * simpler and made it easy to deal with some bugs.
 *
 * That said there may be a verison of this that uses state that is better than
 * what we have here.
 */
export class Editor extends React.PureComponent<EditorProps> {
  private cursorRef?: Cursor | null;
  private editor: DoctarionDocument.Editor;
  private fontsLoaded?: boolean;
  private inputInterpreter: InputInterpreter;
  private insertionTextareaRef?: HTMLTextAreaElement | null;
  private mainDivRef?: HTMLDivElement | null;
  private throttledHandleWindowResize: () => void;

  public constructor(props: EditorProps) {
    super(props);

    this.throttledHandleWindowResize = lodash.throttle(this.handleWindowResize, 50);

    this.editor = new DoctarionDocument.Editor(this.props.initialDocument);
    this.inputInterpreter = new InputInterpreter(this.dispatchEditorOperationOrCommand, InputMode.Command);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (window as any).e = this.editor;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (window as any).debugMode = false;
  }

  public async componentDidMount(): Promise<void> {
    window.addEventListener("gesturechange", this.handleGestureChange);
    window.addEventListener("gestureend", this.handleGestureEnd);
    window.addEventListener("resize", this.throttledHandleWindowResize);
    window.addEventListener("wheel", this.handleWheel);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    await (window.document as any).fonts.load("12px Source Serif");
    this.fontsLoaded = true;

    this.forceUpdate();
  }

  public componentDidUpdate(): void {
    // We have to reposition the cursor if the document changed due to the fact
    // that there may be new DOM nodes registered or the layout of existing ones
    // may have changed.
    this.syncCursorPositionAndEtc();
  }

  public componentWillUnmount(): void {
    window.removeEventListener("gesturechange", this.handleGestureChange);
    window.removeEventListener("gestureend", this.handleGestureEnd);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    window.removeEventListener("resize", this.throttledHandleWindowResize);
    window.removeEventListener("wheel", this.handleWheel);
  }

  public render(): JSX.Element {
    return (
      <div
        ref={this.setMainDivRef}
        className={`Editor ${this.inputInterpreter.inputMode === InputMode.Command ? "command-mode" : "insert-mode"}`}
        tabIndex={0}
        onKeyDown={this.handleKeyDown}
        onKeyUp={this.handleKeyUp}
        onClick={this.handleClick}
      >
        <textarea
          ref={this.setInsertionTextareaRef}
          className={`Editor-textarea ${this.inputInterpreter.isComposting ? "Editor-textarea-composting" : ""}`}
          // disabled={this.inputInterpreter.inputMode !== InputMode.Insert}
          tabIndex={0}
          wrap="off"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          onBlur={this.handleTextareaBlur}
          onCompositionStart={this.handleTextareaCompositionStart}
          onCompositionUpdate={this.handleTextareaCompositionUpdate}
          onCompositionEnd={this.handleTextareaCompositionEnd}
          onInput={this.handleTextareaInput}
          onChange={this.handleTextareaChange}
        ></textarea>
        <Cursor ref={this.setCursorsRef} />
        {this.fontsLoaded && (
          <EditorContext.Provider value={this.editor.services}>
            <DocumentNode node={this.editor.document} />
          </EditorContext.Provider>
        )}
      </div>
    );
  }

  private dispatchEditorOperationOrCommand = (
    operationOrCommand: DoctarionDocument.EditorOperation | EditorCommand
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    console.log("dispatchEditorOperationOrCommand", (operationOrCommand as any).name);
    switch (operationOrCommand) {
      case EditorCommand.InputCompositionModeEnd:
        this.forceUpdate(); // Re-render so that the class name of the textarea is updated
        break;
      case EditorCommand.InputCompositionModeStart:
        this.forceUpdate(); // Re-render so that the class name of the textarea is updated
        break;
      case EditorCommand.Redo:
        this.editor.redo();
        break;
      case EditorCommand.SwitchToCommandMode:
        this.inputInterpreter.inputMode = InputMode.Command;
        this.mainDivRef?.focus();
        break;
      case EditorCommand.SwitchToInsertMode:
        this.inputInterpreter.inputMode = InputMode.Insert;
        if (this.insertionTextareaRef) {
          this.insertionTextareaRef.value = "";
          this.insertionTextareaRef.focus();
        }
        break;
      case EditorCommand.Undo:
        this.editor.undo();
        break;
      default:
        this.editor.update(operationOrCommand);
    }

    try {
      const n = new DoctarionDocument.CursorNavigator(this.editor.document);
      n.navigateTo(this.editor.cursor);
      console.log("Current node: ", n.tip.node);
      // eslint-disable-next-line no-empty
    } catch {}

    this.forceUpdate();
  };

  private handleClick = (e: React.MouseEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const debugMode = (window as any).debugMode;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    // console.log("click", e.pageX, e.pageY, (e.nativeEvent as any).id, e.target);
    const x = e.pageX;
    const y = e.pageY;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const id = (e.target as HTMLElement).id;
    if (!id) {
      return;
    }
    const provider = this.editor.services.layout.getProvider(id);
    if (!provider) {
      return;
    }
    const chain = this.editor.services.lookup.getChainTo(id);
    if (!chain) {
      return;
    }

    const p = DoctarionDocument.Chain.getPath(chain);
    // console.log(p);

    if (DoctarionDocument.Node.containsText(DoctarionDocument.Chain.getTipNode(chain))) {
      let found = false;
      let lefter = false;
      let index = 0;
      // Could do a binary search ...
      for (const rect of provider.getGraphemeLayout() || []) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          found = true;
          if (x <= rect.left + rect.width * 0.5) {
            lefter = true;
          }
          break;
        }
        index++;
      }

      if (found) {
        this.dispatchEditorOperationOrCommand(
          DoctarionDocument.Ops.jumpTo(
            [...p, DoctarionDocument.PathPart.grapheme(index)],
            // This probably doesn't work right in all cases
            lefter ? DoctarionDocument.CursorAffinity.Before : DoctarionDocument.CursorAffinity.After
          )
        );

        (provider as DocumentNodeLayoutProvider).debugMode = debugMode;

        return;
      }
    }
    // This doesn't work right in all cases
    this.dispatchEditorOperationOrCommand(DoctarionDocument.Ops.jumpTo(p, DoctarionDocument.CursorAffinity.After));
    (provider as DocumentNodeLayoutProvider).debugMode = debugMode;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleGestureChange = (e: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e.scale !== 1) {
      // Im not sure this is really necessary since the document doesn't relayout... but it doesn't hurt I guess
      this.throttledHandleWindowResize();
    }
  };

  private handleGestureEnd = (e: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e.scale !== 1) {
      // Im not sure this is really necessary since the document doesn't relayout... but it doesn't hurt I guess
      this.throttledHandleWindowResize();
    }
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    this.inputInterpreter?.keyDown(e);
  };

  private handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) => this.inputInterpreter?.keyUp(e);

  private handleTextareaBlur = () => {
    // Keep focus on the text area
    if (this.inputInterpreter.inputMode === InputMode.Insert) {
      this.insertionTextareaRef?.focus();
    }
  };

  private handleTextareaChange = (e: React.ChangeEvent<HTMLElement>) =>
    // Not sure if this does anything actually
    e.preventDefault();

  private handleTextareaCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
    this.inputInterpreter?.compositionEnd(e);

  private handleTextareaCompositionStart = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
    this.inputInterpreter?.compositionStart(e);

  private handleTextareaCompositionUpdate = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
    this.inputInterpreter?.compositionUpdate(e);

  private handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    this.inputInterpreter?.input(e);
    // if (taRef.current) {
    //   taRef.current.value = "";
    // }
  };

  private handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      this.throttledHandleWindowResize();
    }
  };

  private handleWindowResize = () => {
    this.syncCursorPositionAndEtc();
  };

  private setCursorsRef = (cursor: Cursor | null) => {
    this.cursorRef = cursor;
  };

  private setInsertionTextareaRef = (textarea: HTMLTextAreaElement | null) => {
    this.insertionTextareaRef = textarea;
    if (this.insertionTextareaRef && this.inputInterpreter.inputMode === InputMode.Insert) {
      this.insertionTextareaRef.focus();
    }
  };

  private setMainDivRef = (div: HTMLDivElement | null) => {
    this.mainDivRef = div;
    if (this.mainDivRef && this.inputInterpreter.inputMode === InputMode.Command) {
      this.mainDivRef.focus();
    }
  };

  private syncCursorPositionAndEtc = () => {
    const cursorPosition = this.cursorRef?.layout(
      this.editor.cursor,
      this.editor.document,
      this.editor.services.layout
    );
    if (this.insertionTextareaRef) {
      this.insertionTextareaRef.style.left = cursorPosition ? `${cursorPosition.left}px` : "";
      this.insertionTextareaRef.style.top = cursorPosition ? `${cursorPosition.top}px` : "";
      this.insertionTextareaRef.style.height = cursorPosition ? `${cursorPosition.height}px` : "";
    }
  };
}
