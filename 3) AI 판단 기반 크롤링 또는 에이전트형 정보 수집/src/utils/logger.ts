export const logStep = (step: number, message: string): void => {
  console.log(`[${step}] ${message}`);
};

export const logAgent = (message: string): void => {
  console.log(`[agent] ${message}`);
};

export const logResult = (message: string): void => {
  console.log(`[result] ${message}`);
};

export const logDetail = (message: string): void => {
  console.log(`[detail] ${message}`);
};

export const logSave = (message: string): void => {
  console.log(`[save] ${message}`);
};
