export const assertNever = (value: never, context = 'Unexpected value'): never => {
  throw new Error(`${context}: ${JSON.stringify(value)}`);
};
