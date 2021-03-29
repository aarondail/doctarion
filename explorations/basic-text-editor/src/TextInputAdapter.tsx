import React from "react";

import { InputController } from "./InputController";

interface TextInputAdapterProps {
  readonly inputController: InputController;
  readonly left: number;
  readonly top: number;
  readonly ref: any;
}

export const TextInputAdapter = React.memo(
  React.forwardRef(function TextArea(props: TextInputAdapterProps, ref: any) {
    const taRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => ({
      focus: () => {
        taRef.current?.focus();
      },
    }));

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => props.inputController.keyDown(e);
    const handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) => props.inputController.keyUp(e);
    const handleCompositionStart = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
      props.inputController.compositionStart(e);
    const handleCompositionUpdate = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
      props.inputController.compositionUpdate(e);
    const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) =>
      props.inputController.compositionEnd(e);
    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      props.inputController.input(e);
      // if (taRef.current) {
      //   taRef.current.value = "";
      // }
    };
    const handleChange = (e: React.ChangeEvent<HTMLElement>) =>
      // Not sure if this does anything actually
      e.preventDefault();
    const handleBlur = () =>
      // Keep focus on the text area
      taRef.current?.focus();

    return (
      <textarea
        ref={taRef}
        className="TextInputAdapter-textarea"
        style={{
          position: "absolute",
          left: props.left,
          top: props.top,
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        wrap="off"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck="false"
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onChange={handleChange}
      ></textarea>
    );
  })
);
