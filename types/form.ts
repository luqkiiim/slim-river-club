export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
  personalBest?: boolean;
  claimCode?: string;
}

export const initialActionState: ActionState = {
  status: "idle",
};
