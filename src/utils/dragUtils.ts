
/**
 * Reorders an array based on drag and drop result
 * @param list - The original array
 * @param startIndex - The starting index of the dragged item
 * @param endIndex - The ending index where the item should be placed
 * @returns A new array with the item moved to the new position
 */
export const reorderArray = <T>(list: T[], startIndex: number, endIndex: number): T[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};
