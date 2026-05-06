export const joinClassNames = (
  ...classNames: Array<string | false | undefined>
) => classNames.filter(Boolean).join(" ");
