import { createContext, useContext, type ReactNode } from "react";
import type { AppDataState, ReadyWorkspaceData } from "../shared/model/workspace";

interface WorkspaceDataContextValue {
  data: ReadyWorkspaceData;
  onDataStateChange: (state: AppDataState) => void;
  showReset: boolean;
}

const WorkspaceDataContext = createContext<WorkspaceDataContextValue | null>(null);

export function WorkspaceDataProvider({
  data,
  onDataStateChange,
  showReset,
  children
}: WorkspaceDataContextValue & { children: ReactNode }) {
  return (
    <WorkspaceDataContext.Provider value={{ data, onDataStateChange, showReset }}>
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
