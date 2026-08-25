"use client";

import { useEffect } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { IDockviewPanelProps } from "dockview-react";
import { ensureSereMonaco, SERE_EDITOR_OPTIONS } from "@/app/lib/sereMonaco";
import { getSereLsp, registerSereLspProviders } from "@/app/lib/sereMonacoLsp";
import { monacoLanguageForPath, monacoModelPath } from "@/app/lib/workspace";
import { useWorkspace } from "./WorkspaceContext";

const beforeMount: BeforeMount = (monaco) => {
  ensureSereMonaco(monaco);
  registerSereLspProviders(monaco);
};

export default function EditorPanel(props: IDockviewPanelProps<{ path: string }>) {
  const path = props.params.path;
  const { getFile, updateFile, registerEditor, unregisterEditor, settings } = useWorkspace();
  const file = getFile(path);

  useEffect(() => {
    return () => unregisterEditor(path);
  }, [path, unregisterEditor]);

  const onMount: OnMount = (instance, monaco) => {
    const model = instance.getModel();
    const language = monacoLanguageForPath(path);
    if (model && language !== "plaintext") {
      monaco.editor.setModelLanguage(model, language);
    }
    monaco.editor.setTheme("sere-dark");
    registerEditor(path, instance);
    if (path.endsWith(".sere")) {
      void getSereLsp()
        ?.waitUntilReady()
        .then((ready) => {
          if (ready) {
            getSereLsp()?.openDocument(path, file?.content ?? instance.getValue());
          }
        });
    }
  };

  return (
    <div className="h-full min-h-0 w-full bg-transparent">
      <Editor
        height="100%"
        theme="sere-dark"
        path={monacoModelPath(path)}
        language={monacoLanguageForPath(path)}
        value={file?.content ?? ""}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(value) => updateFile(path, value ?? "")}
        options={{
          ...SERE_EDITOR_OPTIONS,
          fontSize: settings.fontSize,
          lineHeight: Math.round(settings.fontSize * 1.65),
          minimap: { enabled: settings.minimap },
          wordWrap: settings.wordWrap ? "on" : "off",
        }}
      />
    </div>
  );
}
