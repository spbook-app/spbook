import { createContext, useContext, type ReactNode } from "react";
import type {
  AppDataState,
  ReadyWorkspaceData,
  WorkspaceUpdateHandler
} from "../shared/model/workspace";
import { applyWorkspaceUpdate } from "../shared/lib/workspace-overview";

interface WorkspaceDataContextValue {
  data: ReadyWorkspaceData;
  onDataStateChange: (state: AppDataState) => void;
  onWorkspaceUpdate: WorkspaceUpdateHandler;
  showReset: boolean;
}

interface WorkspaceDataProviderProps {
  data: ReadyWorkspaceData;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
  children: ReactNode;
}

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null);

export function WorkspaceDataProvider({
  data,
  onDataStateChange,
  showReset,
  children
}: WorkspaceDataProviderProps) {
  const onWorkspaceUpdate: WorkspaceUpdateHandler = (update) => {
    onDataStateChange(applyWorkspaceUpdate(data, update));
  };

  return (
    <WorkspaceDataContext.Provider
      value={{ data, onDataStateChange, onWorkspaceUpdate, showReset }}
    >
      {children}
    </WorkspaceDataContext.Provider>
  );
}

export function useWorkspaceData(): WorkspaceDataContextValue {
  const value = useContext(WorkspaceDataContext);
  if (!value) {
    throw new Error("useWorkspaceData must be used within WorkspaceDataProvider");
  }
  return value;
}
