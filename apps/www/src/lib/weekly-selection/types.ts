export type WeeklySelectionItemState = {
  checked: boolean;
  comment: string;
  imageUrl?: string;
  links?: string[];
};

export type WeeklySelectionState = Record<string, WeeklySelectionItemState>;

export type SaveWeeklySelectionItem = (
  patch?: Partial<WeeklySelectionItemState>,
) => void;
